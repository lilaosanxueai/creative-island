import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { BuddyMode, BuddySettings, ChatContext, ChatMessage } from '@shared/types.ts';
import { chatStream } from '../api.ts';

export interface BuddyHandle {
  /** 从任务面板/灵感卡片跳进来提问 */
  askInMode: (mode: BuddyMode, text: string) => void;
}

interface Props {
  profileId: string;
  buddy: BuddySettings;
  intro: string;
  defaultMode: BuddyMode;
  getContext: () => ChatContext;
}

const MODES: { key: BuddyMode; label: string }[] = [
  { key: 'idea', label: '💡 灵感' },
  { key: 'hint', label: '🆘 提示' },
  { key: 'explain', label: '📖 讲解' },
  { key: 'review', label: '🌟 点评' },
];

const QUICK: Record<BuddyMode, string[]> = {
  idea: ['给我 3 个作品点子！', '帮我把点子变成步骤'],
  hint: ['我卡住了，给点提示', '再提示我多一点'],
  explain: ['「重复」积木是干什么的？', '什么是条件？'],
  review: ['看看我的作品！', '哪里可以更好？'],
};

const URL_RE = /https?:\/\/\S+|www\.\S+/g;

const AIBuddy = forwardRef<BuddyHandle, Props>(function AIBuddy(
  { profileId, buddy, intro, defaultMode, getContext },
  ref,
) {
  const [mode, setMode] = useState<BuddyMode>(defaultMode);
  const [messages, setMessages] = useState<(ChatMessage & { streaming?: boolean })[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    setMessages([{ role: 'assistant', content: intro, mode: defaultMode }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string, forceMode?: BuddyMode) => {
    const m = forceMode ?? modeRef.current;
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, mode: m }, { role: 'assistant', content: '', mode: m, streaming: true }]);
    setBusy(true);
    try {
      const history = messagesRef.current
        .filter((msg) => msg.content && !msg.streaming)
        .slice(-8)
        .map((msg) => ({ role: msg.role, content: msg.content }));
      let acc = '';
      await chatStream(
        { profileId, mode: m, message: trimmed, history, context: getContext() },
        (delta) => {
          acc += delta;
          const shown = acc.replace(URL_RE, '（链接已隐藏）');
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: shown };
            return next;
          });
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '网络出问题了';
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], content: `😵 ${msg}，等一下再试试吧` };
        return next;
      });
    } finally {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && !last.content) next[next.length - 1] = { ...last, content: '（没有听到回答，再问一次试试？）' };
        next[next.length - 1] = { ...next[next.length - 1], streaming: false };
        return next;
      });
      setBusy(false);
    }
  };

  useImperativeHandle(ref, () => ({
    askInMode: (m, text) => {
      setMode(m);
      void send(text, m);
    },
  }));

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl bg-white/90 p-3 shadow-md">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-3xl">{buddy.emoji}</span>
        <div>
          <div className="text-lg font-bold">{buddy.name}</div>
          <div className="text-xs text-slate-500">你的 AI 创意搭档</div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
              mode === m.key ? 'bg-amber-400 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-[15px] leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'rounded-br-sm bg-sky-500 text-white'
                  : 'rounded-bl-sm bg-white text-slate-800 shadow-sm'
              }`}
            >
              {msg.content || (msg.streaming ? '💬' : '')}
              {msg.streaming && msg.content ? <span className="animate-pulse">▌</span> : null}
            </div>
          </div>
        ))}
        <div ref={listEnd} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {QUICK[mode].map((q) => (
          <button
            key={q}
            disabled={busy}
            onClick={() => void send(q)}
            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        className="mt-2 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`和 ${buddy.name} 说说想法…`}
          maxLength={200}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-[15px] outline-none focus:border-sky-400"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-sky-500 px-4 py-2 font-bold text-white hover:bg-sky-600 disabled:opacity-40"
        >
          发送
        </button>
      </form>
    </div>
  );
});

export default AIBuddy;
