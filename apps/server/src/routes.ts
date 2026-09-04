import { Router, type Request, type Response } from 'express';
import type { BuddyMode, ChatContext, ChatMessage, Settings } from '@shared/types.ts';
import type { AppConfig } from './config.ts';
import { llmConfigured } from './config.ts';
import * as store from './store.ts';
import { loadLessons, findLesson } from './lessons.ts';
import { streamChat, type LlmMessage } from './llm.ts';
import { buildSystemPrompt } from './prompts.ts';
import { checkKidInput, stripUrls } from './safety.ts';
import { appendChatLog, readChatLogs, listChatDates } from './logging.ts';

export function buildRouter(cfg: AppConfig): Router {
  const r = Router();

  const requirePin = (req: Request, res: Response): boolean => {
    if (req.get('x-parent-pin') !== cfg.parentPin) {
      res.status(403).json({ error: 'PIN 不正确' });
      return false;
    }
    return true;
  };

  r.get('/health', (_req, res) => {
    res.json({ ok: true, llmConfigured: llmConfigured(cfg) });
  });

  // ---------- 角色 ----------
  r.get('/profiles', (_req, res) => res.json(store.listProfiles()));
  r.post('/profiles', (req, res) => {
    const { name, avatar } = req.body ?? {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: '需要名字' });
    res.status(201).json(store.createProfile(name, typeof avatar === 'string' ? avatar : '🧒'));
  });
  r.delete('/profiles/:id', (req, res) => {
    store.deleteProfile(req.params.id);
    res.json({ ok: true });
  });

  // ---------- 课程 ----------
  r.get('/lessons', (_req, res) => res.json(loadLessons()));
  r.get('/lessons/:id', (req, res) => {
    const lesson = findLesson(req.params.id);
    if (!lesson) return res.status(404).json({ error: '课程不存在' });
    res.json(lesson);
  });

  // ---------- 进度 ----------
  r.get('/progress/:profileId', (req, res) => res.json(store.getProgress(req.params.profileId)));
  r.put('/progress/:profileId', (req, res) => {
    const { lessonId, tasks, completed, minutesDelta, draft } = req.body ?? {};
    if (minutesDelta != null && (typeof minutesDelta !== 'number' || minutesDelta > 5)) {
      return res.status(400).json({ error: 'minutesDelta 每次最多 5 分钟' });
    }
    if (draft != null && typeof draft !== 'string') {
      return res.status(400).json({ error: 'draft 需要是字符串' });
    }
    res.json(store.mergeProgress(req.params.profileId, { lessonId, tasks, completed, minutesDelta, draft }));
  });

  // ---------- 作品 ----------
  r.get('/projects', (req, res) => {
    const profileId = String(req.query.profileId ?? '');
    if (!profileId) return res.status(400).json({ error: '缺少 profileId' });
    res.json(store.listProjects(profileId));
  });
  r.post('/projects', (req, res) => {
    const { profileId, title, xml, thumb, lessonId, stage, projectId } = req.body ?? {};
    if (!profileId || !xml) return res.status(400).json({ error: '缺少 profileId 或 xml' });
    if ((thumb ?? '').length > 300_000) return res.status(413).json({ error: '截图太大' });
    res.status(201).json(store.saveProject({ profileId, title, xml, thumb: thumb ?? '', lessonId, stage, projectId }));
  });
  r.delete('/projects/:id', (req, res) => {
    const profileId = String(req.query.profileId ?? '');
    if (!profileId) return res.status(400).json({ error: '缺少 profileId' });
    store.deleteProject(profileId, req.params.id);
    res.json({ ok: true });
  });
  r.post('/projects/:id/like', (req, res) => {
    const { likerId } = req.body ?? {};
    const profileId = String(req.query.profileId ?? '');
    if (!profileId || !likerId) return res.status(400).json({ error: '缺少 profileId 或 likerId' });
    const proj = store.toggleProjectLike(profileId, req.params.id, likerId);
    if (!proj) return res.status(404).json({ error: '作品不存在' });
    res.json(proj);
  });

  // ---------- 设置 ----------
  r.get('/settings', (_req, res) => res.json(store.getSettings()));
  r.put('/settings', (req, res) => {
    if (!requirePin(req, res)) return;
    const body = req.body as Settings;
    if (!body?.buddy?.name || !body?.limits) return res.status(400).json({ error: '设置格式不对' });
    res.json(store.saveSettings({
      buddy: {
        name: String(body.buddy.name).slice(0, 10),
        emoji: String(body.buddy.emoji ?? '🤖').slice(0, 4),
        persona: String(body.buddy.persona ?? '').slice(0, 200),
      },
      limits: {
        dailyMinutes: Math.min(240, Math.max(5, Number(body.limits.dailyMinutes) || 40)),
        hintStrictness: ['gentle', 'normal', 'direct'].includes(body.limits.hintStrictness) ? body.limits.hintStrictness : 'normal',
      },
    }));
  });
  r.post('/verify-pin', (req, res) => {
    res.json({ ok: String(req.body?.pin ?? '') === cfg.parentPin });
  });

  // ---------- AI 对话（SSE 流式） ----------
  r.post('/chat', async (req, res) => {
    const { profileId, mode, message, history, context } = req.body ?? {};
    if (!profileId || !message || typeof message !== 'string') {
      return res.status(400).json({ error: '参数不完整' });
    }
    if (!['idea', 'hint', 'explain', 'review'].includes(mode)) {
      return res.status(400).json({ error: '未知模式' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    const finish = (assistant: string, model: string) => {
      appendChatLog({
        ts: new Date().toISOString(),
        profileId, mode, user: message.slice(0, 500),
        assistant: assistant.slice(0, 2000), model,
      });
      send('done', {});
      res.end();
    };

    // 输入安检：命中敏感/个人信息时不调大模型，直接回话术（同样落日志）
    const blocked = checkKidInput(message);
    if (blocked) {
      send('delta', { text: blocked });
      return finish(blocked, 'safety-guard');
    }

    const settings = store.getSettings();
    const system = buildSystemPrompt(mode as BuddyMode, settings, (context ?? {}) as ChatContext);
    const msgs: LlmMessage[] = [
      { role: 'system', content: system },
      ...(Array.isArray(history) ? history.slice(-10) : []).map((m: ChatMessage) =>
        ({ role: m.role, content: String(m.content).slice(0, 800) }) as LlmMessage),
      { role: 'user', content: message.slice(0, 500) },
    ];

    let full = '';
    try {
      const mock = !llmConfigured(cfg);
      for await (const delta of streamChat(cfg.llm, msgs, { mock })) {
        const safe = stripUrls(delta);
        full += safe;
        send('delta', { text: safe });
      }
      finish(full, mock ? 'mock' : cfg.llm.model);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const friendly = `哎呀，我的大脑连接出了一点小问题 😵‍💫 请爸爸妈妈看看服务器窗口里的报错信息。\n（技术详情：${msg.slice(0, 120)}）`;
      send('delta', { text: friendly });
      finish(`${full}${friendly}`, 'error');
    }
  });

  // ---------- 对话记录（家长） ----------
  r.get('/chatlogs', (req, res) => {
    if (!requirePin(req, res)) return;
    const profileId = String(req.query.profileId ?? '');
    if (!profileId) return res.status(400).json({ error: '缺少 profileId' });
    if (req.query.date) return res.json(readChatLogs(profileId, String(req.query.date)));
    res.json({ dates: listChatDates(profileId) });
  });

  return r;
}
