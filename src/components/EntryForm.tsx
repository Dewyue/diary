import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { DiaryEntry } from '../types';
import { normalizeTag } from '../storage';
import { formatDisplayDate } from '../dateUtils';

type Props = {
  mode: 'create' | 'edit';
  date: string;
  entry?: DiaryEntry;
  knownTags?: string[];
  onSave: (payload: {
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
  knownTags = [],
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const headingId = useId();
  const contentId = useId();
  const tagId = useId();
  const dateId = useId();

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

  function toggleKnownTag(tag: string) {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
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
    if (!content.trim()) {
      window.alert('请填写内容');
      return;
    }
    const finalTags = tagInput.trim()
      ? [...new Set([...tags, normalizeTag(tagInput)])]
      : tags;
    onSave({
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
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={headingId}>
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
          <h2 id={headingId} className="sheet__title">
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

          <div className="field">
            <span className="field__label" id={tagId}>
              标签
            </span>

            {knownTags.length > 0 && (
              <div className="tag-options" aria-label="曾用标签">
                {knownTags.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`tag${selected ? ' is-active' : ''}`}
                      onClick={() => toggleKnownTag(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="tag-add-row">
              <input
                type="text"
                name="diary-tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                placeholder="新建标签"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-1p-ignore
                data-lpignore="true"
                aria-labelledby={tagId}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => addTag(tagInput)}
                disabled={!tagInput.trim()}
              >
                添加
              </button>
            </div>

            {tags.length > 0 && (
              <div className="tag-selected" aria-label="已选标签">
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
              </div>
            )}

            {knownTags.length === 0 && (
              <p className="hint">还没有历史标签，输入后点添加即可新建</p>
            )}
          </div>

          <label className="field" htmlFor={contentId}>
            <span className="field__label">内容</span>
            <textarea
              id={contentId}
              name="diary-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下今天的想法…"
              rows={10}
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="sentences"
            />
          </label>

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
