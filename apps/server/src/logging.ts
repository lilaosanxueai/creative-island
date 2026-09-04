import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.ts';

/** AI 对话全量落盘（jsonl），家长面板可查 —— 兜底安全机制 */

export interface ChatLogEntry {
  ts: string;
  profileId: string;
  mode: string;
  user: string;
  assistant: string;
  model: string;
}

function logDir(profileId: string): string {
  return path.join(DATA_DIR, 'chatlogs', profileId);
}

export function appendChatLog(entry: ChatLogEntry): void {
  const dir = logDir(entry.profileId);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${entry.ts.slice(0, 10)}.jsonl`), JSON.stringify(entry) + '\n', 'utf-8');
}

export function readChatLogs(profileId: string, date: string): ChatLogEntry[] {
  const file = path.join(logDir(profileId), `${date}.jsonl`);
  try {
    return fs.readFileSync(file, 'utf-8').trim().split('\n').filter(Boolean)
      .map((l) => JSON.parse(l) as ChatLogEntry);
  } catch {
    return [];
  }
}

export function listChatDates(profileId: string): string[] {
  try {
    return fs.readdirSync(logDir(profileId))
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => f.replace('.jsonl', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}
