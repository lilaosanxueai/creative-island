import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Lesson, ProfileProgress } from '@shared/types.ts';
import { api } from '../api.ts';
import { useProfileStore } from '../stores/profile.ts';
import Header from '../components/Header.tsx';
import { calcStreak } from '../utils/streak.ts';

const IDEA_CARDS = [
  { emoji: '🎮', title: '键盘小游戏', desc: '用方向键开小车、躲障碍', hint: '做一个键盘控制的小游戏' },
  { emoji: '💃', title: '会跳舞的角色', desc: '让它转圈、变身、配节奏', hint: '让角色跳一支舞' },
  { emoji: '🧠', title: 'AI 手势魔术', desc: '用你的动作控制屏幕（先去 AI 实验室训练）', hint: '用 AI 识别做手势游戏' },
  { emoji: '🐍', title: '写真代码', desc: '直接用 Python 指挥机器人', hint: '用 Python 代码做点什么' },
];

export default function MapScreen() {
  const nav = useNavigate();
  const { current: profile } = useProfileStore();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProfileProgress | null>(null);

  useEffect(() => {
    if (!profile) { nav('/'); return; }
    void api.lessons().then(setLessons);
    void api.progress(profile.id).then(setProgress).catch(() => setProgress({ profileId: profile.id, lessons: {}, dailyUsage: {}, lessonDrafts: {}, lessonCodes: {} }));
  }, [profile, nav]);

  if (!profile) return null;

  const lessonDone = (id: string) => progress?.lessons[id]?.status === 'completed';
  const nextRec = lessons.find((l) => !lessonDone(l.id)); // 建议下一站，不再上锁
  const allDone = lessons.length > 0 && lessons.every((l) => lessonDone(l.id));
  const streak = calcStreak(progress?.dailyUsage ?? {});
  const today = new Date().toISOString().slice(0, 10);
  const todayMin = progress?.dailyUsage[today] ?? 0;
  const basics = lessons.filter((l) => l.island === 'basics');
  const extras = lessons.filter((l) => l.island === 'extra');
  const cross = lessons.filter((l) => l.island === 'cross');

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10">
        {/* 今天想创造什么：点子优先入口 */}
        <section className="mb-6">
          <div className="rounded-3xl bg-white/80 p-6 shadow-md">
            <h2 className="mb-1 text-2xl font-black text-slate-800">🪄 今天想创造什么？</h2>
            <p className="mb-4 text-sm text-slate-400">选一个点子直接开工——路上需要什么本领，做的时候伙伴会教你怎么用</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {IDEA_CARDS.map((idea) => (
                <button
                  key={idea.title}
                  onClick={() => { localStorage.setItem('island-idea', idea.hint); nav('/freeplay'); }}
                  className="rounded-2xl border-2 border-slate-100 bg-white p-4 text-left transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg"
                >
                  <div className="text-3xl">{idea.emoji}</div>
                  <div className="mt-1.5 font-bold">{idea.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{idea.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => { localStorage.setItem('island-idea', '让伙伴陪我头脑风暴一个新点子'); nav('/freeplay'); }}
              className="mt-3 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-sky-400 py-2.5 font-bold text-white shadow hover:opacity-90"
            >
              🤖 没有想法？让伙伴给我出点子 →
            </button>
          </div>
        </section>

        {/* 创作之火 + 今日时长 */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className={`rounded-full px-4 py-1.5 font-bold shadow-sm ${streak >= 3 ? 'bg-orange-100 text-orange-600' : 'bg-white/70 text-slate-500'}`} title="每天都来玩一点，火苗会越长越高">
            🔥 创作之火 {streak} 天{streak >= 7 ? '，燃烧吧！' : ''}
          </span>
          <span className="rounded-full bg-white/70 px-4 py-1.5 text-sm text-slate-500">今天玩了 {todayMin} 分钟</span>
        </div>

        {/* 基础岛 */}
        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-amber-700">
            <span>🧭</span> 基础岛
            <span className="text-sm font-normal text-slate-400">编程的五种本领，顺着玩或跳着玩都行</span>
          </h2>
          <div className="relative">
            <div className="absolute left-0 right-0 top-1/2 hidden border-t-4 border-dashed border-amber-300 sm:block" />
            <div className="relative flex gap-4 overflow-x-auto pb-4">
              {basics.map((l) => {
                const i = lessons.indexOf(l);
                const done = lessonDone(l.id);
                const rec = nextRec?.id === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => nav(`/lesson/${l.id}`)}
                    className={`w-44 shrink-0 rounded-3xl p-4 text-center shadow-md transition hover:-translate-y-1 hover:shadow-xl ${
                      done ? 'bg-emerald-50 ring-4 ring-emerald-400' : rec ? 'bg-amber-50 ring-4 ring-amber-300' : 'bg-white'
                    }`}
                  >
                    <div className="text-5xl">{l.emoji}</div>
                    <div className="mt-2 font-bold">{i + 1}. {l.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{l.goals[0]}</div>
                    <div className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${done ? 'bg-emerald-500 text-white' : rec ? 'bg-amber-400 text-white' : 'bg-slate-300 text-white'}`}>
                      {done ? '✅ 探索过' : rec ? '💡 建议下一站' : '随时去玩'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 拓展岛 */}
        {extras.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-teal-700">
              <span>🏔</span> 拓展岛
              <span className="text-sm font-normal text-slate-400">数学寻宝 · 信息安全 · 还有真 Python</span>
            </h2>
            <div className="relative">
              <div className="absolute left-0 right-0 top-1/2 hidden border-t-4 border-dashed border-teal-300 sm:block" />
              <div className="relative flex gap-4 overflow-x-auto pb-4">
                {extras.map((l) => {
                  const i = lessons.indexOf(l);
                  const done = lessonDone(l.id);
                  const rec = nextRec?.id === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => nav(`/lesson/${l.id}`)}
                      className={`w-44 shrink-0 rounded-3xl p-4 text-center shadow-md transition hover:-translate-y-1 hover:shadow-xl ${
                        done ? 'bg-emerald-50 ring-4 ring-emerald-400' : rec ? 'bg-amber-50 ring-4 ring-amber-300' : 'bg-white'
                      }`}
                    >
                      <div className="text-5xl">{l.emoji}</div>
                      <div className="mt-2 font-bold">{i + 1}. {l.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{l.curriculum ? `${l.curriculum.module}` : l.goals[0]}</div>
                      <div className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${done ? 'bg-emerald-500 text-white' : rec ? 'bg-amber-400 text-white' : 'bg-slate-300 text-white'}`}>
                        {done ? '✅ 探索过' : rec ? '💡 建议下一站' : '随时去玩'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* 交叉学院 */}
        {cross.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-rose-700">
              <span>🎓</span> 交叉学院
              <span className="text-sm font-normal text-slate-400">编程 × 语文 · 数学 · 音乐 · 科学——新课标的跨学科主题学习</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cross.map((l) => {
                const done = lessonDone(l.id);
                const rec = nextRec?.id === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => nav(`/lesson/${l.id}`)}
                    className={`rounded-3xl p-4 text-left shadow-md transition hover:-translate-y-1 hover:shadow-xl ${
                      done ? 'bg-rose-50 ring-4 ring-rose-300' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{l.emoji}</div>
                      <div className="min-w-0">
                        <div className="truncate font-bold">{l.title}</div>
                        <div className="mt-0.5 text-xs text-rose-500">{l.subject?.emoji} 编程 × {l.subject?.name}</div>
                      </div>
                      {done && <span className="ml-auto text-xl">✅</span>}
                      {rec && !done && <span className="ml-auto text-xl">💡</span>}
                    </div>
                    <div className="mt-2 text-xs leading-relaxed text-slate-400">{l.goals[0]}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 自由创造岛 + AI 实验室 + 证书 */}
        <section className="grid gap-4 md:grid-cols-4">
          <button
            onClick={() => nav('/freeplay')}
            className="rounded-3xl bg-gradient-to-r from-violet-500 to-sky-400 p-6 text-left text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl md:col-span-2"
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl">🛠</div>
              <div>
                <div className="text-2xl font-black">进入自由创造工坊</div>
                <div className="mt-1 opacity-90">全部积木随你用 · 做完挂到作品墙给爸妈看</div>
              </div>
              <div className="ml-auto text-4xl">→</div>
            </div>
          </button>
          <button
            onClick={() => nav('/playground')}
            className="rounded-3xl bg-gradient-to-br from-pink-400 to-rose-500 p-5 text-center text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl"
          >
            <div className="text-4xl">🧠</div>
            <div className="mt-1.5 text-lg font-black">AI 实验室</div>
            <div className="mt-0.5 text-xs opacity-90">训练你自己的 AI，认手势、认表情</div>
          </button>
          <button
            disabled={!allDone}
            onClick={() => nav('/certificate')}
            className={`rounded-3xl p-5 text-center shadow-lg transition ${
              allDone ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 hover:-translate-y-1 hover:shadow-2xl' : 'cursor-not-allowed bg-slate-200/70 text-slate-400'
            }`}
          >
            <div className="text-4xl">{allDone ? '🏆' : '🔒'}</div>
            <div className="mt-1.5 text-base font-black">结业证书</div>
            <div className="mt-0.5 text-xs">{allDone ? '来领取属于你的证书 →' : `完成全部 ${lessons.length} 课解锁`}</div>
          </button>
        </section>
      </main>
    </div>
  );
}
