import type { DiaryStore } from './types';
import { exportDiaryBackup } from './voiceBackup';

const BACKUP_KEY = 'diary.backup.v1';

export type BackupIntervalDays = 1 | 3 | 7;

export type BackupPrefs = {
  enabled: boolean;
  intervalDays: BackupIntervalDays;
  lastBackupAt: string | null;
};

const DEFAULT_PREFS: BackupPrefs = {
  enabled: true,
  intervalDays: 1,
  lastBackupAt: null,
};

export function loadBackupPrefs(): BackupPrefs {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const data = JSON.parse(raw) as Partial<BackupPrefs>;
    const intervalDays =
      data.intervalDays === 1 || data.intervalDays === 3 || data.intervalDays === 7
        ? data.intervalDays
        : DEFAULT_PREFS.intervalDays;
    return {
      enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_PREFS.enabled,
      intervalDays,
      lastBackupAt:
        typeof data.lastBackupAt === 'string' || data.lastBackupAt === null
          ? data.lastBackupAt
          : null,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveBackupPrefs(prefs: BackupPrefs): void {
  localStorage.setItem(BACKUP_KEY, JSON.stringify(prefs));
}

export function isBackupDue(prefs: BackupPrefs = loadBackupPrefs()): boolean {
  if (!prefs.enabled) return false;
  if (!prefs.lastBackupAt) return true;
  const last = Date.parse(prefs.lastBackupAt);
  if (Number.isNaN(last)) return true;
  const elapsedMs = Date.now() - last;
  return elapsedMs >= prefs.intervalDays * 24 * 60 * 60 * 1000;
}

export function markBackupDone(prefs: BackupPrefs = loadBackupPrefs()): BackupPrefs {
  const next = {
    ...prefs,
    lastBackupAt: new Date().toISOString(),
  };
  saveBackupPrefs(next);
  return next;
}

/** Download backup JSON (or zip if there is audio) and record success time. */
export async function runBackupExport(
  store: DiaryStore,
  prefs: BackupPrefs = loadBackupPrefs(),
): Promise<BackupPrefs> {
  await exportDiaryBackup(store);
  return markBackupDone(prefs);
}

/**
 * If auto-backup is on and overdue, export now.
 * Best called from a user gesture (e.g. after tapping 保存).
 */
export async function maybeAutoBackup(
  store: DiaryStore,
  prefs: BackupPrefs = loadBackupPrefs(),
): Promise<BackupPrefs | null> {
  if (!prefs.enabled) return null;
  if (store.entries.length === 0) return null;
  if (!isBackupDue(prefs)) return null;
  return runBackupExport(store, prefs);
}

export function formatBackupTime(iso: string | null): string {
  if (!iso) return '尚未导出过';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '尚未导出过';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function intervalLabel(days: BackupIntervalDays): string {
  if (days === 1) return '每天';
  if (days === 3) return '每 3 天';
  return '每 7 天';
}
