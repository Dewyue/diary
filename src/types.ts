export type DiaryEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  content: string;
  tags: string[];
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
  | { mode: 'create'; date: string }
  | { mode: 'edit'; entry: DiaryEntry };
