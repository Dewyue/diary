import type { DiaryEntry } from '../types';
import { formatTime } from '../dateUtils';

type Props = {
  entries: DiaryEntry[];
  emptyText?: string;
  onSelect: (entry: DiaryEntry) => void;
};

export function EntryList({ entries, emptyText = '暂无日记', onSelect }: Props) {
  if (entries.length === 0) {
    return <p className="empty-hint">{emptyText}</p>;
  }

  return (
    <ul className="entry-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            className="entry-list__item"
            onClick={() => onSelect(entry)}
          >
            <div className="entry-list__meta">
              <span className="entry-list__time">{formatTime(entry.createdAt)}</span>
              {entry.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
            <p className="entry-list__preview entry-list__preview--primary">
              {entry.content || '（空内容）'}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
