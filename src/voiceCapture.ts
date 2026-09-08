export function isVoiceSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

export function isSecureForMic(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext;
}

export function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function extensionForMime(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) {
    return 'm4a';
  }
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

let pendingStream: MediaStream | null = null;
const liveStreams = new Set<MediaStream>();
let captureGen = 0;
let inflightCapture: Promise<MediaStream | null> | null = null;

export async function captureMicFromGesture(): Promise<boolean> {
  discardAllMic();
  if (!isVoiceSupported() || !isSecureForMic()) return false;
  const gen = ++captureGen;
  inflightCapture = navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      if (gen !== captureGen) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      pendingStream = stream;
      return stream;
    })
    .catch(() => {
      if (gen === captureGen) pendingStream = null;
      return null;
    })
    .finally(() => {
      if (gen === captureGen) inflightCapture = null;
    });
  const stream = await inflightCapture;
  return Boolean(stream);
}

/** Take a stream captured in the same user gesture, waiting if permission is still pending. */
export async function waitForPendingStream(): Promise<MediaStream | null> {
  const ready = takePendingStream();
  if (ready) return ready;
  if (inflightCapture) {
    await inflightCapture;
    return takePendingStream();
  }
  return null;
}

export function takePendingStream(): MediaStream | null {
  const stream = pendingStream;
  pendingStream = null;
  if (stream) liveStreams.add(stream);
  return stream;
}

export function registerLiveStream(stream: MediaStream): void {
  liveStreams.add(stream);
}

export function restorePendingStream(stream: MediaStream): void {
  liveStreams.delete(stream);
  const live = stream.getTracks().some((t) => t.readyState === 'live');
  if (!live) {
    stream.getTracks().forEach((t) => t.stop());
    return;
  }
  stopPendingStream();
  pendingStream = stream;
}

export function releaseStream(stream: MediaStream | null): void {
  if (!stream) return;
  liveStreams.delete(stream);
  stream.getTracks().forEach((t) => t.stop());
}

export function stopPendingStream(): void {
  pendingStream?.getTracks().forEach((t) => t.stop());
  pendingStream = null;
}

/** Stop every mic stream we created, including an in-progress recording. */
export function discardAllMic(): void {
  captureGen += 1;
  inflightCapture = null;
  stopPendingStream();
  for (const stream of liveStreams) {
    stream.getTracks().forEach((t) => t.stop());
  }
  liveStreams.clear();
}
