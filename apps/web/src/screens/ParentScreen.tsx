import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Lesson, Profile, ProfileProgress, Project, Settings } from '@shared/types.ts';
import { api } from '../api.ts';
import { calcStreak } from '../utils/streak.ts';

/** 家长面板：PIN 门 → 学习进度 / 学情报告 / AI 对话记录 / 伙伴设置 */

type Tab = 'progress' | 'report' | 'chats' | 'settings';

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
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-black">🛡 家长中心</h1>
        <Link to="/map" className="ml-auto rounded-xl bg-slate-200 px-3 py-1.5 text-sm font-bold hover:bg-slate-300">← 回应用</Link>
      </div>
      <div className="mb-6 rounded-2xl bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-800">
        🔒 <b>隐私承诺</b>：孩子的全部数据（进度、作品、AI 对话、训练场样本与摄像头画面）都只保存在这台电脑上，不上云、不联网同步；摄像头画面只在本机浏览器内计算。
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
        {([['progress', '📈 学习进度'], ['report', '📗 学情报告'], ['chats', '💬 AI 对话记录'], ['settings', '⚙️ 设置']] as [Tab, string][])
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
          : tab === 'report' ? <ReportTab profileId={profileId} />
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

/** 学情报告：课标知识点覆盖 + 学习投入统计，可打印 */
function ReportTab({ profileId }: { profileId: string }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    void api.lessons().then(setLessons);
    void api.progress(profileId).then(setProgress);
    void api.projects(profileId).then(setProjects).catch(() => {});
  }, [profileId]);

  const done = (id: string) => progress?.lessons[id]?.status === 'completed';
  const totalMin = Object.values(progress?.dailyUsage ?? {}).reduce((a, b) => a + b, 0);
  const streak = calcStreak(progress?.dailyUsage ?? {});
  const doneCount = lessons.filter((l) => done(l.id)).length;

  // 知识点覆盖：已完成课的知识点打勾（按模块分组展示）
  const byModule = new Map<string, { point: string; lesson: Lesson; done: boolean }[]>();
  for (const l of lessons) {
    if (!l.curriculum) continue;
    for (const p of l.curriculum.points) {
      const key = `${l.curriculum.stage} · ${l.curriculum.module}`;
      if (!byModule.has(key)) byModule.set(key, []);
      byModule.get(key)!.push({ point: p, lesson: l, done: done(l.id) });
    }
  }

  // 跨学科覆盖：编程 × 学科（交叉学院 + 数学岛）
  const crossLessons = lessons.filter((l) => l.subject);
  const crossDone = crossLessons.filter((l) => done(l.id));
  const mathLessons = lessons.filter((l) => l.island === 'math');
  const mathDone = mathLessons.filter((l) => done(l.id));

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="累计学习" value={`${totalMin} 分钟`} emoji="⏰" />
        <StatCard label="连续天数" value={`${streak} 天`} emoji="🔥" />
        <StatCard label="课程通关" value={`${doneCount}/${lessons.length}`} emoji="🏁" />
        <StatCard label="创作作品" value={`${projects.length} 个`} emoji="🖼" />
      </div>

      <div className="rounded-2xl bg-white/80 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">📗 课标知识点覆盖</h3>
          <span className="text-xs text-slate-400">对标《义务教育信息科技课程标准（2022年版）》</span>
        </div>
        {[...byModule.entries()].map(([mod, points]) => (
          <div key={mod} className="mb-4">
            <div className="mb-1.5 text-sm font-bold text-slate-600">{mod}</div>
            <div className="flex flex-wrap gap-2">
              {points.map((p) => (
                <span
                  key={p.point + p.lesson.id}
                  title={`${p.lesson.title}${p.done ? ' · 已通关' : ' · 未完成'}`}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    p.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {p.done ? '✓' : '○'} {p.point}
                </span>
              ))}
            </div>
          </div>
        ))}
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          绿色 ✓ 为已通关课程覆盖的知识点。2025 年秋季起多地中小学开设 AI 通识课（每年级不少于 8 课时），
          创意岛可作为课内的家庭动手补充：同样的知识点，这里全部通过「自己做出来」来学会。
        </p>
      </div>

      {crossLessons.length > 0 && (
        <div className="mt-4 rounded-2xl bg-rose-50/80 p-5">
          {mathLessons.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 rounded-xl bg-sky-100/80 p-3">
              <span className="text-sm font-black text-sky-800">📐 数学岛</span>
              <span className="text-sm text-sky-700">小学馆 {mathLessons.filter((l) => l.order <= 20 && done(l.id)).length}/{mathLessons.filter((l) => l.order <= 20).length} · 初中馆 {mathLessons.filter((l) => l.order > 20 && l.order <= 24 && done(l.id)).length}/{mathLessons.filter((l) => l.order > 20 && l.order <= 24).length} · 高中馆 {mathLessons.filter((l) => l.order > 24 && done(l.id)).length}/{mathLessons.filter((l) => l.order > 24).length}</span>
              <span className="ml-auto text-xs text-sky-500">覆盖数与代数 · 图形与几何 · 统计与概率 · 函数 · 三角函数（2022 版课标 + 高中衔接）</span>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-black text-rose-700">🎓 跨学科主题学习（编程 × 学科）</h3>
            <span className="text-xs text-rose-400">新课标要求：每学期不少于 10% 课时的跨学科主题学习</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {crossLessons.map((l) => (
              <div
                key={l.id}
                className={`rounded-xl p-3 text-sm ${done(l.id) ? 'bg-white shadow-sm' : 'bg-white/50 opacity-70'}`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <span>{done(l.id) ? '✅' : '○'}</span>
                  <span className="text-lg">{l.emoji}</span>
                  <span className="truncate">{l.title}</span>
                  <span className="ml-auto shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600">
                    {l.subject?.emoji} {l.subject?.name}
                  </span>
                </div>
                {done(l.id) && l.subject && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {l.subject.points.map((pt) => (
                      <span key={pt} className="rounded-full bg-rose-100/70 px-2 py-0.5 text-xs text-rose-700">✓ {pt}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-rose-400">
            已完成 {crossDone.length}/{crossLessons.length} 个跨学科项目——每个项目同时点亮一门学科的知识点和编程本领。
          </p>
        </div>
      )}

      <div className="mt-4 text-right print:hidden">
        <button onClick={() => window.print()} className="rounded-xl bg-slate-800 px-5 py-2 font-bold text-white hover:bg-slate-900">🖨 打印 / 存 PDF</button>
      </div>
    </div>
  );
}

function StatCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-4 text-center shadow-sm">
      <div className="text-2xl">{emoji}</div>
      <div className="mt-1 text-xl font-black text-slate-800">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function ChatsTab({ profileId, pin }: { profileId: string; pin: string }) {  const [dates, setDates] = useState<string[]>([]);
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
        <p className="mt-1 text-xs text-slate-400">连续使用 20 分钟会自动弹出 20 秒远眺休息（护眼 20-20-20）</p>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!settings.limits.hardStop}
            onChange={(e) => setSettings({ ...settings, limits: { ...settings.limits, hardStop: e.target.checked } })}
            className="h-4 w-4 accent-emerald-600"
          />
          <span><b>到时锁定</b>：达到每日时长后锁定创作，需要家长 PIN 解锁（当天有效）。不勾选则只提醒不锁定</span>
        </label>
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
