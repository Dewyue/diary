#!/usr/bin/env node
/**
 * wechat-insight JSONL → 日记 JSON（本地）
 *
 * 默认：双方消息都要、不写昵称、同一天合并、内容换行连接。
 *
 *   node scripts/insight-to-diary.mjs /tmp/export/messages_all.jsonl -o ~/Downloads/diary-from-wechat.json
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SKIP_TYPES = new Set(['system']);
const SKIP_CONTENT = [
  /^你撤回了一条消息$/,
  /^对方撤回了一条消息$/,
  /^\[图片\]$/,
  /^\[动画表情\]$/,
  /^\[表情\]$/,
  /^\[语音\]$/,
  /^\[视频\]$/,
  /^\[文件\]$/,
];

function createId(seed) {
  const hash = createHash('sha1').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function parseArgs(argv) {
  const args = { input: null, output: 'diary-from-wechat.json', tag: '微信' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') args.output = argv[++i];
    else if (a === '--tag') args.tag = argv[++i];
    else if (a === '--no-tag') args.tag = '';
    else if (!a.startsWith('-') && !args.input) args.input = a;
  }
  return args;
}

function contentOf(row) {
  const label = row.msg_type_label || '';
  const raw = String(row.content || '').trim();
  if (SKIP_TYPES.has(label)) return null;
  if (label === 'image') return raw || '[图片]';
  if (label === 'sticker') return raw || '[动画表情]';
  if (label !== 'text' && !raw) return null;
  if (!raw) return null;
  if (SKIP_CONTENT.some((re) => re.test(raw))) return null;
  return raw;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error('用法: node scripts/insight-to-diary.mjs <messages_all.jsonl> [-o out.json]');
    process.exit(1);
  }

  const inputPath = resolve(args.input);
  const outputPath = resolve(args.output);
  const lines = readFileSync(inputPath, 'utf8').split('\n').filter(Boolean);

  /** @type {Map<string, { date: string, parts: string[], createdAt: string, updatedAt: string }>} */
  const byDay = new Map();
  let kept = 0;

  const rows = lines
    .map((line) => JSON.parse(line))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

  for (const row of rows) {
    const content = contentOf(row);
    if (!content) continue;
    const date = String(row.datetime || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const createdAt = new Date(Number(row.timestamp) * 1000).toISOString();
    const cur = byDay.get(date);
    if (!cur) {
      byDay.set(date, {
        date,
        parts: [content],
        createdAt,
        updatedAt: createdAt,
      });
    } else {
      cur.parts.push(content);
      if (createdAt < cur.createdAt) cur.createdAt = createdAt;
      if (createdAt > cur.updatedAt) cur.updatedAt = createdAt;
    }
    kept += 1;
  }

  const tags = args.tag ? [args.tag.trim().toLowerCase()] : [];
  const entries = [...byDay.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      id: createId(`day|${day.date}|${day.parts.join('\n')}`),
      date: day.date,
      title: '',
      content: day.parts.join('\n'),
      tags,
      createdAt: day.createdAt,
      updatedAt: day.updatedAt,
    }));

  writeFileSync(outputPath, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`, 'utf8');
  console.log(`保留消息：${kept} 条`);
  console.log(`写入日记：${entries.length} 天 → ${outputPath}`);
  if (entries.length) {
    console.log(`日期范围：${entries[0].date} ~ ${entries[entries.length - 1].date}`);
  }
  console.log('下一步：日记站 → 数据 → 合并导入');
}

main();
