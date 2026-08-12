import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { normalizeTag } from '../storage';

type Props = {
  date: string;
  initialContent?: string;
  initialTags?: string[];
  knownTags?: string[];
  onSave: (payload: { content: string; tags: string[]; date: string }) => void;
  onCancel: () => void;
};

export function InlineComposer({
  date,
  initialContent = '',
  initialTags = [],
  knownTags = [],
  onSave,
  onCancel,
}: Props) {
  const contentId = useId();
  const tagId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

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
      date,
    });
  }

  function handleContentKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form className="inline-composer" onSubmit={handleSubmit} autoComplete="off">
      <div className="inline-composer__toolbar">
        <button type="button" className="btn-text" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn-text btn-text--accent">
          完成
        </button>
      </div>

      <label className="inline-composer__content" htmlFor={contentId}>
        <span className="sr-only">内容</span>
        <textarea
          ref={textareaRef}
          id={contentId}
          name="diary-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleContentKey}
          rows={4}
          placeholder=""
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          enterKeyHint="done"
        />
      </label>

      <div className="inline-composer__tags">
        <span className="sr-only" id={tagId}>
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
            placeholder="标签"
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
      </div>
    </form>
  );
}
