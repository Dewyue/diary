import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiaryEntry, DiaryStore, EditorState, TabId } from './types';
import {
  createEntry,
  loadStore,
  mergeStores,
  renameTag,
  saveStore,
  updateEntry,
} from './storage';
import {
  isBackupDue,
  loadBackupPrefs,
  maybeAutoBackup,
  runBackupExport,
  type BackupPrefs,
} from './backup';
import { collectAllTags } from './search';
import { BottomNav } from './components/BottomNav';
import { TodayView } from './components/TodayView';
import { CalendarView } from './components/CalendarView';
import { DataView } from './components/DataView';
import { EntryForm } from './components/EntryForm';
import { BackupBanner } from './components/BackupBanner';
import './styles.css';

export default function App() {
  const [store, setStore] = useState<DiaryStore>(() => loadStore());
  const [tab, setTab] = useState<TabId>('today');
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [backupPrefs, setBackupPrefs] = useState<BackupPrefs>(() => loadBackupPrefs());
  const [bannerSnoozed, setBannerSnoozed] = useState(false);
  const knownTags = useMemo(
    () => collectAllTags(store.entries),
    [store.entries],
  );

  const showBackupBanner =
    !bannerSnoozed &&
    backupPrefs.enabled &&
    store.entries.length > 0 &&
    isBackupDue(backupPrefs) &&
    editor.mode === 'closed';

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const persist = useCallback((next: DiaryStore) => {
    saveStore(next);
    setStore(next);
  }, []);

  function handleCreate(date: string) {
    setEditor({ mode: 'create', date });
  }

  function handleSelect(entry: DiaryEntry) {
    setEditor({ mode: 'edit', entry });
  }

  function handleSave(payload: {
    content: string;
    tags: string[];
    date: string;
  }) {
    try {
      let nextStore = store;
      if (editor.mode === 'create') {
        const entry = createEntry(payload.date, payload.content, payload.tags);
        nextStore = { version: 1, entries: [...store.entries, entry] };
      } else if (editor.mode === 'edit') {
        const updated = updateEntry(
          editor.entry,
          payload.content,
          payload.tags,
          payload.date,
        );
        nextStore = {
          version: 1,
          entries: store.entries.map((e) => (e.id === updated.id ? updated : e)),
        };
      }
      persist(nextStore);
      setEditor({ mode: 'closed' });

      const auto = maybeAutoBackup(nextStore, backupPrefs);
      if (auto) {
        setBackupPrefs(auto);
        setBannerSnoozed(false);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '保存失败');
    }
  }

  function handleDelete(entry: DiaryEntry) {
    persist({
      version: 1,
      entries: store.entries.filter((e) => e.id !== entry.id),
    });
    if (editor.mode === 'edit' && editor.entry.id === entry.id) {
      setEditor({ mode: 'closed' });
    }
  }

  function handleBannerExport() {
    const next = runBackupExport(store, backupPrefs);
    setBackupPrefs(next);
    setBannerSnoozed(false);
  }

  return (
    <div className="app">
      <main className="app__main">
        <BackupBanner
          visible={showBackupBanner}
          onExport={handleBannerExport}
          onLater={() => setBannerSnoozed(true)}
        />

        {tab === 'today' && (
          <TodayView
            entries={store.entries}
            onCreate={handleCreate}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        )}
        {tab === 'calendar' && (
          <CalendarView
            entries={store.entries}
            onCreate={handleCreate}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        )}
        {tab === 'data' && (
          <DataView
            store={store}
            backupPrefs={backupPrefs}
            onBackupPrefsChange={setBackupPrefs}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onReplace={(incoming) => persist(incoming)}
            onMerge={(incoming) => persist(mergeStores(store, incoming))}
            onRenameTag={(from, to) => persist(renameTag(store, from, to))}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />

      {editor.mode === 'create' && (
        <EntryForm
          mode="create"
          date={editor.date}
          knownTags={knownTags}
          onSave={handleSave}
          onCancel={() => setEditor({ mode: 'closed' })}
        />
      )}
      {editor.mode === 'edit' && (
        <EntryForm
          mode="edit"
          date={editor.entry.date}
          entry={editor.entry}
          knownTags={knownTags}
          onSave={handleSave}
          onCancel={() => setEditor({ mode: 'closed' })}
        />
      )}
    </div>
  );
}
