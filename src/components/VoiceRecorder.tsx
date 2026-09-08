import { useEffect, useRef, useState } from 'react';
import type { VoiceClip } from '../types';
import { createId } from '../storage';
import { putVoiceBlob, deleteVoiceBlob } from '../voiceDb';
import {
  formatDuration,
  isSecureForMic,
  isVoiceSupported,
  pickAudioMimeType,
  registerLiveStream,
  restorePendingStream,
  waitForPendingStream,
  releaseStream,
} from '../voiceCapture';
import { VoicePlayer } from './VoicePlayer';

type Props = {
  voices: VoiceClip[];
  onChange: (voices: VoiceClip[]) => void;
  autoStart?: boolean;
};

const MAX_MS = 10 * 60 * 1000;

export function VoiceRecorder({ voices, onChange, autoStart }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const mimeRef = useRef('audio/webm');
  const autoStartedRef = useRef(false);
  const voicesRef = useRef(voices);
  const aliveRef = useRef(true);
  const onChangeRef = useRef(onChange);

  voicesRef.current = voices;
  onChangeRef.current = onChange;

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopTracks() {
    releaseStream(streamRef.current);
    streamRef.current = null;
  }

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimer();
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state === 'recording') recorder.stop();
      }
      const stream = streamRef.current;
      streamRef.current = null;
      if (stream) restorePendingStream(stream);
    };
  }, []);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startRecording();
  }, [autoStart]);

  async function startRecording() {
    setError(null);
    if (!isVoiceSupported()) {
      setError('当前浏览器不支持录音');
      return;
    }
    if (!isSecureForMic()) {
      setError('请用 https 或 localhost 打开');
      return;
    }

    try {
      setBusy(true);
      const pending = await waitForPendingStream();
      const stream =
        pending ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
      if (!aliveRef.current) {
        restorePendingStream(stream);
        return;
      }
      registerLiveStream(stream);
      streamRef.current = stream;
      const mimeType = pickAudioMimeType();
      mimeRef.current = mimeType ?? 'audio/webm';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setElapsedMs(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void finalizeRecording();
      };

      recorder.start(250);
      setRecording(true);
      clearTimer();
      timerRef.current = window.setInterval(() => {
        const ms = Date.now() - startedAtRef.current;
        setElapsedMs(ms);
        if (ms >= MAX_MS && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 200);
    } catch {
      stopTracks();
      setError('未获得麦克风权限');
    } finally {
      setBusy(false);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false);
      clearTimer();
      stopTracks();
      return;
    }
    recorder.stop();
  }

  async function finalizeRecording() {
    clearTimer();
    setRecording(false);
    const durationMs = Math.max(400, Date.now() - startedAtRef.current);
    const mimeType = mimeRef.current;
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    stopTracks();
    mediaRecorderRef.current = null;

    if (!aliveRef.current) return;

    if (blob.size < 200) {
      setError('录音太短');
      return;
    }

    try {
      setBusy(true);
      const id = createId();
      await putVoiceBlob(id, blob, mimeType);
      if (!aliveRef.current) {
        void deleteVoiceBlob(id);
        return;
      }
      onChangeRef.current([
        ...voicesRef.current,
        {
          id,
          mimeType,
          durationMs,
          createdAt: new Date().toISOString(),
        },
      ]);
      setElapsedMs(0);
      setError(null);
    } catch {
      if (aliveRef.current) setError('保存语音失败');
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  return (
    <div
      className="voice-field"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {voices.length > 0 && (
        <ul className="voice-list">
          {voices.map((clip, index) => (
            <li key={clip.id} className="voice-list__item">
              <div className="voice-list__head">
                <span>语音 {index + 1}</span>
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => onChange(voices.filter((v) => v.id !== clip.id))}
                >
                  删除
                </button>
              </div>
              <VoicePlayer id={clip.id} durationMs={clip.durationMs} />
            </li>
          ))}
        </ul>
      )}

      <div className="voice-controls">
        {recording ? (
          <>
            <span className="voice-controls__timer" aria-live="polite">
              录制中 {formatDuration(elapsedMs)}
            </span>
            <button
              type="button"
              className="btn-primary btn-primary--sm"
              onClick={stopRecording}
              disabled={busy}
            >
              停止
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void startRecording()}
            disabled={busy}
          >
            {busy && !recording
              ? '正在打开麦克风'
              : voices.length > 0
                ? '再录一段'
                : '开始录音'}
          </button>
        )}
      </div>
      {error ? <p className="hint hint--warn">{error}</p> : null}
    </div>
  );
}
