import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { DiaryEntry } from '../types';
import { normalizeTag } from '../storage';
import { formatDisplayDate } from '../dateUtils';

type Props = {
  mode: 'create' | 'edit';
  date: string;
  entry?: DiaryEntry;
  onSave: (payload: {
    title: string;
    content: string;
    tags: string[];
    date: string;
  }) => void;
  onCancel: () => void;
  onDelete?: () => void;
};

export function EntryForm({
  mode,
  date: initialDate,
  entry,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const titleId = useId();
  const contentId = useId();
  const tagId = useId();
  const dateId = useId();

  const [title, setTitle] = useState(entry?.title ?? '');
  const [content, setContent] = useState(entry?.content ?? '');
  const [date, setDate] = useState(entry?.date ?? initialDate);
  const [tags, setTags] = useState<string[]>(entry?.tags ?? []);
  const [tagInput, setTagInput] = useState('');

  function addTag(raw: string) {
    const tag = normalizeTag(raw);
    if (!tag) return;
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setTagInput('');
  }

  function handleTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput.replace(/,/g, ''));
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const nextDate = date || initialDate;
    if (!nextDate) {
      window.alert('请选择日期');
      return;
    }
    if (!title.trim() && !content.trim()) {
      window.alert('请至少填写标题或正文');
      return;
    }
    const finalTags = tagInput.trim()
      ? [...new Set([...tags, normalizeTag(tagInput)])]
      : tags;
    onSave({
      title,
      content,
      tags: finalTags.filter(Boolean),
      date: nextDate,
    });
  }

  function handleDelete() {
    if (!onDelete) return;
    if (window.confirm('确定删除这条日记？此操作不可撤销。')) {
      onDelete();
    }
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="sheet__backdrop"
        aria-label="关闭"
        onClick={onCancel}
      />
      <form
        className="sheet__panel"
        onSubmit={handleSubmit}
        autoComplete="off"
      >
        <header className="sheet__header">
          <button type="button" className="btn-text" onClick={onCancel}>
            取消
          </button>
          <h2 id={titleId} className="sheet__title">
            {mode === 'create' ? '写日记' : '编辑日记'}
          </h2>
          <button
            type="button"
            className="btn-text btn-text--accent"
            onClick={() => handleSubmit()}
          >
            保存
          </button>
        </header>

        <div className="sheet__body">
          <p className="sheet__date-label">{formatDisplayDate(date || initialDate)}</p>

          <label className="field" htmlFor={dateId}>
            <span className="field__label">日期</span>
            <input
              id={dateId}
              name="diary-date"
              type="date"
              value={date || initialDate}
              onChange={(e) => setDate(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="field" htmlFor={`${titleId}-input`}>
            <span className="field__label">标题</span>
            <input
              id={`${titleId}-input`}
              name="diary-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给这一刻起个名字"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
            />
          </label>

          <label className="field" htmlFor={contentId}>
            <span className="field__label">正文</span>
            <textarea
              id={contentId}
              name="diary-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下今天的想法…"
              rows={8}
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="sentences"
            />
          </label>

          <div className="field">
            <span className="field__label" id={tagId}>
              标签
            </span>
            <div className="tag-input" aria-labelledby={tagId}>
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="tag tag--removable"
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                >
                  {tag} ×
                </button>
              ))}
              <input
                type="text"
                name="diary-tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                onBlur={() => {
                  if (tagInput.trim()) addTag(tagInput);
                }}
                placeholder={tags.length ? '' : '回车或逗号添加'}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
              />
            </div>
          </div>

          {mode === 'edit' && onDelete && (
            <button type="button" className="btn-danger" onClick={handleDelete}>
              删除这条日记
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
