import { useRef } from 'react';
import type { DiaryEntry } from '../types';
import { formatTime } from '../dateUtils';
import { VoicePlayer } from './VoicePlayer';

type Props = {
  entries: DiaryEntry[];
  emptyText?: string;
  onSelect: (entry: DiaryEntry) => void;
  onDelete?: (entry: DiaryEntry) => void;
};

const LONG_PRESS_MS = 480;

export function EntryList({
  entries,
  emptyText = '暂无',
  onSelect,
  onDelete,
}: Props) {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const targetRef = useRef<DiaryEntry | null>(null);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function startLongPress(entry: DiaryEntry) {
    if (!onDelete) return;
    longPressedRef.current = false;
    targetRef.current = entry;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      if (
        targetRef.current &&
        window.confirm('确定删除这条日记？')
      ) {
        onDelete(targetRef.current);
      }
    }, LONG_PRESS_MS);
  }

  function handleClick(entry: DiaryEntry) {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    onSelect(entry);
  }

  if (entries.length === 0) {
    if (!emptyText) return null;
    return <p className="empty-hint">{emptyText}</p>;
  }

  return (
    <ul className="entry-list">
      {entries.map((entry) => {
        const voices = entry.voices ?? [];
        return (
          <li key={entry.id} className="entry-list__card">
            <button
              type="button"
              className="entry-list__item"
              onClick={() => handleClick(entry)}
              onPointerDown={() => startLongPress(entry)}
              onPointerUp={clearTimer}
              onPointerLeave={clearTimer}
              onPointerCancel={clearTimer}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="日记条目"
            >
              <div className="entry-list__meta">
                <span className="entry-list__time">{formatTime(entry.createdAt)}</span>
                {entry.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              {entry.content.trim() ? (
                <p className="entry-list__preview entry-list__preview--primary">
                  {entry.content}
                </p>
              ) : voices.length === 0 ? (
                <p className="entry-list__preview entry-list__preview--primary">
                  （空内容）
                </p>
              ) : null}
            </button>
            {voices.length > 0 && (
              <div className="entry-list__voices">
                {voices.map((clip) => (
                  <VoicePlayer
                    key={clip.id}
                    id={clip.id}
                    durationMs={clip.durationMs}
                    compact
                  />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
