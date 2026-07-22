import { useEffect, useMemo, useRef } from 'react';
import {
  buildMonthGrid,
  formatMonthTitle,
  shiftMonth,
  todayISO,
} from '../dateUtils';

const RANGE = 8;

type Props = {
  marked: Set<string>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
};

function monthKey(year: number, monthIndex: number) {
  return `${year}-${monthIndex}`;
}

export function CalendarScrollPreview({
  marked,
  selectedDate,
  onSelectDate,
  onClose,
}: Props) {
  const today = todayISO();
  const now = new Date();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef(new Map<string, HTMLElement>());

  const months = useMemo(() => {
    const start = shiftMonth(now.getFullYear(), now.getMonth(), -RANGE);
    const list: { year: number; monthIndex: number; key: string }[] = [];
    for (let i = 0; i <= RANGE * 2; i++) {
      const m = shiftMonth(start.year, start.monthIndex, i);
      list.push({
        year: m.year,
        monthIndex: m.monthIndex,
        key: monthKey(m.year, m.monthIndex),
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const key = monthKey(now.getFullYear(), now.getMonth());
      const root = scrollerRef.current;
      const el = monthRefs.current.get(key);
      if (!root || !el) return;
      const top =
        root.scrollTop +
        (el.getBoundingClientRect().top - root.getBoundingClientRect().top);
      root.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="cal-preview" role="dialog" aria-modal="true" aria-label="连续月份预览">
      <button type="button" className="cal-preview__backdrop" aria-label="关闭" onClick={onClose} />
      <div className="cal-preview__panel">
        <header className="cal-preview__header">
          <div>
            <p className="eyebrow">连续月份</p>
            <h2 className="cal-preview__title">上下滑动浏览</h2>
          </div>
          <button type="button" className="btn-text btn-text--accent" onClick={onClose}>
            完成
          </button>
        </header>

        <div className="cal-preview__weekdays" aria-hidden>
          {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div
          ref={scrollerRef}
          className="cal-preview__scroller"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {months.map((m) => {
            const grid = buildMonthGrid(m.year, m.monthIndex);
            return (
              <section
                key={m.key}
                className="cal-preview__month"
                ref={(el) => {
                  if (el) monthRefs.current.set(m.key, el);
                  else monthRefs.current.delete(m.key);
                }}
              >
                <h3 className="cal-preview__month-title">
                  {formatMonthTitle(m.year, m.monthIndex)}
                </h3>
                <div className="cal-preview__grid">
                  {grid.map((cell) => {
                    if (!cell.inMonth) {
                      return <div key={cell.date} className="cal-preview__day is-empty" />;
                    }
                    const isSelected = cell.date === selectedDate;
                    const isToday = cell.date === today;
                    const hasEntries = marked.has(cell.date);
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        className={[
                          'cal-preview__day',
                          isSelected ? 'is-selected' : '',
                          isToday ? 'is-today' : '',
                          hasEntries ? 'has-entries' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => onSelectDate(cell.date)}
                      >
                        <span>{cell.day}</span>
                        {hasEntries ? <i className="calendar__dot" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
