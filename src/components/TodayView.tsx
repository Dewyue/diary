import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { DiaryEntry } from '../types';
import { entriesForDate } from '../search';
import {
  dayOffsetFromToday,
  formatDisplayDate,
  shiftDay,
  todayISO,
} from '../dateUtils';
import { EntryList } from './EntryList';
import { InlineComposer } from './InlineComposer';

type Props = {
  entries: DiaryEntry[];
  knownTags: string[];
  draftingDate: string | null;
  onCreate: (date: string) => void;
  onCancelDraft: () => void;
  onSaveDraft: (payload: {
    content: string;
    tags: string[];
    date: string;
  }) => void;
  onSelect: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
};

const SWIPE_MIN_PX = 56;
const SWIPE_MAX_SLOPE = 0.75;

function relativeDayLabel(offset: number): string {
  if (offset === 0) return '今日';
  if (offset === -1) return '昨天';
  if (offset === 1) return '明天';
  if (offset < 0) return `${Math.abs(offset)} 天前`;
  return `${offset} 天后`;
}

export function TodayView({
  entries,
  knownTags,
  draftingDate,
  onCreate,
  onCancelDraft,
  onSaveDraft,
  onSelect,
  onDelete,
}: Props) {
  const today = todayISO();
  const [viewDate, setViewDate] = useState(today);
  const dayEntries = entriesForDate(entries, viewDate);
  const offset = dayOffsetFromToday(viewDate);
  const isToday = offset === 0;
  const isDrafting = draftingDate === viewDate;

  const swipeRef = useRef<{
    id: number;
    x: number;
    y: number;
    locked: 'h' | 'v' | null;
  } | null>(null);

  useEffect(() => {
    if (draftingDate) setViewDate(draftingDate);
  }, [draftingDate]);

  function goBy(delta: number) {
    if (isDrafting) return;
    setViewDate((prev) => shiftDay(prev, delta));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (isDrafting) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      locked: null,
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLElement>) {
    const start = swipeRef.current;
    if (!start || start.id !== e.pointerId || start.locked) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    start.locked = Math.abs(dx) > Math.abs(dy) * (1 / SWIPE_MAX_SLOPE) ? 'h' : 'v';
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLElement>) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || start.id !== e.pointerId) return;
    if (start.locked === 'v') return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX) return;
    if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_SLOPE) return;
    goBy(dx > 0 ? -1 : 1);
  }

  function handlePointerCancel() {
    swipeRef.current = null;
  }

  return (
    <section
      className={`view view--day${isDrafting ? ' is-drafting' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <header className="page-header">
        <div className="page-header__row">
          <p className="eyebrow">{relativeDayLabel(offset)}</p>
          {!isToday && !isDrafting && (
            <button
              type="button"
              className="btn-ghost btn-ghost--sm"
              onClick={() => setViewDate(today)}
            >
              回到今天
            </button>
          )}
        </div>
        <h1 className="view__title">{formatDisplayDate(viewDate)}</h1>
        {dayEntries.length > 0 ? (
          <p className="view__subtitle">{dayEntries.length} 条</p>
        ) : null}
      </header>

      <div className="stack-sm">
        {isDrafting && (
          <InlineComposer
            date={viewDate}
            knownTags={knownTags}
            onSave={onSaveDraft}
            onCancel={onCancelDraft}
          />
        )}
        <EntryList
          entries={dayEntries}
          emptyText={isDrafting ? '' : '暂无'}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </div>

      {!isDrafting && (
        <button
          type="button"
          className="fab"
          aria-label="新建日记"
          onClick={() => onCreate(viewDate)}
        >
          +
        </button>
      )}
    </section>
  );
}
