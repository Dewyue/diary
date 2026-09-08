const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(data: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return ~crc >>> 0;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([
    n & 0xff,
    (n >>> 8) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 24) & 0xff,
  ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export type ZipEntry = { name: string; data: Uint8Array };

export function packZip(files: ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const local = concat([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      data,
    ]);
    const central = concat([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = concat(centrals);
  const end = concat([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, centralDir, end]);
}

function readU16(data: Uint8Array, i: number): number {
  return data[i] | (data[i + 1] << 8);
}

function readU32(data: Uint8Array, i: number): number {
  return (
    (data[i] |
      (data[i + 1] << 8) |
      (data[i + 2] << 16) |
      (data[i + 3] << 24)) >>>
    0
  );
}

export function unpackZip(data: Uint8Array): ZipEntry[] {
  const files: ZipEntry[] = [];
  let i = 0;
  while (i + 30 <= data.length) {
    if (readU32(data, i) !== 0x04034b50) break;
    const flags = readU16(data, i + 6);
    const method = readU16(data, i + 8);
    const nameLen = readU16(data, i + 26);
    const extraLen = readU16(data, i + 28);
    let size = readU32(data, i + 18);
    const nameStart = i + 30;
    const name = new TextDecoder().decode(data.slice(nameStart, nameStart + nameLen));
    let dataStart = nameStart + nameLen + extraLen;
    if (flags & 0x08) {
      throw new Error('不支持的 zip 格式');
    }
    if (method !== 0) {
      throw new Error('备份压缩包无法解压，请用本应用导出的 zip');
    }
    files.push({ name, data: data.slice(dataStart, dataStart + size) });
    i = dataStart + size;
  }
  return files;
}
