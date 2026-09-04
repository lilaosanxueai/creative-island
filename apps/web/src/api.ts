import type { BuddyMode, ChatContext, ChatMessage, Lesson, Profile, ProfileProgress, Project, Settings } from '@shared/types.ts';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `请求失败 ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

export const api = {
  health: () => req<{ ok: boolean; llmConfigured: boolean }>('/api/health'),
  profiles: () => req<Profile[]>('/api/profiles'),
  createProfile: (name: string, avatar: string) =>
    req<Profile>('/api/profiles', { method: 'POST', body: JSON.stringify({ name, avatar }) }),
  deleteProfile: (id: string) => req<{ ok: boolean }>(`/api/profiles/${id}`, { method: 'DELETE' }),
  lessons: () => req<Lesson[]>('/api/lessons'),
  progress: (profileId: string) => req<ProfileProgress>(`/api/progress/${profileId}`),
  updateProgress: (profileId: string, patch: Record<string, unknown>) =>
    req<ProfileProgress>(`/api/progress/${profileId}`, { method: 'PUT', body: JSON.stringify(patch) }),
  projects: (profileId: string) => req<Project[]>(`/api/projects?profileId=${profileId}`),
  saveProject: (p: { profileId: string; title: string; xml: string; thumb: string; lessonId?: string; stage?: Project['stage']; projectId?: string }) =>
    req<Project>('/api/projects', { method: 'POST', body: JSON.stringify(p) }),
  deleteProject: (profileId: string, id: string) =>
    req<{ ok: boolean }>(`/api/projects/${id}?profileId=${profileId}`, { method: 'DELETE' }),
  settings: () => req<Settings>('/api/settings'),
  saveSettings: (s: Settings, pin: string) =>
    req<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(s), headers: { 'x-parent-pin': pin } }),
  verifyPin: (pin: string) => req<{ ok: boolean }>('/api/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) }),
  chatDates: (profileId: string, pin: string) =>
    req<{ dates: string[] }>(`/api/chatlogs?profileId=${profileId}`, { headers: { 'x-parent-pin': pin } }),
  chatLogs: (profileId: string, date: string, pin: string) =>
    req<{ ts: string; mode: string; user: string; assistant: string }[]>(
      `/api/chatlogs?profileId=${profileId}&date=${date}`, { headers: { 'x-parent-pin': pin } }),
};

/** AI 伙伴流式对话：onDelta 收文本增量，返回完整回复 */
export async function chatStream(
  payload: { profileId: string; mode: BuddyMode; message: string; history: ChatMessage[]; context: ChatContext },
  onDelta: (text: string) => void,
): Promise<void> {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok || !resp.body) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? '对话服务暂时不可用');
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = '', data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (event === 'delta' && data) {
        try { onDelta(JSON.parse(data).text ?? ''); } catch { /* 忽略半包 */ }
      }
    }
  }
}
