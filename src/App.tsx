import { useCallback, useEffect, useState } from 'react';
import type { DiaryEntry, DiaryStore, EditorState, TabId } from './types';
import {
  createEntry,
  loadStore,
  mergeStores,
  saveStore,
  updateEntry,
} from './storage';
import { BottomNav } from './components/BottomNav';
import { TodayView } from './components/TodayView';
import { CalendarView } from './components/CalendarView';
import { DataView } from './components/DataView';
import { EntryForm } from './components/EntryForm';
import './styles.css';

export default function App() {
  const [store, setStore] = useState<DiaryStore>(() => loadStore());
  const [tab, setTab] = useState<TabId>('today');
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });

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
    title: string;
    content: string;
    tags: string[];
    date: string;
  }) {
    try {
      if (editor.mode === 'create') {
        const entry = createEntry(
          payload.date,
          payload.title,
          payload.content,
          payload.tags,
        );
        persist({ version: 1, entries: [...store.entries, entry] });
      } else if (editor.mode === 'edit') {
        const updated = updateEntry(
          editor.entry,
          payload.title,
          payload.content,
          payload.tags,
          payload.date,
        );
        persist({
          version: 1,
          entries: store.entries.map((e) => (e.id === updated.id ? updated : e)),
        });
      }
      setEditor({ mode: 'closed' });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '保存失败');
    }
  }

  function handleDelete() {
    if (editor.mode !== 'edit') return;
    const id = editor.entry.id;
    persist({
      version: 1,
      entries: store.entries.filter((e) => e.id !== id),
    });
    setEditor({ mode: 'closed' });
  }

  return (
    <div className="app">
      <main className="app__main">
        {tab === 'today' && (
          <TodayView
            entries={store.entries}
            onCreate={handleCreate}
            onSelect={handleSelect}
          />
        )}
        {tab === 'calendar' && (
          <CalendarView
            entries={store.entries}
            onCreate={handleCreate}
            onSelect={handleSelect}
          />
        )}
        {tab === 'data' && (
          <DataView
            store={store}
            onSelect={handleSelect}
            onReplace={(incoming) => persist(incoming)}
            onMerge={(incoming) => persist(mergeStores(store, incoming))}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />

      {editor.mode === 'create' && (
        <EntryForm
          mode="create"
          date={editor.date}
          onSave={handleSave}
          onCancel={() => setEditor({ mode: 'closed' })}
        />
      )}
      {editor.mode === 'edit' && (
        <EntryForm
          mode="edit"
          date={editor.entry.date}
          entry={editor.entry}
          onSave={handleSave}
          onCancel={() => setEditor({ mode: 'closed' })}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
