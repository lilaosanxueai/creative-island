import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Lesson, ProfileProgress } from '@shared/types.ts';
import { api } from '../api.ts';
import { useProfileStore } from '../stores/profile.ts';
import Header from '../components/Header.tsx';

/** 创作之火：连续使用的天数（今天没用但昨天用了，火种还在） */
function calcStreak(dailyUsage: Record<string, number>): number {
  const days = new Set(Object.entries(dailyUsage).filter(([, m]) => m > 0).map(([d]) => d));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  let cursor = new Date(today);
  if (!days.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1); // 今天还没玩，从昨天数
  let streak = 0;
  while (days.has(fmt(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function MapScreen() {
  const nav = useNavigate();
  const { current: profile } = useProfileStore();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProfileProgress | null>(null);

  useEffect(() => {
    if (!profile) { nav('/'); return; }
    void api.lessons().then(setLessons);
    void api.progress(profile.id).then(setProgress).catch(() => setProgress({ profileId: profile.id, lessons: {}, dailyUsage: {}, lessonDrafts: {} }));
  }, [profile, nav]);

  if (!profile) return null;

  const lessonDone = (id: string) => progress?.lessons[id]?.status === 'completed';
  const unlocked = (i: number) => i === 0 || lessonDone(lessons[i - 1].id);
  const allDone = lessons.length > 0 && lessons.every((l) => lessonDone(l.id));
  const streak = calcStreak(progress?.dailyUsage ?? {});
  const today = new Date().toISOString().slice(0, 10);
  const todayMin = progress?.dailyUsage[today] ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10">
        {/* 创作之火 + 今日时长 */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className={`rounded-full px-4 py-1.5 font-bold shadow-sm ${streak >= 3 ? 'bg-orange-100 text-orange-600' : 'bg-white/70 text-slate-500'}`} title="每天都来玩一点，火苗会越长越高">
            🔥 创作之火 {streak} 天{streak >= 7 ? '，燃烧吧！' : ''}
          </span>
          <span className="rounded-full bg-white/70 px-4 py-1.5 text-sm text-slate-500">今天玩了 {todayMin} 分钟</span>
        </div>

        {/* 基础岛 */}
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-amber-700">
            <span>🏖</span> 基础岛
            <span className="text-sm font-normal text-slate-400">完成一课解锁下一课，⭐挑战是选做的</span>
          </h2>
          <div className="relative">
            <div className="absolute left-0 right-0 top-1/2 hidden border-t-4 border-dashed border-amber-300 sm:block" />
            <div className="relative flex gap-4 overflow-x-auto pb-4">
              {lessons.map((l, i) => {
                const done = lessonDone(l.id);
                const open = unlocked(i);
                return (
                  <button
                    key={l.id}
                    disabled={!open}
                    onClick={() => nav(`/lesson/${l.id}`)}
                    className={`w-44 shrink-0 rounded-3xl p-4 text-center shadow-md transition ${
                      !open ? 'cursor-not-allowed bg-slate-200/60 opacity-70'
                        : done ? 'bg-emerald-50 ring-4 ring-emerald-400 hover:-translate-y-1'
                        : 'bg-white hover:-translate-y-1 hover:shadow-xl'
                    }`}
                  >
                    <div className="text-5xl">{open ? l.emoji : '🔒'}</div>
                    <div className="mt-2 font-bold">{i + 1}. {l.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{l.goals[0]}</div>
                    <div className={`mt-2 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${done ? 'bg-emerald-500 text-white' : open ? 'bg-amber-400 text-white' : 'bg-slate-400 text-white'}`}>
                      {done ? '✅ 已通关 · 可重玩' : open ? '▶ 开始' : '完成上一课解锁'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 自由创造岛 + 证书 */}
        <section className="grid gap-4 md:grid-cols-3">
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
            disabled={!allDone}
            onClick={() => nav('/certificate')}
            className={`rounded-3xl p-6 text-center shadow-lg transition md:col-span-1 ${
              allDone ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 hover:-translate-y-1 hover:shadow-2xl' : 'cursor-not-allowed bg-slate-200/70 text-slate-400'
            }`}
          >
            <div className="text-5xl">{allDone ? '🏆' : '🔒'}</div>
            <div className="mt-2 text-lg font-black">创意岛结业证书</div>
            <div className="mt-1 text-xs">{allDone ? '全部通关！来领取属于你的证书 →' : `完成全部 ${lessons.length} 课后解锁`}</div>
          </button>
        </section>
      </main>
    </div>
  );
}
