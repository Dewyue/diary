#!/usr/bin/env node
/**
 * 微信聊天记录 txt → 日记 JSON（仅本地运行，内容不会上传）
 *
 * 默认：导入双方全部消息（不写昵称），同一天合并成一条，内容用换行分隔。
 *
 * 用法：
 *   npm run wechat:import -- ./聊天记录.txt
 *   npm run wechat:import -- ./聊天记录.txt -o ./diary-from-wechat.json
 *
 * 导入：打开 https://dewyue.github.io/diary/ → 数据 → 合并导入
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const SKIP_CONTENT = [
  /^你撤回了一条消息$/,
  /^对方撤回了一条消息$/,
  /^以上是打招呼的内容$/,
  /^消息已发出，但被对方拒收了$/,
  /^\[语音\]$/,
  /^\[视频\]$/,
  /^\[通话\]$/,
  /^\[红包\]$/,
  /^\[转账\]$/,
  /^\[位置\]$/,
  /^\[名片\]$/,
  /^\[文件\]$/,
  /^\[链接\]$/,
  /^\[音乐\]$/,
  /^\[小程序\]$/,
  /^\[动画表情\]$/,
  /^\[表情\]$/,
];

const DATETIME_LINE =
  /^(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?(?:\s*(?:星期|周)[日天一二三四五六])?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const SENDER_WITH_TIME =
  /^(.+?)\s+(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const DATE_HEADER =
  /^-{2,}\s*(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?\s*-{2,}$|^(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})日?(?:\s*(?:星期|周)[日天一二三四五六])?$/;

function createId(seed) {
  const hash = createHash('sha1').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIsoLocal(y, m, d, hh, mm, ss = 0) {
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  return date.toISOString();
}

function toDateKey(y, m, d) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    from: null,
    tag: '微信',
    mergeDay: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') args.output = argv[++i];
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--tag') args.tag = argv[++i];
    else if (a === '--no-tag') args.tag = '';
    else if (a === '--merge-day') args.mergeDay = true;
    else if (a === '--split') args.mergeDay = false;
    else if (a === '-h' || a === '--help') args.help = true;
    else if (!a.startsWith('-') && !args.input) args.input = a;
  }

  return args;
}

function shouldSkipContent(text) {
  const t = text.trim();
  if (!t) return true;
  return SKIP_CONTENT.some((re) => re.test(t));
}

function parseMessages(raw) {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const messages = [];

  let i = 0;
  let pendingSender = null;
  let pendingTime = null;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();
    i += 1;

    if (!trimmed) continue;

    // 日期分隔行：----------------------2024-01-02----------------------
    const header = trimmed.match(DATE_HEADER);
    if (header) {
      pendingSender = null;
      pendingTime = null;
      continue;
    }

    // 格式 A：昵称 2024-01-02 12:30:45
    const senderTime = trimmed.match(SENDER_WITH_TIME);
    if (senderTime) {
      pendingSender = senderTime[1].trim();
      pendingTime = {
        y: senderTime[2],
        m: senderTime[3],
        d: senderTime[4],
        hh: senderTime[5],
        mm: senderTime[6],
        ss: senderTime[7] || '0',
      };
      continue;
    }

    // 格式 B：单独一行时间
    const onlyTime = trimmed.match(DATETIME_LINE);
    if (onlyTime) {
      pendingTime = {
        y: onlyTime[1],
        m: onlyTime[2],
        d: onlyTime[3],
        hh: onlyTime[4],
        mm: onlyTime[5],
        ss: onlyTime[6] || '0',
      };
      // 下一行可能是昵称
      if (i < lines.length) {
        const maybeSender = lines[i].trim();
        const looksLikeTime =
          DATETIME_LINE.test(maybeSender) || SENDER_WITH_TIME.test(maybeSender);
        if (maybeSender && !looksLikeTime && maybeSender.length < 40) {
          pendingSender = maybeSender;
          i += 1;
        }
      }
      continue;
    }

    // 内容行（可能多行，直到空行或下一条头）
    if (!pendingTime) continue;

    const contentLines = [trimmed];
    while (i < lines.length) {
      const next = lines[i];
      const nextTrim = next.trim();
      if (!nextTrim) {
        i += 1;
        break;
      }
      if (
        DATE_HEADER.test(nextTrim) ||
        SENDER_WITH_TIME.test(nextTrim) ||
        DATETIME_LINE.test(nextTrim)
      ) {
        break;
      }
      contentLines.push(nextTrim);
      i += 1;
    }

    const content = contentLines.join('\n').trim();
    if (shouldSkipContent(content)) {
      pendingSender = null;
      pendingTime = null;
      continue;
    }

    messages.push({
      sender: pendingSender || '',
      date: toDateKey(pendingTime.y, pendingTime.m, pendingTime.d),
      createdAt: toIsoLocal(
        pendingTime.y,
        pendingTime.m,
        pendingTime.d,
        pendingTime.hh,
        pendingTime.mm,
        pendingTime.ss,
      ),
      content,
    });

    pendingSender = null;
    pendingTime = null;
  }

  return messages;
}

function toEntries(messages, { from, tag, mergeDay }) {
  let list = [...messages];
  if (from) {
    list = list.filter((m) => m.sender === from || m.sender.includes(from));
  }

  list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const tags = tag ? [tag.trim().toLowerCase()] : [];

  if (!mergeDay) {
    return list.map((m) => ({
      id: createId(`${m.createdAt}|${m.content}`),
      date: m.date,
      title: '',
      content: m.content,
      tags,
      createdAt: m.createdAt,
      updatedAt: m.createdAt,
    }));
  }

  /** @type {Map<string, { date: string, parts: string[], createdAt: string, updatedAt: string }>} */
  const byDay = new Map();
  for (const m of list) {
    const cur = byDay.get(m.date);
    if (!cur) {
      byDay.set(m.date, {
        date: m.date,
        parts: [m.content],
        createdAt: m.createdAt,
        updatedAt: m.createdAt,
      });
    } else {
      cur.parts.push(m.content);
      if (m.createdAt < cur.createdAt) cur.createdAt = m.createdAt;
      if (m.createdAt > cur.updatedAt) cur.updatedAt = m.createdAt;
    }
  }

  return [...byDay.values()]
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
}

function printHelp() {
  console.log(`微信聊天记录 → 日记 JSON

用法：
  npm run wechat:import -- <聊天记录.txt> [选项]

默认行为：
  - 导入双方全部消息（不写入昵称，只保留内容与时间）
  - 同一天合并成一条日记，多条内容用换行连接

选项：
  -o, --out <文件>     输出路径（默认 diary-from-wechat.json）
  --tag <标签>         给导入条目打标签（默认：微信）
  --no-tag             不打标签
  --from <昵称>        可选：只保留该发送者
  --split              可选：不按天合并，每条消息一条日记

说明：
  - 仅在本地读写文件，不会上传网络
  - 生成后到日记站「数据 → 合并导入」
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = resolve(args.input);
  const outputPath = resolve(args.output || 'diary-from-wechat.json');
  const raw = readFileSync(inputPath, 'utf8');
  const messages = parseMessages(raw);
  const entries = toEntries(messages, args);

  if (entries.length === 0) {
    console.error('没有解析到可用消息。可尝试：');
    console.error('  1. 确认是微信导出的 txt 文本');
    console.error('  2. 对照 scripts/fixtures/wechat-sample.txt 检查格式');
    process.exit(2);
  }

  const store = { version: 1, entries };
  writeFileSync(outputPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');

  console.log(`解析消息：${messages.length} 条`);
  console.log(`写入日记：${entries.length} 条（按天合并）→ ${outputPath}`);
  console.log('下一步：打开日记站 → 数据 → 合并导入，选择该 JSON 文件');
}

main();
