import { useEffect, useMemo, useRef, useState } from 'react';
import type { DiaryEntry, EntryDraft } from '../types';
import { datesWithEntries, entriesForDate } from '../search';
import {
  buildMonthGrid,
  formatDisplayDate,
  shiftMonth,
  todayISO,
} from '../dateUtils';
import { EntryList } from './EntryList';
import { CalendarScrollPreview } from './CalendarScrollPreview';
import { InlineComposer } from './InlineComposer';
import { EntryPeek } from './EntryPeek';

type Props = {
  entries: DiaryEntry[];
  knownTags: string[];
  draftingDate: string | null;
  editingEntry: DiaryEntry | null;
  onCreate: (date: string) => void;
  onCancelEditor: () => void;
  onSaveEditor: (payload: EntryDraft) => void;
  onSelect: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
};

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const LONG_PRESS_MS = 480;

function yearOptions(entries: DiaryEntry[], currentYear: number): number[] {
  let min = currentYear;
  let max = currentYear;
  for (const entry of entries) {
    const y = Number(entry.date.slice(0, 4));
    if (!Number.isFinite(y)) continue;
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  min = Math.min(min, currentYear - 2);
  max = Math.max(max, currentYear + 1);
  const years: number[] = [];
  for (let y = max; y >= min; y--) years.push(y);
  return years;
}

export function CalendarView({
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
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<DiaryEntry | null>(null);

  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const isDrafting = draftingDate === selectedDate;
  const isEditingHere = Boolean(editingEntry && editingEntry.date === selectedDate);
  const isEditing = isDrafting || isEditingHere;

  useEffect(() => {
    if (!draftingDate) return;
    const [y, m] = draftingDate.split('-').map(Number);
    setSelectedDate(draftingDate);
    setYear(y);
    setMonthIndex(m - 1);
  }, [draftingDate]);

  useEffect(() => {
    if (!editingEntry) return;
    const [y, m] = editingEntry.date.split('-').map(Number);
    setSelectedDate(editingEntry.date);
    setYear(y);
    setMonthIndex(m - 1);
  }, [editingEntry]);

  const marked = useMemo(() => datesWithEntries(entries), [entries]);
  const grid = useMemo(() => buildMonthGrid(year, monthIndex), [year, monthIndex]);
  const dayEntries = entriesForDate(entries, selectedDate).filter(
    (entry) => entry.id !== editingEntry?.id,
  );
  const currentYear = now.getFullYear();
  const years = useMemo(() => yearOptions(entries, currentYear), [entries, currentYear]);

  function goMonth(delta: number) {
    const next = shiftMonth(year, monthIndex, delta);
    setYear(next.year);
    setMonthIndex(next.monthIndex);
  }

  function jumpTo(nextYear: number, nextMonthIndex: number, date?: string) {
    setYear(nextYear);
    setMonthIndex(nextMonthIndex);
    setViewingEntry(null);
    if (date) {
      setSelectedDate(date);
      return;
    }
    const day = Math.min(
      Number(selectedDate.slice(8, 10)) || 1,
      new Date(nextYear, nextMonthIndex + 1, 0).getDate(),
    );
    setSelectedDate(
      `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    );
  }

  function goThisMonth() {
    const d = new Date();
    jumpTo(d.getFullYear(), d.getMonth(), todayISO());
  }

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startLongPress() {
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setViewingEntry(null);
      setPreviewOpen(true);
    }, LONG_PRESS_MS);
  }

  function handleThisMonthClick() {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    goThisMonth();
  }

  function handlePreviewSelect(date: string) {
    const [y, m] = date.split('-').map(Number);
    jumpTo(y, m - 1, date);
    setPreviewOpen(false);
  }

  return (
    <section className="view">
      <header className="view__header view__header--calendar">
        <div className="month-pickers" role="group" aria-label="选择年月">
          <label className="month-picker">
            <span className="sr-only">年份</span>
            <select
              value={year}
              onChange={(e) => jumpTo(Number(e.target.value), monthIndex)}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>
          </label>
          <label className="month-picker">
            <span className="sr-only">月份</span>
            <select
              value={monthIndex}
              onChange={(e) => jumpTo(year, Number(e.target.value))}
            >
              {MONTHS.map((m, index) => (
                <option key={m} value={index}>
                  {m}月
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="month-nav">
          <button type="button" className="btn-ghost" onClick={() => goMonth(-1)} aria-label="上个月">
            ‹
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleThisMonthClick}
            onPointerDown={startLongPress}
            onPointerUp={clearLongPress}
            onPointerLeave={clearLongPress}
            onPointerCancel={clearLongPress}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="本月"
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
                onClick={() => {
                  setViewingEntry(null);
                  setSelectedDate(cell.date);
                }}
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
          {!isEditing && (
            <button
              type="button"
              className="btn-primary btn-primary--sm"
              onClick={() => {
                setViewingEntry(null);
                onCreate(selectedDate);
              }}
            >
              新建
            </button>
          )}
        </div>
        {isDrafting && (
          <InlineComposer
            date={selectedDate}
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
            initialVoices={editingEntry.voices}
            knownTags={knownTags}
            onSave={onSaveEditor}
            onCancel={onCancelEditor}
          />
        )}
        <EntryList
          entries={dayEntries}
          emptyText={isEditing ? '' : '暂无'}
          onSelect={setViewingEntry}
          onDelete={onDelete}
        />
      </div>

      {viewingEntry && (
        <EntryPeek
          entry={viewingEntry}
          onClose={() => setViewingEntry(null)}
          onEdit={(entry) => {
            setViewingEntry(null);
            onSelect(entry);
          }}
        />
      )}
      {previewOpen && (
        <CalendarScrollPreview
          marked={marked}
          selectedDate={selectedDate}
          onSelectDate={handlePreviewSelect}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </section>
  );
}
