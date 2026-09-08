/** Audio clip metadata; the blob lives in IndexedDB keyed by id. */
export type VoiceClip = {
  id: string;
  mimeType: string;
  durationMs: number;
  createdAt: string;
};

export type DiaryEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  content: string;
  tags: string[];
  voices?: VoiceClip[];
  createdAt: string;
  updatedAt: string;
};

export type DiaryStore = {
  version: 1;
  entries: DiaryEntry[];
};

export type TabId = 'today' | 'calendar' | 'data';

export type SearchFilters = {
  keyword: string;
  year: string;
  month: string;
  day: string;
  tags: string[];
};

export type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; date: string; startWithVoice?: boolean }
  | { mode: 'edit'; entry: DiaryEntry };

export type EntryDraft = {
  content: string;
  tags: string[];
  date: string;
  voices: VoiceClip[];
};
