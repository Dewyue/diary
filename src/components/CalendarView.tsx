import { useMemo, useState } from 'react';
import type { DiaryEntry } from '../types';
import { datesWithEntries, entriesForDate } from '../search';
import {
  buildMonthGrid,
  formatDisplayDate,
  formatMonthTitle,
  shiftMonth,
  todayISO,
} from '../dateUtils';
import { EntryList } from './EntryList';

type Props = {
  entries: DiaryEntry[];
  onCreate: (date: string) => void;
  onSelect: (entry: DiaryEntry) => void;
};

export function CalendarView({ entries, onCreate, onSelect }: Props) {
  const today = todayISO();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);

  const marked = useMemo(() => datesWithEntries(entries), [entries]);
  const grid = useMemo(() => buildMonthGrid(year, monthIndex), [year, monthIndex]);
  const dayEntries = entriesForDate(entries, selectedDate);

  function goMonth(delta: number) {
    const next = shiftMonth(year, monthIndex, delta);
    setYear(next.year);
    setMonthIndex(next.monthIndex);
  }

  return (
    <section className="view">
      <header className="view__header">
        <div>
          <p className="eyebrow">日历</p>
          <h1 className="view__title">{formatMonthTitle(year, monthIndex)}</h1>
        </div>
        <div className="month-nav">
          <button type="button" className="btn-ghost" onClick={() => goMonth(-1)} aria-label="上个月">
            ‹
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const d = new Date();
              setYear(d.getFullYear());
              setMonthIndex(d.getMonth());
              setSelectedDate(todayISO());
            }}
          >
            本月
          </button>
          <button type="button" className="btn-ghost" onClick={() => goMonth(1)} aria-label="下个月">
            ›
          </button>
        </div>
      </header>

      <div className="calendar">
        <div className="calendar__weekdays">
          {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="calendar__grid">
          {grid.map((cell) => {
            const isSelected = cell.date === selectedDate;
            const hasEntries = marked.has(cell.date);
            const isToday = cell.date === today;
            return (
              <button
                key={cell.date}
                type="button"
                className={[
                  'calendar__day',
                  cell.inMonth ? '' : 'is-outside',
                  isSelected ? 'is-selected' : '',
                  isToday ? 'is-today' : '',
                  hasEntries ? 'has-entries' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedDate(cell.date)}
              >
                <span>{cell.day}</span>
                {hasEntries ? <i className="calendar__dot" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="day-panel">
        <div className="day-panel__header">
          <h2 className="day-panel__title">{formatDisplayDate(selectedDate)}</h2>
          <button
            type="button"
            className="btn-primary btn-primary--sm"
            onClick={() => onCreate(selectedDate)}
          >
            新建
          </button>
        </div>
        <EntryList
          entries={dayEntries}
          emptyText="这一天还没有记录"
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}
