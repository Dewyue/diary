import type { DiaryEntry } from '../types';
import { formatDisplayDate, formatTime } from '../dateUtils';
import { VoicePlayer } from './VoicePlayer';

type Props = {
  entry: DiaryEntry;
  onClose: () => void;
  onEdit: (entry: DiaryEntry) => void;
};

export function EntryPeek({ entry, onClose, onEdit }: Props) {
  const voices = entry.voices ?? [];
  const hasContent = Boolean(entry.content.trim());

  return (
    <div className="peek" role="dialog" aria-modal="true" aria-label="查看日记">
      <button
        type="button"
        className="peek__backdrop"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className="peek__panel">
        <header className="peek__header">
          <p className="peek__date">{formatDisplayDate(entry.date)}</p>
          <p className="peek__time">{formatTime(entry.createdAt)}</p>
        </header>

        {entry.tags.length > 0 && (
          <div className="peek__tags" aria-label="标签">
            {entry.tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="peek__body">
          {voices.length > 0 && (
            <div className="peek__voices">
              {voices.map((clip) => (
                <VoicePlayer
                  key={clip.id}
                  id={clip.id}
                  durationMs={clip.durationMs}
                />
              ))}
            </div>
          )}
          {hasContent ? (
            <p className="peek__content">{entry.content}</p>
          ) : voices.length === 0 ? (
            <p className="peek__content">（空内容）</p>
          ) : null}
        </div>

        <footer className="peek__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className="btn-primary btn-primary--sm"
            onClick={() => onEdit(entry)}
          >
            编辑
          </button>
        </footer>
      </div>
    </div>
  );
}
