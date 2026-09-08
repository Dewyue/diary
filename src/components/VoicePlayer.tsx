import { useEffect, useState } from 'react';
import { getVoiceBlob } from '../voiceDb';
import { formatDuration } from '../voiceCapture';

type Props = {
  id: string;
  durationMs: number;
  compact?: boolean;
};

export function VoicePlayer({ id, durationMs, compact }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const blob = await getVoiceBlob(id);
        if (cancelled) return;
        if (!blob) {
          setMissing(true);
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        revoked = objectUrl;
        setUrl(objectUrl);
        setMissing(false);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id]);

  if (missing) {
    return (
      <p className={`voice-player voice-player--missing${compact ? ' is-compact' : ''}`}>
        语音缺失（{formatDuration(durationMs)}）
      </p>
    );
  }

  if (!url) {
    return (
      <p className={`voice-player voice-player--loading${compact ? ' is-compact' : ''}`}>
        加载中
      </p>
    );
  }

  return (
    <div
      className={`voice-player${compact ? ' is-compact' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <audio controls preload="metadata" src={url} />
      <span className="voice-player__duration">{formatDuration(durationMs)}</span>
    </div>
  );
}
