import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './config.ts';
import type { Profile, ProfileProgress, Project, Settings } from '@shared/types.ts';
import { DEFAULT_SETTINGS } from '@shared/types.ts';

/** 家庭规模用 JSON 文件 + 启动时读入内存、写入即落盘，足够简单可靠 */

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf-8');
}

// ---------- 角色档案 ----------

const profilesFile = path.join(DATA_DIR, 'profiles.json');

export function listProfiles(): Profile[] {
  return readJson<Profile[]>(profilesFile, []);
}

export function createProfile(name: string, avatar: string): Profile {
  const profiles = listProfiles();
  const p: Profile = { id: crypto.randomUUID(), name: name.trim().slice(0, 12), avatar, createdAt: new Date().toISOString() };
  profiles.push(p);
  writeJson(profilesFile, profiles);
  return p;
}

export function deleteProfile(id: string): void {
  writeJson(profilesFile, listProfiles().filter((p) => p.id !== id));
  for (const f of [progressFile(id), path.join(DATA_DIR, 'projects', `${id}.json`)]) {
    try { fs.rmSync(f); } catch { /* 不存在就算了 */ }
  }
  try { fs.rmSync(path.join(DATA_DIR, 'chatlogs', id), { recursive: true, force: true }); } catch { /* 同上 */ }
}

// ---------- 学习进度 ----------

function progressFile(profileId: string): string {
  return path.join(DATA_DIR, 'progress', `${profileId}.json`);
}

export function getProgress(profileId: string): ProfileProgress {
  return readJson<ProfileProgress>(progressFile(profileId), { profileId, lessons: {}, dailyUsage: {} });
}

export function mergeProgress(profileId: string, patch: {
  lessonId?: string;
  tasks?: Record<string, boolean>;
  completed?: boolean;
  minutesDelta?: number;
}): ProfileProgress {
  const cur = getProgress(profileId);
  if (patch.lessonId) {
    const lp = cur.lessons[patch.lessonId] ?? { status: 'in_progress' as const, tasks: {} };
    if (patch.tasks) {
      for (const [taskId, done] of Object.entries(patch.tasks)) {
        lp.tasks[taskId] = { done, doneAt: done ? new Date().toISOString() : undefined };
      }
    }
    if (patch.completed && lp.status !== 'completed') {
      lp.status = 'completed';
      lp.completedAt = new Date().toISOString();
    }
    cur.lessons[patch.lessonId] = lp;
  }
  if (patch.minutesDelta && patch.minutesDelta > 0) {
    const today = new Date().toISOString().slice(0, 10);
    cur.dailyUsage[today] = (cur.dailyUsage[today] ?? 0) + Math.round(patch.minutesDelta);
  }
  writeJson(progressFile(profileId), cur);
  return cur;
}

// ---------- 作品 ----------

function projectsFile(profileId: string): string {
  return path.join(DATA_DIR, 'projects', `${profileId}.json`);
}

export function listProjects(profileId: string): Project[] {
  return readJson<Project[]>(projectsFile(profileId), []);
}

export function saveProject(input: { profileId: string; title: string; xml: string; thumb: string; lessonId?: string; stage?: Project['stage']; projectId?: string }): Project {
  const list = listProjects(input.profileId);
  const now = new Date().toISOString();
  let proj = input.projectId ? list.find((p) => p.id === input.projectId) : undefined;
  if (proj) {
    Object.assign(proj, { title: input.title.trim().slice(0, 30) || proj.title, xml: input.xml, thumb: input.thumb, lessonId: input.lessonId, stage: input.stage, updatedAt: now });
  } else {
    proj = {
      id: crypto.randomUUID(), profileId: input.profileId,
      title: input.title.trim().slice(0, 30) || '我的作品', xml: input.xml, thumb: input.thumb,
      lessonId: input.lessonId, stage: input.stage, createdAt: now, updatedAt: now,
    };
    list.unshift(proj);
  }
  writeJson(projectsFile(input.profileId), list);
  return proj;
}

export function deleteProject(profileId: string, projectId: string): void {
  writeJson(projectsFile(profileId), listProjects(profileId).filter((p) => p.id !== projectId));
}

// ---------- 设置 ----------

const settingsFile = path.join(DATA_DIR, 'settings.json');

export function getSettings(): Settings {
  const saved = readJson<Partial<Settings>>(settingsFile, {});
  return {
    buddy: { ...DEFAULT_SETTINGS.buddy, ...saved.buddy },
    limits: { ...DEFAULT_SETTINGS.limits, ...saved.limits },
  };
}

export function saveSettings(next: Settings): Settings {
  writeJson(settingsFile, next);
  return next;
}
