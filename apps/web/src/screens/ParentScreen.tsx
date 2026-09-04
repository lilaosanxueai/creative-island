import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Lesson, Profile, ProfileProgress, Settings } from '@shared/types.ts';
import { api } from '../api.ts';

/** 家长面板：PIN 门 → 学习进度 / AI 对话记录 / 伙伴设置 */

type Tab = 'progress' | 'chats' | 'settings';

export default function ParentScreen() {
  const [pin, setPin] = useState(sessionStorage.getItem('island-pin') ?? '');
  const [verified, setVerified] = useState(!!sessionStorage.getItem('island-pin'));
  const [error, setError] = useState('');

  const tryPin = async () => {
    const r = await api.verifyPin(pin);
    if (r.ok) {
      sessionStorage.setItem('island-pin', pin);
      setVerified(true);
    } else {
      setError('PIN 不对，再试试（默认 1234，可在 data/config.json 修改）');
    }
  };

  if (!verified) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div className="text-5xl">🛡</div>
        <h1 className="text-2xl font-black">家长中心</h1>
        <input
          type="password"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && void tryPin()}
          placeholder="输入家长 PIN"
          className="w-48 rounded-xl border border-slate-300 px-4 py-2 text-center text-xl tracking-widest outline-none focus:border-sky-400"
        />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <button onClick={() => void tryPin()} className="rounded-xl bg-slate-800 px-6 py-2 font-bold text-white">进入</button>
        <Link to="/" className="text-sm text-slate-400">← 回到首页</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-black">🛡 家长中心</h1>
        <Link to="/map" className="ml-auto rounded-xl bg-slate-200 px-3 py-1.5 text-sm font-bold hover:bg-slate-300">← 回应用</Link>
      </div>
      <Tabs />
    </div>
  );
}

function Tabs() {
  const [tab, setTab] = useState<Tab>('progress');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState('');

  useEffect(() => {
    void api.profiles().then((ps) => {
      setProfiles(ps);
      if (ps[0]) setProfileId(ps[0].id);
    });
  }, []);

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {([['progress', '📈 学习进度'], ['chats', '💬 AI 对话记录'], ['settings', '⚙️ 设置']] as [Tab, string][])
          .map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-4 py-2 font-bold ${tab === k ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
            >
              {label}
            </button>
          ))}
        {profiles.length > 1 && (
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            className="ml-auto rounded-xl border border-slate-300 px-3 py-2"
          >
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>)}
          </select>
        )}
      </div>
      {!profileId ? <p className="text-slate-400">还没有创建孩子角色</p> : (
        tab === 'progress' ? <ProgressTab profileId={profileId} />
          : tab === 'chats' ? <ChatsTab profileId={profileId} pin={sessionStorage.getItem('island-pin')!} />
          : <SettingsTab pin={sessionStorage.getItem('island-pin')!} />
      )}
    </div>
  );
}

function ProgressTab({ profileId }: { profileId: string }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  useEffect(() => {
    void api.lessons().then(setLessons);
    void api.progress(profileId).then(setProgress);
  }, [profileId]);

  const today = new Date().toISOString().slice(0, 10);
  const todayMin = progress?.dailyUsage[today] ?? 0;

  return (
    <div>
      <div className="mb-4 rounded-2xl bg-white/80 p-4">
        今天使用了 <b className="text-xl text-sky-700">{todayMin}</b> 分钟
      </div>
      <div className="overflow-hidden rounded-2xl bg-white/80">
        <table className="w-full text-left">
          <thead className="bg-slate-100 text-sm text-slate-500">
            <tr><th className="p-3">课程</th><th className="p-3">状态</th><th className="p-3">任务完成</th><th className="p-3">通关时间</th></tr>
          </thead>
          <tbody>
            {lessons.map((l) => {
              const lp = progress?.lessons[l.id];
              const done = lp?.tasks ? Object.values(lp.tasks).filter((t) => t.done).length : 0;
              return (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="p-3 font-semibold">{l.emoji} {l.title}</td>
                  <td className="p-3">{lp?.status === 'completed' ? '✅ 已通关' : lp ? '⏳ 进行中' : '—'}</td>
                  <td className="p-3">{done}/{l.tasks.length}</td>
                  <td className="p-3 text-sm text-slate-400">{lp?.completedAt ? new Date(lp.completedAt).toLocaleString('zh-CN') : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChatsTab({ profileId, pin }: { profileId: string; pin: string }) {
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const [logs, setLogs] = useState<{ ts: string; mode: string; user: string; assistant: string }[]>([]);

  useEffect(() => {
    void api.chatDates(profileId, pin).then((r) => {
      setDates(r.dates);
      if (r.dates[0]) setDate(r.dates[0]);
    });
  }, [profileId, pin]);

  useEffect(() => {
    if (date) void api.chatLogs(profileId, date, pin).then(setLogs);
  }, [profileId, date, pin]);

  const MODE_LABEL: Record<string, string> = { idea: '💡灵感', hint: '🆘提示', explain: '📖讲解', review: '🌟点评', 'safety-guard': '🛡安全拦截' };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        {dates.length === 0 ? (
          <span className="text-slate-400">还没有对话记录</span>
        ) : (
          <select value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            {dates.map((d) => <option key={d}>{d}</option>)}
          </select>
        )}
        <span className="text-sm text-slate-400">共 {logs.length} 条，全部对话均长期保留</span>
      </div>
      <div className="space-y-3">
        {logs.map((l, i) => (
          <div key={i} className="rounded-2xl bg-white/80 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600">{MODE_LABEL[l.mode] ?? l.mode}</span>
              {new Date(l.ts).toLocaleTimeString('zh-CN')}
            </div>
            <div className="text-sm"><b>孩子：</b>{l.user}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm"><b>伙伴：</b>{l.assistant}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ pin }: { pin: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { void api.settings().then(setSettings); }, []);
  if (!settings) return <p className="text-slate-400">加载中…</p>;

  const save = async () => {
    await api.saveSettings(settings, pin);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl space-y-5 rounded-2xl bg-white/80 p-6">
      <div>
        <h3 className="mb-3 font-black">🤖 AI 伙伴</h3>
        <div className="flex items-center gap-3">
          <input
            value={settings.buddy.emoji}
            onChange={(e) => setSettings({ ...settings, buddy: { ...settings.buddy, emoji: e.target.value } })}
            className="w-16 rounded-xl border border-slate-300 px-3 py-2 text-center text-xl"
          />
          <input
            value={settings.buddy.name}
            onChange={(e) => setSettings({ ...settings, buddy: { ...settings.buddy, name: e.target.value } })}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2"
            placeholder="伙伴名字"
          />
        </div>
        <textarea
          value={settings.buddy.persona}
          onChange={(e) => setSettings({ ...settings, buddy: { ...settings.buddy, persona: e.target.value } })}
          rows={3}
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2"
          placeholder="伙伴性格（会注入对话人设）"
        />
      </div>

      <div>
        <h3 className="mb-3 font-black">⏰ 每日使用时长</h3>
        <div className="flex items-center gap-3">
          <input
            type="range" min={10} max={120} step={5}
            value={settings.limits.dailyMinutes}
            onChange={(e) => setSettings({ ...settings, limits: { ...settings.limits, dailyMinutes: Number(e.target.value) } })}
            className="flex-1"
          />
          <span className="w-16 text-right font-bold">{settings.limits.dailyMinutes} 分钟</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">到时后孩子端会收到温柔的休息提醒（不强制锁屏）</p>
      </div>

      <div>
        <h3 className="mb-3 font-black">🆘 提示严格度</h3>
        <div className="flex gap-2">
          {([['gentle', '温和：只给方向'], ['normal', '标准：先方向后搭法'], ['direct', '直接：较早给搭法']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSettings({ ...settings, limits: { ...settings.limits, hintStrictness: k } })}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold ${settings.limits.hintStrictness === k ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => void save()} className="rounded-xl bg-emerald-500 px-6 py-2 font-bold text-white hover:bg-emerald-600">保存设置</button>
        {saved && <span className="text-sm text-emerald-600">已保存 ✓</span>}
      </div>
    </div>
  );
}
