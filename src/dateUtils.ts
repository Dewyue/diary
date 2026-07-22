const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function todayISO(): string {
  return formatISODate(new Date());
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(iso: string): string {
  const date = parseISODate(iso);
  const weekday = WEEKDAYS[date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 周${weekday}`;
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return `${year}年${monthIndex + 1}月`;
}

export function shiftMonth(year: number, monthIndex: number, delta: number): {
  year: number;
  monthIndex: number;
} {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
};

/** Build a 6x7 calendar grid starting on Sunday. */
export function buildMonthGrid(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(year, monthIndex, 1);
  const startOffset = first.getDay();
  const start = new Date(year, monthIndex, 1 - startOffset);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: formatISODate(d),
      day: d.getDate(),
      inMonth: d.getMonth() === monthIndex,
    });
  }

  return cells;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
