import { useMemo, useRef, useState } from 'react';
import type { DiaryEntry, DiaryStore, SearchFilters } from '../types';
import {
  collectAllTags,
  countUniqueDays,
  filterEntries,
} from '../search';
import { readStoreFromFile } from '../storage';
import {
  formatBackupTime,
  intervalLabel,
  runBackupExport,
  saveBackupPrefs,
  type BackupIntervalDays,
  type BackupPrefs,
} from '../backup';
import { formatDisplayDate } from '../dateUtils';
import { EntryList } from './EntryList';

type Props = {
  store: DiaryStore;
  backupPrefs: BackupPrefs;
  onBackupPrefsChange: (prefs: BackupPrefs) => void;
  onSelect: (entry: DiaryEntry) => void;
  onReplace: (store: DiaryStore) => void;
  onMerge: (store: DiaryStore) => void;
};

const emptyFilters: SearchFilters = {
  keyword: '',
  year: '',
  month: '',
  day: '',
  tags: [],
};

const INTERVALS: BackupIntervalDays[] = [1, 3, 7];

export function DataView({
  store,
  backupPrefs,
  onBackupPrefsChange,
  onSelect,
  onReplace,
  onMerge,
}: Props) {
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const [tagDraft, setTagDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingMode = useRef<'merge' | 'replace' | null>(null);

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
    const tag = tagDraft.trim().toLowerCase();
    if (!tag) return;
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag],
    }));
    setTagDraft('');
  }

  async function handleFile(file: File | undefined) {
    if (!file || !pendingMode.current) return;
    const mode = pendingMode.current;
    pendingMode.current = null;
    try {
      const imported = await readStoreFromFile(file);
      if (mode === 'replace') {
        if (
          !window.confirm(
            `覆盖导入将替换当前全部 ${store.entries.length} 条日记，确定继续？`,
          )
        ) {
          return;
        }
        onReplace(imported);
        setMessage(`已覆盖导入 ${imported.entries.length} 条日记`);
      } else {
        onMerge(imported);
        setMessage(`已合并导入 ${imported.entries.length} 条日记`);
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

  function handleManualExport() {
    const next = runBackupExport(store, backupPrefs);
    onBackupPrefsChange(next);
    setMessage('已导出备份文件');
    setError(null);
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
          <p className="eyebrow">数据管理</p>
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
                    className={`tag${filters.tags.includes(tag) ? ' is-active' : ''}`}
                    onClick={() => toggleTag(tag)}
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
                placeholder="输入标签筛选"
              />
              <button type="button" className="btn-ghost btn-ghost--match" onClick={addTagFilter}>
                添加
              </button>
            </div>
            {filters.tags.length > 0 && (
              <p className="hint">已选：{filters.tags.join('、')}（任一匹配）</p>
            )}
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
                清空条件
              </button>
              <span className="hint hint--inline">{results.length} 条结果</span>
            </div>
          )}
        </div>
      </div>

      {isSearching && (
        <div className="search-results">
          {results.map((entry) => (
            <div key={entry.id} className="search-result">
              <p className="search-result__date">{formatDisplayDate(entry.date)}</p>
              <EntryList entries={[entry]} onSelect={onSelect} />
            </div>
          ))}
          {results.length === 0 && (
            <p className="empty-hint">没有符合条件的日记。</p>
          )}
        </div>
      )}

      <div className="panel">
        <h2 className="panel__title">自动备份</h2>
        <div className="panel__stack">
          <p className="panel__desc">
            到期后保存日记时自动导出；打开应用也会提醒。
          </p>
          <label className="switch-row">
            <span>启用自动备份</span>
            <input
              type="checkbox"
              checked={backupPrefs.enabled}
              onChange={(e) => updateBackup({ enabled: e.target.checked })}
            />
          </label>
          <div className="field field--flush">
            <span className="field__label">提醒间隔</span>
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
          <p className="meta-line">上次备份：{formatBackupTime(backupPrefs.lastBackupAt)}</p>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">备份</h2>
        <div className="panel__stack">
          <p className="panel__desc">
            数据只存在本机，请把导出的 JSON 存到网盘或电脑。
          </p>
          <div className="import-actions">
            <button
              type="button"
              className="btn-block btn-block--accent"
              onClick={handleManualExport}
            >
              导出 JSON
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
            accept="application/json,.json"
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
