import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { EntryDraft, VoiceClip } from '../types';
import { normalizeTag } from '../storage';
import { deleteVoiceBlobs } from '../voiceDb';
import { VoiceRecorder } from './VoiceRecorder';

type Props = {
  date: string;
  initialContent?: string;
  initialTags?: string[];
  initialVoices?: VoiceClip[];
  knownTags?: string[];
  startWithVoice?: boolean;
  onSave: (payload: EntryDraft) => void;
  onCancel: () => void;
};

export function InlineComposer({
  date,
  initialContent = '',
  initialTags = [],
  initialVoices = [],
  knownTags = [],
  startWithVoice = false,
  onSave,
  onCancel,
}: Props) {
  const contentId = useId();
  const tagId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState('');
  const [voices, setVoices] = useState<VoiceClip[]>(initialVoices);

  const initialVoiceIdsRef = useRef(new Set(initialVoices.map((v) => v.id)));
  const createdIdsRef = useRef(new Set<string>());
  const committedRef = useRef(false);
  const voicesRef = useRef(voices);
  voicesRef.current = voices;

  useEffect(() => {
    return () => {
      if (committedRef.current) return;
      const leftover = [...createdIdsRef.current];
      if (leftover.length > 0) void deleteVoiceBlobs(leftover);
    };
  }, []);

  useEffect(() => {
    if (startWithVoice) return;
    const id = window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
    return () => window.cancelAnimationFrame(id);
  }, [startWithVoice]);

  function handleVoicesChange(next: VoiceClip[]) {
    const initialIds = initialVoiceIdsRef.current;
    for (const clip of next) {
      if (!initialIds.has(clip.id)) createdIdsRef.current.add(clip.id);
    }
    setVoices(next);
  }

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
    const currentVoices = voicesRef.current;
    if (!content.trim() && currentVoices.length === 0) {
      window.alert('请填写内容或录一段语音');
      return;
    }
    const finalTags = tagInput.trim()
      ? [...new Set([...tags, normalizeTag(tagInput)])]
      : tags;
    const currentIds = new Set(currentVoices.map((v) => v.id));
    const toDelete = [
      ...[...initialVoiceIdsRef.current].filter((id) => !currentIds.has(id)),
      ...[...createdIdsRef.current].filter((id) => !currentIds.has(id)),
    ];
    committedRef.current = true;
    if (toDelete.length > 0) void deleteVoiceBlobs(toDelete);
    onSave({
      content,
      tags: finalTags.filter(Boolean),
      date,
      voices: currentVoices,
    });
  }

  function handleContentKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form
      className="inline-composer"
      onSubmit={handleSubmit}
      autoComplete="off"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="inline-composer__toolbar">
        <button type="button" className="btn-text" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn-text btn-text--accent">
          完成
        </button>
      </div>

      <VoiceRecorder
        voices={voices}
        onChange={handleVoicesChange}
        autoStart={startWithVoice}
      />

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
