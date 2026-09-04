import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProfileProgress } from '@shared/types.ts';
import { api } from '../api.ts';
import { useProfileStore } from '../stores/profile.ts';
import Header from '../components/Header.tsx';
import { recognizer, MAX_SAMPLES_PER_CLASS } from '../ml/recognizer.ts';
import { playSound } from '../runtime/sounds.ts';

/**
 * AI 训练场（Teachable Machine 式）：孩子给 AI 拍样本、看它学习、测它准不准，
 * 然后带着训练好的「AI 大脑」去工作台用「当 AI 认出」积木做手势游戏。
 * 摄像头画面只在本机浏览器里计算，绝不离开这台电脑。
 */

const TASKS = [
  { id: 't1', text: '给至少两个类别各拍 10 张以上样本（长按按钮连拍）', auto: true },
  { id: 't2', text: '测试区里 AI 能认出你做的东西（认对了自己打勾）', auto: false },
  { id: 't3', text: '点「💾 保存 AI 大脑」，把它存起来', auto: false },
  { id: 'c1', text: '⭐ 挑战：去自由创造用「当 AI 认出」积木做一个手势游戏', auto: false, optional: true },
];

const TIPS = [
  '📷 两类东西差别越大越好认：举左手 vs 举右手、两种玩具、做鬼脸 vs 微笑',
  '🔢 样本越多越准：换个角度、换个距离多拍几张',
  '🤔 AI 认错了很正常——它只见过你拍的那些画面。多拍几张不一样的，它就变聪明了',
];

export default function PlaygroundScreen() {
  const nav = useNavigate();
  const { current: profile } = useProfileStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [classNames, setClassNames] = useState<string[]>(['类别 1', '类别 2', '类别 3']);
  const [sampleCounts, setSampleCounts] = useState([0, 0, 0]);
  const [capturing, setCapturing] = useState<number | null>(null);
  const [sims, setSims] = useState([0, 0, 0]);
  const [prediction, setPrediction] = useState<{ label: number; conf: number } | null>(null);
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  // ---------- 载入已保存的模型与任务进度 ----------
  useEffect(() => {
    if (!profile) { nav('/'); return; }
    recognizer.ensureModel();
    void api.playground(profile.id).then((m) => {
      if (m.classes?.length) {
        recognizer.loadModel(m);
        setClassNames(recognizer.model.classes.map((c) => c.name));
        setSampleCounts(recognizer.model.classes.map((c) => c.samples.length));
      }
    }).catch(() => {});
    void api.progress(profile.id).then((p: ProfileProgress) => {
      const lp = p.lessons['playground'];
      if (lp) setTaskDone(Object.fromEntries(Object.entries(lp.tasks).map(([k, v]) => [k, v.done])));
    }).catch(() => {});
    return () => { recognizer.stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // ---------- 实时识别循环（4 次/秒） ----------
  useEffect(() => {
    if (!camOn) { setSims([0, 0, 0]); setPrediction(null); return; }
    const timer = setInterval(() => {
      setSims(recognizer.similarityByClass());
      setPrediction(recognizer.predict());
    }, 250);
    return () => clearInterval(timer);
  }, [camOn]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // 任务 t1 自动校验（样本数）
  useEffect(() => {
    const ready = sampleCounts.filter((n) => n >= 10).length >= 2;
    setTaskDone((prev) => (ready && !prev.t1 ? { ...prev, t1: true } : !ready && prev.t1 ? { ...prev, t1: false } : prev));
  }, [sampleCounts]);

  useEffect(() => {
    if (!profile) return;
    const lp = taskDone['t1'];
    if (lp) void api.updateProgress(profile.id, { lessonId: 'playground', tasks: taskDone }).catch(() => {});
  }, [taskDone, profile]);

  const toggleCam = useCallback(async () => {
    if (camOn) {
      recognizer.stopCamera();
      setCamOn(false);
      return;
    }
    try {
      if (videoRef.current) await recognizer.ensureCamera(videoRef.current);
      setCamOn(true);
      setCamError(null);
    } catch {
      setCamError('没有找到可用的摄像头。让爸爸妈妈检查一下摄像头权限，或者换一台有摄像头的电脑～');
    }
  }, [camOn]);

  // ---------- 长按连拍 ----------
  const startCapture = (idx: number) => {
    if (!camOn) { setToast('先打开摄像头再拍样本哦 📷'); return; }
    setCapturing(idx);
    const one = () => setSampleCounts((prev) => {
      const n = recognizer.capture(idx);
      const next = [...prev];
      next[idx] = n;
      return next;
    });
    one();
    captureTimer.current = setInterval(one, 250);
  };
  const stopCapture = () => {
    setCapturing(null);
    clearInterval(captureTimer.current);
    playSound('pop');
  };

  const renameClass = (idx: number, name: string) => {
    recognizer.ensureModel();
    recognizer.model.classes[idx].name = name.slice(0, 12);
    setClassNames(recognizer.model.classes.map((c) => c.name));
  };

  const clearClass = (idx: number) => {
    recognizer.clearClass(idx);
    setSampleCounts(recognizer.model.classes.map((c) => c.samples.length));
  };

  const saveModel = async () => {
    if (!profile) return;
    if (!recognizer.hasModel()) { setToast('每个类别至少 3 张样本，两类以上才能保存哦'); return; }
    try {
      await api.savePlayground(profile.id, recognizer.model);
      setTaskDone((prev) => ({ ...prev, t3: true }));
      localStorage.setItem('island-has-model', '1');
      setToast('🧠 AI 大脑已保存！去自由创造里用「当 AI 认出」积木吧！');
    } catch (e) {
      setToast(`保存失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  if (!profile) return null;

  const doneCount = TASKS.filter((t) => !t.optional && taskDone[t.id]).length;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-4xl">🧠</span>
          <div>
            <h1 className="text-2xl font-black">AI 实验室 · 训练你的 AI</h1>
            <p className="text-sm text-slate-500">大人们总说 AI 很聪明——现在轮到你当它的老师，教它认你想要的东西！</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* 摄像头区 */}
          <div className="rounded-3xl bg-white/90 p-4 shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">📷 摄像头</h2>
              <button
                onClick={() => void toggleCam()}
                className={`rounded-xl px-4 py-1.5 font-bold text-white ${camOn ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
              >
                {camOn ? '⏹ 关闭' : '▶ 打开'}
              </button>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-slate-900" style={{ aspectRatio: '4 / 3' }}>
              <video ref={videoRef} playsInline muted className={`h-full w-full scale-x-[-1] object-cover ${camOn ? '' : 'hidden'}`} />
              {!camOn && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                  <span className="text-5xl">📷</span>
                  <span className="text-sm">{camError ?? '打开摄像头开始训练'}</span>
                </div>
              )}
              {camOn && prediction && (
                <div className="absolute bottom-3 left-3 rounded-2xl bg-black/60 px-4 py-2 text-white backdrop-blur">
                  <div className="text-xs opacity-70">AI 认为是</div>
                  <div className="text-xl font-black">{classNames[prediction.label]}（{Math.round(prediction.conf * 100)}%）</div>
                </div>
              )}
            </div>
            <p className="mt-3 rounded-xl bg-emerald-50 p-2 text-xs leading-relaxed text-emerald-800">
              🔒 画面只在这台电脑上计算，不会传到任何地方——这是创意岛的承诺。
            </p>
          </div>

          {/* 训练区 */}
          <div className="flex flex-col gap-3">
            <h2 className="font-bold">🎯 教它认 3 样东西（至少教两样）</h2>
            {recognizer.model.classes.map((c, idx) => (
              <div key={idx} className={`rounded-2xl bg-white/90 p-3 shadow-sm transition ${capturing === idx ? 'ring-4 ring-sky-400' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 font-black text-sky-700">{idx + 1}</span>
                  <input
                    value={classNames[idx]}
                    onChange={(e) => renameClass(idx, e.target.value)}
                    placeholder="给它起个名字，如：举左手"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-1.5 outline-none focus:border-sky-400"
                  />
                  <span className={`text-sm font-bold ${sampleCounts[idx] >= 10 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {sampleCounts[idx]}/{MAX_SAMPLES_PER_CLASS} 张
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onPointerDown={() => startCapture(idx)}
                    onPointerUp={stopCapture}
                    onPointerLeave={stopCapture}
                    className={`flex-1 rounded-xl py-2 font-bold text-white ${capturing === idx ? 'bg-sky-600' : 'bg-sky-500 hover:bg-sky-600'}`}
                  >
                    {capturing === idx ? '📸 拍拍拍…（松手停）' : '📸 长按拍样本'}
                  </button>
                  <button onClick={() => clearClass(idx)} className="rounded-xl bg-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-rose-100 hover:text-rose-600">清空</button>
                </div>
                {/* 实时相似度 */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${Math.round(sims[idx] * 100)}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs text-slate-400">{Math.round(sims[idx] * 100)}%</span>
                </div>
              </div>
            ))}

            <button onClick={() => void saveModel()} className="rounded-2xl bg-violet-500 py-3 text-lg font-black text-white shadow hover:bg-violet-600">
              💾 保存 AI 大脑
            </button>
            <button onClick={() => nav('/freeplay')} className="rounded-2xl bg-amber-400 py-2.5 font-bold text-white shadow hover:bg-amber-500">
              🚀 去自由创造，用「当 AI 认出」积木做手势游戏 →
            </button>
          </div>
        </div>

        {/* 任务与秘籍 */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white/90 p-4 shadow-md">
            <h2 className="mb-2 font-bold">🧪 训练师任务 {doneCount}/{TASKS.filter((t) => !t.optional).length}</h2>
            <ul className="space-y-1.5">
              {TASKS.map((t) => {
                const done = !!taskDone[t.id];
                return (
                  <li key={t.id} className={`flex items-start gap-2 rounded-xl border p-2 text-[15px] ${done ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                    {t.auto ? (
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>✓</span>
                    ) : (
                      <button
                        onClick={() => setTaskDone((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}
                      >{done ? '✓' : ''}</button>
                    )}
                    <span className={t.optional ? 'text-amber-600' : ''}>{t.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="rounded-3xl bg-white/90 p-4 shadow-md">
            <h2 className="mb-2 font-bold">💡 训练师秘籍</h2>
            <ul className="space-y-1.5 text-[15px] text-slate-600">
              {TIPS.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <p className="mt-3 rounded-xl bg-amber-50 p-2 text-xs leading-relaxed text-amber-800">
              🧠 你在做的和真正的 AI 科学家是同一件事：收集数据 → 训练 → 测试 → 改进。AI 不是魔法，是例子教出来的！
            </p>
          </div>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-800/90 px-5 py-3 text-white shadow-xl">{toast}</div>
      )}
    </div>
  );
}
