import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Profile } from '@shared/types.ts';
import { api } from '../api.ts';
import { useProfileStore } from '../stores/profile.ts';

const AVATARS = ['🧒', '👧', '👦', '🦊', '🐯', '🐼', '🚀', '🌟', '🐧', '🦄'];

export default function HomeScreen() {
  const nav = useNavigate();
  const { current, setCurrent } = useProfileStore();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [adding, setAdding] = useState(false);

  const refresh = () => api.profiles().then(setProfiles).catch(() => {});
  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (profiles.length > 0 && current && !profiles.some((p) => p.id === current.id)) setCurrent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  const enter = (p: Profile) => {
    setCurrent(p);
    nav('/map');
  };

  const add = async () => {
    if (!name.trim()) return;
    const p = await api.createProfile(name.trim(), avatar);
    setName('');
    setAdding(false);
    await refresh();
    enter(p);
  };

  const remove = async (p: Profile) => {
    if (!confirm(`确定删除「${p.name}」吗？ TA 的学习进度、作品和对话记录都会一起删除。`)) return;
    await api.deleteProfile(p.id);
    if (current?.id === p.id) setCurrent(null);
    void refresh();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="text-center pt-16 pb-10">
        <div className="text-7xl">🏝</div>
        <h1 className="mt-3 text-4xl font-black text-sky-800">AI 创意岛</h1>
        <p className="mt-2 text-slate-500">用积木编程，和 AI 伙伴一起做出你自己的游戏</p>
      </div>

      <div className="mx-auto w-full max-w-3xl px-6 pb-4">
        <h2 className="mb-4 text-xl font-bold text-slate-700">今天是谁来玩？</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {profiles.map((p) => (
            <div key={p.id} className="group relative">
              <button
                onClick={() => enter(p)}
                className="w-full rounded-3xl bg-white/90 p-6 text-center shadow-md transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="text-5xl">{p.avatar}</div>
                <div className="mt-2 text-lg font-bold">{p.name}</div>
                <div className="mt-1 text-sm text-sky-600">进去玩 →</div>
              </button>
              <button
                onClick={() => void remove(p)}
                className="absolute -right-2 -top-2 hidden h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-white shadow group-hover:flex"
                title="删除角色"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={() => setAdding(true)}
            className="rounded-3xl border-4 border-dashed border-sky-300 bg-white/40 p-6 text-center text-sky-500 transition hover:border-sky-400 hover:bg-white/70"
          >
            <div className="text-5xl">➕</div>
            <div className="mt-2 text-lg font-bold">新冒险家</div>
          </button>
        </div>
      </div>

      <div className="mt-auto pb-6 text-center">
        <a href="#/parent" className="text-sm text-slate-400 hover:text-slate-600">🛡 家长入口</a>
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAdding(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-black">新的冒险家</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你叫什么名字？"
              maxLength={12}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-lg outline-none focus:border-sky-400"
              autoFocus
            />
            <div className="mt-4 mb-2 text-sm font-bold text-slate-500">选一个头像</div>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`h-11 w-11 rounded-2xl text-2xl transition ${avatar === a ? 'bg-sky-100 ring-4 ring-sky-400' : 'bg-slate-100 hover:bg-slate-200'}`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setAdding(false)} className="rounded-xl bg-slate-200 px-4 py-2 font-bold">取消</button>
              <button
                onClick={() => void add()}
                disabled={!name.trim()}
                className="rounded-xl bg-sky-500 px-4 py-2 font-bold text-white hover:bg-sky-600 disabled:opacity-40"
              >
                开始冒险！
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
