import type { DiaryEntry, SearchFilters } from './types';
import { normalizeTag } from './storage';

export function filterEntries(
  entries: DiaryEntry[],
  filters: SearchFilters,
): DiaryEntry[] {
  const keyword = filters.keyword.trim().toLowerCase();
  const year = filters.year.trim();
  const monthRaw = filters.month.trim();
  const dayRaw = filters.day.trim();
  const month = monthRaw ? monthRaw.padStart(2, '0') : '';
  const day = dayRaw ? dayRaw.padStart(2, '0') : '';
  const tags = filters.tags.map(normalizeTag).filter(Boolean);

  return entries
    .filter((entry) => {
      if (keyword) {
        const haystack = `${entry.title}\n${entry.content}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }

      const [ey, em, ed] = entry.date.split('-');
      if (year && ey !== year) return false;
      if (month && em !== month) return false;
      if (day && ed !== day) return false;

      if (tags.length > 0) {
        const hasAny = tags.some((tag) => entry.tags.includes(tag));
        if (!hasAny) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
}

export function collectAllTags(entries: DiaryEntry[]): string[] {
  const set = new Set<string>();
  for (const entry of entries) {
    for (const tag of entry.tags) set.add(tag);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
}

export function countUniqueDays(entries: DiaryEntry[]): number {
  return new Set(entries.map((e) => e.date)).size;
}

export function datesWithEntries(entries: DiaryEntry[]): Set<string> {
  return new Set(entries.map((e) => e.date));
}

export function entriesForDate(entries: DiaryEntry[], date: string): DiaryEntry[] {
  return entries
    .filter((e) => e.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
