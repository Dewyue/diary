import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiaryEntry, DiaryStore, EditorState, EntryDraft, TabId } from './types';
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
import { BackupBanner } from './components/BackupBanner';
import { collectVoiceIds, persistImportedClips, type ImportedBackup } from './voiceBackup';
import { deleteVoiceBlobs } from './voiceDb';
import { discardAllMic } from './voiceCapture';
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

  const draftingDate = editor.mode === 'create' ? editor.date : null;
  const draftingVoice = editor.mode === 'create' && Boolean(editor.startWithVoice);
  const editingEntry = editor.mode === 'edit' ? editor.entry : null;

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

  function handleCreate(date: string, opts?: { voice?: boolean }) {
    if (!opts?.voice) discardAllMic();
    setEditor({ mode: 'create', date, startWithVoice: Boolean(opts?.voice) });
  }

  function handleSelect(entry: DiaryEntry) {
    setEditor({ mode: 'edit', entry });
  }

  function handleSave(payload: EntryDraft) {
    try {
      let nextStore = store;
      if (editor.mode === 'create') {
        const entry = createEntry(
          payload.date,
          payload.content,
          payload.tags,
          payload.voices,
        );
        nextStore = { version: 1, entries: [...store.entries, entry] };
      } else if (editor.mode === 'edit') {
        const updated = updateEntry(
          editor.entry,
          payload.content,
          payload.tags,
          payload.date,
          payload.voices,
        );
        nextStore = {
          version: 1,
          entries: store.entries.map((e) => (e.id === updated.id ? updated : e)),
        };
      }
      persist(nextStore);
      setEditor({ mode: 'closed' });
      discardAllMic();

      void (async () => {
        const auto = await maybeAutoBackup(nextStore, backupPrefs);
        if (auto) {
          setBackupPrefs(auto);
          setBannerSnoozed(false);
        }
      })();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '保存失败');
    }
  }

  function handleDelete(entry: DiaryEntry) {
    void deleteVoiceBlobs(collectVoiceIds({ version: 1, entries: [entry] }));
    persist({
      version: 1,
      entries: store.entries.filter((e) => e.id !== entry.id),
    });
    if (editor.mode === 'edit' && editor.entry.id === entry.id) {
      setEditor({ mode: 'closed' });
    }
  }

  function handleBannerExport() {
    void (async () => {
      const next = await runBackupExport(store, backupPrefs);
      setBackupPrefs(next);
      setBannerSnoozed(false);
    })();
  }

  function closeEditor() {
    discardAllMic();
    setEditor({ mode: 'closed' });
  }

  async function handleImport(incoming: ImportedBackup, mode: 'merge' | 'replace') {
    await persistImportedClips(incoming.clips);
    if (mode === 'replace') {
      const keep = new Set(collectVoiceIds(incoming.store));
      const orphans = collectVoiceIds(store).filter((id) => !keep.has(id));
      if (orphans.length > 0) await deleteVoiceBlobs(orphans);
      persist(incoming.store);
      return;
    }
    persist(mergeStores(store, incoming.store));
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
            knownTags={knownTags}
            draftingDate={draftingDate}
            draftingVoice={draftingVoice}
            editingEntry={editingEntry}
            onCreate={handleCreate}
            onCancelEditor={closeEditor}
            onSaveEditor={handleSave}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        )}
        {tab === 'calendar' && (
          <CalendarView
            entries={store.entries}
            knownTags={knownTags}
            draftingDate={draftingDate}
            editingEntry={editingEntry}
            onCreate={handleCreate}
            onCancelEditor={closeEditor}
            onSaveEditor={handleSave}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        )}
        {tab === 'data' && (
          <DataView
            store={store}
            backupPrefs={backupPrefs}
            onBackupPrefsChange={setBackupPrefs}
            editingEntry={editingEntry}
            knownTags={knownTags}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onCancelEditor={closeEditor}
            onSaveEditor={handleSave}
            onImport={handleImport}
            onRenameTag={(from, to) => persist(renameTag(store, from, to))}
          />
        )}
      </main>

      <BottomNav
        active={tab}
        onChange={(next) => {
          if (editor.mode !== 'closed') closeEditor();
          setTab(next);
        }}
      />
    </div>
  );
}
