import type { DiaryEntry } from '../types';
import { entriesForDate } from '../search';
import { formatDisplayDate, todayISO } from '../dateUtils';
import { EntryList } from './EntryList';

type Props = {
  entries: DiaryEntry[];
  onCreate: (date: string) => void;
  onSelect: (entry: DiaryEntry) => void;
};

export function TodayView({ entries, onCreate, onSelect }: Props) {
  const today = todayISO();
  const dayEntries = entriesForDate(entries, today);

  return (
    <section className="view">
      <header>
        <p className="eyebrow">今日</p>
        <h1 className="view__title">{formatDisplayDate(today)}</h1>
        <p className="view__subtitle">
          {dayEntries.length === 0
            ? '还没写，点右下角记一条'
            : `今天 ${dayEntries.length} 条`}
        </p>
      </header>

      <div className="stack-sm">
        <div className="section-head">
          <h2>今日日记</h2>
          <span>{dayEntries.length} 条</span>
        </div>
        <EntryList
          entries={dayEntries}
          emptyText="还没有记录"
          onSelect={onSelect}
        />
      </div>

      <button
        type="button"
        className="fab"
        aria-label="新建日记"
        onClick={() => onCreate(today)}
      >
        +
      </button>
    </section>
  );
}
