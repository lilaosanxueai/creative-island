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
    void api.progress(profile.id).then(setProgress).catch(() => setProgress({ profileId: profile.id, lessons: {}, dailyUsage: {} }));
  }, [profile, nav]);

  if (!profile) return null;

  const lessonDone = (id: string) => progress?.lessons[id]?.status === 'completed';
  const unlocked = (i: number) => i === 0 || lessonDone(lessons[i - 1].id);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10">
        {/* 基础岛 */}
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-amber-700">
            <span>🏖</span> 基础岛
            <span className="text-sm font-normal text-slate-400">完成一课解锁下一课</span>
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

        {/* 自由创造岛 */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-violet-700">
            <span>✨</span> 自由创造岛
            <span className="text-sm font-normal text-slate-400">想做什么都可以，AI 伙伴随时陪你头脑风暴</span>
          </h2>
          <button
            onClick={() => nav('/freeplay')}
            className="w-full rounded-3xl bg-gradient-to-r from-violet-500 to-sky-400 p-8 text-left text-white shadow-lg transition hover:-translate-y-1 hover:shadow-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="text-6xl">🛠</div>
              <div>
                <div className="text-2xl font-black">进入自由创造工坊</div>
                <div className="mt-1 opacity-90">全部积木随你用 · 做完挂到作品墙给爸妈看</div>
              </div>
              <div className="ml-auto text-4xl">→</div>
            </div>
          </button>
        </section>
      </main>
    </div>
  );
}
