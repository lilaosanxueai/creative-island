import { Link, useNavigate } from 'react-router-dom';
import { useProfileStore } from '../stores/profile.ts';

export default function Header() {
  const { current, setCurrent } = useProfileStore();
  const nav = useNavigate();
  return (
    <header className="flex items-center gap-2 px-4 py-3">
      <Link to="/map" className="text-2xl font-black text-sky-700">🏝 AI 创意岛</Link>
      <nav className="ml-6 flex gap-1">
        <NavLink to="/map">🗺 地图</NavLink>
        <NavLink to="/freeplay">✨ 自由创造</NavLink>
        <NavLink to="/gallery">🖼 作品墙</NavLink>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {current && (
          <button
            onClick={() => { setCurrent(null); nav('/'); }}
            className="flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 font-bold shadow hover:bg-white"
            title="切换角色"
          >
            <span className="text-xl">{current.avatar}</span> {current.name}
          </button>
        )}
        <Link to="/parent" className="rounded-full bg-slate-200/70 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-300">🛡 家长</Link>
      </div>
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-full px-4 py-1.5 font-bold text-slate-600 transition hover:bg-white/70 hover:text-sky-700"
    >
      {children}
    </Link>
  );
}
