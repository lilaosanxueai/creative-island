import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Blockly from 'blockly';
import type { Project } from '@shared/types.ts';
import { api } from '../api.ts';
import { useProfileStore } from '../stores/profile.ts';
import Header from '../components/Header.tsx';
import Stage from '../components/Stage.tsx';
import { StageState } from '../runtime/stageState.ts';
import { Executor } from '../runtime/executor.ts';
import { parsePy, PyRunner } from '../runtime/pyinterp.ts';
import { pyStageApi } from '../runtime/pyBridge.ts';
import '../blocks/definitions.ts';
import '../blocks/generator.ts';

/** 作品墙：展示 + 放映（无头工作区跑存档程序，含按键事件，游戏类作品可玩） */
export default function GalleryScreen() {
  const nav = useNavigate();
  const { current: profile } = useProfileStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [playing, setPlaying] = useState<Project | null>(null);

  const refresh = () => profile && void api.projects(profile.id).then(setProjects).catch(() => {});
  useEffect(() => {
    if (!profile) { nav('/'); return; }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const remove = async (p: Project) => {
    if (!confirm(`删除作品《${p.title}》？`)) return;
    await api.deleteProject(profile!.id, p.id);
    refresh();
  };

  const like = async (p: Project) => {
    await api.likeProject(profile!.id, p.id, profile!.id).catch(() => {});
    refresh();
  };

  if (!profile) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10">
        <h2 className="mb-4 text-2xl font-black text-slate-700">🖼 我们的作品墙</h2>
        {projects.length === 0 ? (
          <div className="rounded-3xl bg-white/70 p-10 text-center text-slate-400">
            还没有作品～去 <a className="font-bold text-sky-600" href="#/freeplay">自由创造</a> 做一个，用「💾 存作品」挂上来！
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {projects.map((p) => (
              <div key={p.id} className="group overflow-hidden rounded-3xl bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative aspect-[4/3] bg-slate-100">
                  {p.thumb
                    ? <img src={p.thumb} alt={p.title} className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center text-5xl">🎨</div>}
                </div>
                <div className="p-3">
                  <div className="truncate font-bold">{p.title}</div>
                  <div className="text-xs text-slate-400">{new Date(p.updatedAt).toLocaleDateString('zh-CN')}</div>
                  <div className="mt-2 flex gap-1">
                    <button onClick={() => setPlaying(p)} className="flex-1 rounded-xl bg-emerald-500 py-1.5 text-sm font-bold text-white hover:bg-emerald-600">▶ 放映</button>
                    <button
                      onClick={() => void like(p)}
                      title="给作品点个赞"
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-bold transition ${
                        (p.likes ?? []).includes(profile.id)
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-500'
                      }`}
                    >
                      {(p.likes ?? []).includes(profile.id) ? '❤️' : '🤍'} {(p.likes ?? []).length || ''}
                    </button>
                    <button onClick={() => void remove(p)} className="rounded-xl bg-slate-200 px-2 py-1.5 text-sm text-slate-500 hover:bg-rose-100 hover:text-rose-600" title="删除">🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {playing && <Player project={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function Player({ project, onClose }: { project: Project; onClose: () => void }) {
  const stageRef = useRef(new StageState());
  const execRef = useRef<Executor | null>(null);
  const pyRef = useRef<PyRunner | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    stage.reset(project.stage?.actor ?? { costume: '🤖', x: 0, y: 0 }, project.stage?.targets);
    let ws: Blockly.Workspace | null = null;
    let py: PyRunner | null = null;
    if (project.code) {
      const { program } = parsePy(project.code);
      if (program) py = new PyRunner(program, pyStageApi(stage));
    } else {
      try {
        ws = new Blockly.Workspace();
        Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(project.xml), ws);
      } catch {
        ws = null;
      }
    }
    const exec = ws ? new Executor(ws, stage) : null;
    execRef.current = exec;
    pyRef.current = py;

    const map = (e: KeyboardEvent): string | null => {
      switch (e.key) {
        case 'ArrowUp': return 'up';
        case 'ArrowDown': return 'down';
        case 'ArrowLeft': return 'left';
        case 'ArrowRight': return 'right';
        case ' ': return 'space';
        default: return null;
      }
    };
    const down = (e: KeyboardEvent) => {
      const k = map(e);
      if (!k) return;
      e.preventDefault();
      if (!stage.keysHeld.has(k)) {
        stage.keysHeld.add(k);
        if (pyRef.current) pyRef.current.fire('key', k);
        else void exec?.trigger({ type: 'key', key: k });
      }
    };
    const up = (e: KeyboardEvent) => { const k = map(e); if (k) stage.keysHeld.delete(k); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      exec?.stop();
      pyRef.current?.stop();
      ws?.dispose();
    };
  }, [project]);

  const run = () => {
    if (pyRef.current) {
      setRunning(true);
      void pyRef.current.run(() => setRunning(false));
      return;
    }
    const exec = execRef.current;
    if (!exec) return;
    setRunning(true);
    void exec.run(() => setRunning(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-black">🎬 {project.title}{project.code ? ' 🐍' : ''}</h3>
          <button onClick={onClose} className="rounded-xl bg-slate-200 px-3 py-1 font-bold hover:bg-slate-300">✕ 关闭</button>
        </div>
        <Stage stage={stageRef.current} onSpriteClick={() => { if (running) (pyRef.current ? pyRef.current.fire('click') : void execRef.current?.trigger({ type: 'click' })); }} />
        <div className="mt-3 flex items-center justify-center gap-4">
          {running ? (
            <button onClick={() => { execRef.current?.stop(); pyRef.current?.stop(); setRunning(false); }} className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 text-xl text-white shadow">⏹</button>
          ) : (
            <button onClick={run} className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-xl text-white shadow">▶</button>
          )}
          <span className="text-sm text-slate-500">按 ▶ 开始；有键盘积木的作品可以用方向键和空格玩</span>
        </div>
      </div>
    </div>
  );
}
