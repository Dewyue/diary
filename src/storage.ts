import type { DiaryEntry, DiaryStore } from './types';

const STORAGE_KEY = 'diary.store.v1';

export function emptyStore(): DiaryStore {
  return { version: 1, entries: [] };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isEntry(value: unknown): value is DiaryEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.date === 'string' &&
    typeof e.title === 'string' &&
    typeof e.content === 'string' &&
    isStringArray(e.tags) &&
    typeof e.createdAt === 'string' &&
    typeof e.updatedAt === 'string'
  );
}

export function parseStore(raw: unknown): DiaryStore {
  if (!raw || typeof raw !== 'object') {
    throw new Error('无效的日记文件格式');
  }
  const data = raw as Record<string, unknown>;
  if (data.version !== 1) {
    throw new Error('不支持的数据版本');
  }
  if (!Array.isArray(data.entries) || !data.entries.every(isEntry)) {
    throw new Error('日记条目格式不正确');
  }
  return {
    version: 1,
    entries: data.entries.map((entry) => ({
      ...entry,
      tags: entry.tags.map(normalizeTag).filter(Boolean),
    })),
  };
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function loadStore(): DiaryStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    return parseStore(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

export function saveStore(store: DiaryStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    throw new Error('无法保存到本地，请检查浏览器是否开启了无痕模式或存储权限');
  }
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEntry(
  date: string,
  content: string,
  tags: string[],
): DiaryEntry {
  const now = new Date().toISOString();
  return {
    id: createId(),
    date,
    title: '',
    content: content.trim(),
    tags: [...new Set(tags.map(normalizeTag).filter(Boolean))],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateEntry(
  entry: DiaryEntry,
  content: string,
  tags: string[],
  date?: string,
): DiaryEntry {
  return {
    ...entry,
    date: date ?? entry.date,
    title: '',
    content: content.trim(),
    tags: [...new Set(tags.map(normalizeTag).filter(Boolean))],
    updatedAt: new Date().toISOString(),
  };
}

/** Rename a tag across all entries; merges into `to` if it already exists. */
export function renameTag(
  store: DiaryStore,
  fromRaw: string,
  toRaw: string,
): DiaryStore {
  const from = normalizeTag(fromRaw);
  const to = normalizeTag(toRaw);
  if (!from || !to || from === to) return store;

  let changed = false;
  const now = new Date().toISOString();
  const entries = store.entries.map((entry) => {
    if (!entry.tags.includes(from)) return entry;
    changed = true;
    return {
      ...entry,
      tags: [...new Set(entry.tags.map((tag) => (tag === from ? to : tag)))],
      updatedAt: now,
    };
  });

  return changed ? { version: 1, entries } : store;
}

/** Merge by id; keep the entry with newer updatedAt when ids collide. */
export function mergeStores(current: DiaryStore, incoming: DiaryStore): DiaryStore {
  const map = new Map<string, DiaryEntry>();
  for (const entry of current.entries) {
    map.set(entry.id, entry);
  }
  for (const entry of incoming.entries) {
    const existing = map.get(entry.id);
    if (!existing || entry.updatedAt >= existing.updatedAt) {
      map.set(entry.id, entry);
    }
  }
  return {
    version: 1,
    entries: Array.from(map.values()),
  };
}

export function exportStoreToFile(store: DiaryStore): void {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const blob = new Blob([JSON.stringify(store, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diary-${date}-${time}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function readStoreFromFile(file: File): Promise<DiaryStore> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        resolve(parseStore(JSON.parse(text)));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('无法解析 JSON 文件'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
