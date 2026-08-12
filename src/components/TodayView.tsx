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
  editingEntry: DiaryEntry | null;
  onCreate: (date: string) => void;
  onCancelEditor: () => void;
  onSaveEditor: (payload: {
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
  editingEntry,
  onCreate,
  onCancelEditor,
  onSaveEditor,
  onSelect,
  onDelete,
}: Props) {
  const today = todayISO();
  const [viewDate, setViewDate] = useState(today);
  const offset = dayOffsetFromToday(viewDate);
  const isToday = offset === 0;
  const isDrafting = draftingDate === viewDate;
  const isEditingHere = Boolean(editingEntry && editingEntry.date === viewDate);
  const isEditing = isDrafting || isEditingHere;
  const dayEntries = entriesForDate(entries, viewDate).filter(
    (entry) => entry.id !== editingEntry?.id,
  );

  const swipeRef = useRef<{
    id: number;
    x: number;
    y: number;
    locked: 'h' | 'v' | null;
  } | null>(null);

  useEffect(() => {
    if (draftingDate) setViewDate(draftingDate);
  }, [draftingDate]);

  useEffect(() => {
    if (editingEntry) setViewDate(editingEntry.date);
  }, [editingEntry]);

  function goBy(delta: number) {
    if (isEditing) return;
    setViewDate((prev) => shiftDay(prev, delta));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLElement>) {
    if (isEditing) return;
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
      className={`view view--day${isEditing ? ' is-drafting' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <header className="page-header">
        <div className="page-header__row">
          <p className="eyebrow">{relativeDayLabel(offset)}</p>
          {!isToday && !isEditing && (
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
            onSave={onSaveEditor}
            onCancel={onCancelEditor}
          />
        )}
        {isEditingHere && editingEntry && (
          <InlineComposer
            key={editingEntry.id}
            date={editingEntry.date}
            initialContent={editingEntry.content}
            initialTags={editingEntry.tags}
            knownTags={knownTags}
            onSave={onSaveEditor}
            onCancel={onCancelEditor}
          />
        )}
        <EntryList
          entries={dayEntries}
          emptyText={isEditing ? '' : '暂无'}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      </div>

      {!isEditing && (
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
