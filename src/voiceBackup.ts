import type { DiaryStore, VoiceClip } from './types';
import { parseStore } from './storage';
import { extensionForMime } from './voiceCapture';
import { getVoiceBlob, putVoiceBlob } from './voiceDb';
import { packZip, unpackZip } from './zipPack';

export function collectVoiceIds(store: DiaryStore): string[] {
  const ids: string[] = [];
  for (const entry of store.entries) {
    for (const clip of entry.voices ?? []) ids.push(clip.id);
  }
  return ids;
}

function stamp(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `${date}-${time}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function bytesToBlob(data: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy], { type });
}

export async function exportDiaryBackup(store: DiaryStore): Promise<void> {
  const json = new TextEncoder().encode(JSON.stringify(store, null, 2));
  const voiceIds = collectVoiceIds(store);
  const files = [{ name: 'diary.json', data: json }];

  for (const id of voiceIds) {
    const blob = await getVoiceBlob(id);
    if (!blob) continue;
    const mime = blob.type || 'audio/webm';
    const bytes = new Uint8Array(await blob.arrayBuffer());
    files.push({ name: `audio/${id}.${extensionForMime(mime)}`, data: bytes });
  }

  const label = stamp();
  if (files.length === 1) {
    downloadBlob(bytesToBlob(json, 'application/json'), `diary-${label}.json`);
    return;
  }

  const zip = packZip(files);
  downloadBlob(bytesToBlob(zip, 'application/zip'), `diary-${label}.zip`);
}

export type ImportedBackup = {
  store: DiaryStore;
  clips: { id: string; blob: Blob; mimeType: string }[];
};

function isZipFile(file: File): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  );
}

export async function readBackupFromFile(file: File): Promise<ImportedBackup> {
  if (!isZipFile(file)) {
    const text = await file.text();
    return { store: parseStore(JSON.parse(text)), clips: [] };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = unpackZip(bytes);
  const jsonFile = files.find((f) => f.name === 'diary.json' || f.name.endsWith('/diary.json'));
  if (!jsonFile) throw new Error('压缩包里没有 diary.json');
  const store = parseStore(JSON.parse(new TextDecoder().decode(jsonFile.data)));
  const clips: ImportedBackup['clips'] = [];

  for (const fileEntry of files) {
    const match = fileEntry.name.match(/(?:^|\/)audio\/([^/]+)\.([a-z0-9]+)$/i);
    if (!match) continue;
    const id = match[1];
    const ext = match[2].toLowerCase();
    const mimeType =
      ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : ext === 'ogg' ? 'audio/ogg' : 'audio/webm';
    clips.push({
      id,
      blob: bytesToBlob(fileEntry.data, mimeType),
      mimeType,
    });
  }

  return { store, clips };
}

export async function persistImportedClips(clips: ImportedBackup['clips']): Promise<void> {
  for (const clip of clips) {
    await putVoiceBlob(clip.id, clip.blob, clip.mimeType);
  }
}

export function clipIdsOf(voices: VoiceClip[] | undefined): string[] {
  return (voices ?? []).map((v) => v.id);
}
