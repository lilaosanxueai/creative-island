import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Lesson, ProfileProgress, Settings } from '@shared/types.ts';
import { DEFAULT_SETTINGS } from '@shared/types.ts';
import { api } from '../api.ts';
import { useProfileStore } from '../stores/profile.ts';

/** 结业证书：全部课程通关后解锁，可打印贴墙上 😄 */
export default function CertificateScreen() {
  const nav = useNavigate();
  const { current: profile } = useProfileStore();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!profile) { nav('/'); return; }
    void api.lessons().then(setLessons);
    void api.progress(profile.id).then(setProgress);
    void api.settings().then(setSettings).catch(() => {});
  }, [profile, nav]);

  if (!profile) return null;

  const done = lessons.filter((l) => progress?.lessons[l.id]?.status === 'completed');
  const allDone = lessons.length > 0 && done.length === lessons.length;
  const completedAt = progress?.lessons[lessons[lessons.length - 1]?.id]?.completedAt;

  if (!allDone) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="text-6xl">🔒</div>
        <p className="text-lg text-slate-500">完成全部 {lessons.length} 课后，这里会变出一张属于你的结业证书！</p>
        <Link to="/map" className="rounded-xl bg-sky-500 px-5 py-2 font-bold text-white">回地图继续冒险 →</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 print:h-auto print:justify-start">
      <div className="cert-paper relative w-full max-w-2xl rounded-3xl border-8 border-double border-amber-500 bg-[#fffdf5] p-10 text-center shadow-2xl print:shadow-none">
        <div className="text-6xl">🏆</div>
        <h1 className="mt-2 text-3xl font-black tracking-widest text-amber-700">创 意 岛 结 业 证 书</h1>
        <p className="mt-1 text-sm text-amber-600/80">CERTIFICATE OF CREATIVE CODING</p>

        <p className="mt-8 text-lg text-slate-700">兹证明</p>
        <p className="my-2 text-4xl font-black text-slate-900">{profile.avatar} {profile.name}</p>
        <p className="mx-auto max-w-md leading-relaxed text-slate-700">
          独立完成了创意岛全部 <b>{lessons.length}</b> 节编程课，掌握了
          <b>顺序、循环、事件、条件、调试</b>五大编程法宝，
          并创作出了完全属于自己的作品。特发此证，以资鼓励！
        </p>

        <div className="mx-auto mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-1 text-left text-sm text-slate-600">
          {done.map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <span>✅</span><span className="truncate">{l.emoji} {l.title}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-end justify-between text-sm text-slate-500">
          <div>
            <div className="mb-1 text-3xl">🏝</div>
            <div>AI 创意岛</div>
          </div>
          <div className="text-center">
            <div className="mb-1 text-3xl">{settings.buddy.emoji}</div>
            <div>AI 伙伴：{settings.buddy.name}</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-700">
              {completedAt ? new Date(completedAt).toLocaleDateString('zh-CN') : new Date().toLocaleDateString('zh-CN')}
            </div>
            <div>颁发日期</div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 print:hidden">
        <button onClick={() => window.print()} className="rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-white shadow hover:bg-amber-600">🖨 打印 / 保存 PDF</button>
        <Link to="/map" className="rounded-xl bg-slate-200 px-5 py-2.5 font-bold hover:bg-slate-300">回地图</Link>
      </div>
      <p className="text-xs text-slate-400 print:hidden">小提示：打印时选择「横向」效果最好；以后也可以随时回来重新打印～</p>
    </div>
  );
}
