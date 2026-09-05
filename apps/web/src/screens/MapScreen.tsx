import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Lesson, ProfileProgress } from '@shared/types.ts';
import { api } from '../api.ts';
import { useProfileStore } from '../stores/profile.ts';
import Header from '../components/Header.tsx';

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
  const today = new Date().toISOString().slice(0, 10);
  const todayMin = progress?.dailyUsage[today] ?? 0;
  const basics = lessons.filter((l) => l.island === 'basics');
  const extras = lessons.filter((l) => l.island === 'extra');
  const cross = lessons.filter((l) => l.island === 'cross');
  const mathLessons = lessons.filter((l) => l.island === 'math');
  // 结业证书只看核心路线（基础+拓展）——交叉学院/数学岛是自由探索，不计入
  const coreLessons = lessons.filter((l) => l.island === 'basics' || l.island === 'extra');
  const coreDone = coreLessons.length > 0 && coreLessons.every((l) => lessonDone(l.id));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10">
        {/* 学习概览 */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="rounded-full bg-white/70 px-4 py-1.5 text-sm text-slate-500">今日学习 {todayMin} 分钟</span>
          <span className="rounded-full bg-white/70 px-4 py-1.5 text-sm text-slate-500">已探索 {lessons.filter((l) => lessonDone(l.id)).length}/{lessons.length} 站</span>
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

        {/* 数学岛 */}
        {mathLessons.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-1 flex items-center gap-2 text-2xl font-black text-sky-700">
              <span>📐</span> 数学岛
              <span className="text-sm font-normal text-slate-400">数学答案就是通关位置——算对了，角色才停得在那</span>
            </h2>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-sky-100 px-3 py-1 font-bold text-sky-700">🏛 小学馆 · 数与代数 / 图形与几何</span>
              <span className="rounded-full bg-indigo-100 px-3 py-1 font-bold text-indigo-700">🏛 初中馆 · 代数式 / 函数 / 勾股（Python）</span>
              <span className="rounded-full bg-violet-100 px-3 py-1 font-bold text-violet-700">🏛 高中馆 · 三角函数 / 指数（Python）</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mathLessons.map((l) => {
                const done = lessonDone(l.id);
                const hall = l.order <= 20 ? '小学馆' : l.order <= 24 ? '初中馆' : '高中馆';
                return (
                  <button
                    key={l.id}
                    onClick={() => nav(`/lesson/${l.id}`)}
                    className={`rounded-3xl p-4 text-left shadow-md transition hover:-translate-y-1 hover:shadow-xl ${
                      done ? 'bg-sky-50 ring-4 ring-sky-300' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{l.emoji}</div>
                      <div className="min-w-0">
                        <div className="truncate font-bold">{l.title}</div>
                        <div className="mt-0.5 text-xs text-sky-600">{hall} · {l.subject?.name?.replace('数学·', '')}</div>
                      </div>
                      {done && <span className="ml-auto text-xl">✅</span>}
                      {l.codeLesson && <span className={`${done ? '' : 'ml-auto'} shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-white`} title="Python 代码课">🐍</span>}
                    </div>
                  </button>
                );
              })}
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

        {/* AI 实验室 + 证书 */}
        <section className="grid gap-4 md:grid-cols-2">
          <button
            onClick={() => nav('/playground')}
            className="rounded-3xl bg-gradient-to-br from-pink-400 to-rose-500 p-6 text-center text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl"
          >
            <div className="text-5xl">🧠</div>
            <div className="mt-2 text-xl font-black">AI 实验室 · 人工智能通识</div>
            <div className="mt-1 text-xs opacity-90">采集样本 → 训练识别模型 → 测试验证，理解「AI 是从数据学出来的」</div>
          </button>
          <button
            disabled={!coreDone}
            onClick={() => nav('/certificate')}
            className={`rounded-3xl p-5 text-center shadow-lg transition ${
              coreDone ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 hover:-translate-y-1 hover:shadow-2xl' : 'cursor-not-allowed bg-slate-200/70 text-slate-400'
            }`}
          >
            <div className="text-4xl">{coreDone ? '🏆' : '🔒'}</div>
            <div className="mt-1.5 text-base font-black">结业证书</div>
            <div className="mt-0.5 text-xs">{coreDone ? '来领取属于你的证书 →' : `走完发现之路（基础+拓展共 ${coreLessons.length} 站）解锁`}</div>
          </button>
        </section>
      </main>
    </div>
  );
}
