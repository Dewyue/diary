import { useMemo, useRef, useState } from 'react';
import type { DiaryEntry, DiaryStore, EntryDraft, SearchFilters } from '../types';
import {
  collectAllTags,
  countUniqueDays,
  filterEntries,
} from '../search';
import { normalizeTag } from '../storage';
import {
  formatBackupTime,
  intervalLabel,
  runBackupExport,
  saveBackupPrefs,
  type BackupIntervalDays,
  type BackupPrefs,
} from '../backup';
import { readBackupFromFile, type ImportedBackup } from '../voiceBackup';
import { formatDisplayDate } from '../dateUtils';
import { EntryList } from './EntryList';
import { InlineComposer } from './InlineComposer';

type Props = {
  store: DiaryStore;
  backupPrefs: BackupPrefs;
  onBackupPrefsChange: (prefs: BackupPrefs) => void;
  editingEntry: DiaryEntry | null;
  knownTags: string[];
  onSelect: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
  onCancelEditor: () => void;
  onSaveEditor: (payload: EntryDraft) => void;
  onImport: (incoming: ImportedBackup, mode: 'merge' | 'replace') => Promise<void>;
  onRenameTag: (from: string, to: string) => void;
};

const emptyFilters: SearchFilters = {
  keyword: '',
  year: '',
  month: '',
  day: '',
  tags: [],
};

const INTERVALS: BackupIntervalDays[] = [1, 3, 7];
const LONG_PRESS_MS = 480;

export function DataView({
  store,
  backupPrefs,
  onBackupPrefsChange,
  editingEntry,
  knownTags,
  onSelect,
  onDelete,
  onCancelEditor,
  onSaveEditor,
  onImport,
  onRenameTag,
}: Props) {
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [tagDraft, setTagDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingMode = useRef<'merge' | 'replace' | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const longPressTag = useRef<string | null>(null);

  const allTags = useMemo(() => collectAllTags(store.entries), [store.entries]);
  const isSearching = Boolean(
    filters.keyword.trim() ||
      filters.year.trim() ||
      filters.month.trim() ||
      filters.day.trim() ||
      filters.tags.length > 0,
  );
  const results = useMemo(
    () => (isSearching ? filterEntries(store.entries, filters) : []),
    [store.entries, filters, isSearching],
  );
  const dayCount = countUniqueDays(store.entries);

  function updateFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(tag: string) {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  }

  function addTagFilter() {
    const tag = normalizeTag(tagDraft);
    if (!tag) return;
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag],
    }));
    setTagDraft('');
  }

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function startTagLongPress(tag: string) {
    longPressTriggered.current = false;
    longPressTag.current = tag;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      const from = longPressTag.current;
      if (!from) return;
      const raw = window.prompt('改名', from);
      if (raw == null) return;
      const next = normalizeTag(raw);
      if (!next || next === from) return;
      onRenameTag(from, next);
      setFilters((prev) => ({
        ...prev,
        tags: [...new Set(prev.tags.map((t) => (t === from ? next : t)))],
      }));
    }, LONG_PRESS_MS);
  }

  function handleTagClick(tag: string) {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    toggleTag(tag);
  }

  async function handleFile(file: File | undefined) {
    if (!file || !pendingMode.current) return;
    const mode = pendingMode.current;
    pendingMode.current = null;
    try {
      const imported = await readBackupFromFile(file);
      if (mode === 'replace') {
        if (
          !window.confirm(
            `覆盖导入将替换当前全部 ${store.entries.length} 条日记，确定继续？`,
          )
        ) {
          return;
        }
        await onImport(imported, 'replace');
        setMessage(`已覆盖导入 ${imported.store.entries.length} 条日记`);
      } else {
        await onImport(imported, 'merge');
        setMessage(`已合并导入 ${imported.store.entries.length} 条日记`);
      }
      setError(null);
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : '导入失败');
    }
  }

  function startImport(mode: 'merge' | 'replace') {
    pendingMode.current = mode;
    fileRef.current?.click();
  }

  async function handleManualExport() {
    try {
      const next = await runBackupExport(store, backupPrefs);
      onBackupPrefsChange(next);
      setMessage('已导出备份文件');
      setError(null);
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : '导出失败');
    }
  }

  function updateBackup(partial: Partial<BackupPrefs>) {
    const next = { ...backupPrefs, ...partial };
    saveBackupPrefs(next);
    onBackupPrefsChange(next);
  }

  return (
    <section className="view data-view">
      <header className="view__header view__header--stack">
        <div>
          <p className="eyebrow">数据</p>
          <h1 className="view__title">查找与备份</h1>
        </div>
        <p className="stats">
          共 <strong>{store.entries.length}</strong> 条 ·{' '}
          <strong>{dayCount}</strong> 天有记录
        </p>
      </header>

      <div className="panel">
        <h2 className="panel__title">查找</h2>
        <div className="panel__stack">
          <label className="field field--flush">
            <span className="field__label">关键词</span>
            <input
              type="search"
              value={filters.keyword}
              onChange={(e) => updateFilter('keyword', e.target.value)}
              placeholder="匹配内容"
            />
          </label>

          <div className="date-filters">
            <label className="field field--flush">
              <span className="field__label">年</span>
              <input
                type="number"
                inputMode="numeric"
                min={1970}
                max={2100}
                value={filters.year}
                onChange={(e) => updateFilter('year', e.target.value)}
                placeholder="YYYY"
              />
            </label>
            <label className="field field--flush">
              <span className="field__label">月</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                value={filters.month}
                onChange={(e) => updateFilter('month', e.target.value)}
                placeholder="M"
              />
            </label>
            <label className="field field--flush">
              <span className="field__label">日</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={filters.day}
                onChange={(e) => updateFilter('day', e.target.value)}
                placeholder="D"
              />
            </label>
          </div>

          <div className="field field--flush">
            <span className="field__label">标签</span>
            {allTags.length > 0 && (
              <div className="tag-filter">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`tag tag--filter${filters.tags.includes(tag) ? ' is-active' : ''}`}
                    onClick={() => handleTagClick(tag)}
                    onPointerDown={() => startTagLongPress(tag)}
                    onPointerUp={clearLongPress}
                    onPointerLeave={clearLongPress}
                    onPointerCancel={clearLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <div className="tag-add-row">
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTagFilter();
                  }
                }}
                placeholder="标签"
              />
              <button type="button" className="btn-ghost btn-ghost--match" onClick={addTagFilter}>
                添加
              </button>
            </div>
          </div>

          {isSearching && (
            <div className="row-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setFilters(emptyFilters);
                  setTagDraft('');
                }}
              >
                清空
              </button>
              <span className="hint hint--inline">{results.length}</span>
            </div>
          )}
        </div>
      </div>

      {isSearching && (
        <div className="search-results">
          {editingEntry && results.some((entry) => entry.id === editingEntry.id) && (
            <div className="search-result">
              <p className="search-result__date">{formatDisplayDate(editingEntry.date)}</p>
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
            </div>
          )}
          {results
            .filter((entry) => entry.id !== editingEntry?.id)
            .map((entry) => (
              <div key={entry.id} className="search-result">
                <p className="search-result__date">{formatDisplayDate(entry.date)}</p>
                <EntryList entries={[entry]} onSelect={onSelect} onDelete={onDelete} />
              </div>
            ))}
          {results.length === 0 && (
            <p className="empty-hint">暂无</p>
          )}
        </div>
      )}

      <div className="panel">
        <h2 className="panel__title">自动备份</h2>
        <div className="panel__stack">
          <label className="switch-row">
            <span>启用</span>
            <input
              type="checkbox"
              checked={backupPrefs.enabled}
              onChange={(e) => updateBackup({ enabled: e.target.checked })}
            />
          </label>
          <div className="field field--flush">
            <span className="field__label">间隔</span>
            <div className="segmented">
              {INTERVALS.map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`segmented__item${backupPrefs.intervalDays === days ? ' is-active' : ''}`}
                  onClick={() => updateBackup({ intervalDays: days })}
                  disabled={!backupPrefs.enabled}
                >
                  {intervalLabel(days)}
                </button>
              ))}
            </div>
          </div>
          <p className="meta-line">上次：{formatBackupTime(backupPrefs.lastBackupAt)}</p>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">备份</h2>
        <div className="panel__stack">
          <div className="import-actions">
            <button
              type="button"
              className="btn-block btn-block--accent"
              onClick={handleManualExport}
            >
              导出备份
            </button>
            <button type="button" className="btn-block" onClick={() => startImport('merge')}>
              合并导入
            </button>
            <button type="button" className="btn-block" onClick={() => startImport('replace')}>
              覆盖导入
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,application/zip,.zip"
            hidden
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {message && <p className="feedback feedback--ok">{message}</p>}
          {error && <p className="feedback feedback--err">{error}</p>}
        </div>
      </div>
    </section>
  );
}
