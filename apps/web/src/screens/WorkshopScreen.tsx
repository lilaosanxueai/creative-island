import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BuddyMode, ChatContext, Lesson, Settings } from '@shared/types.ts';
import { DEFAULT_SETTINGS } from '@shared/types.ts';
import { api } from '../api.ts';
import { useProfileStore } from '../stores/profile.ts';
import BlocklyWorkspace, { type WorkspaceApi } from '../components/BlocklyWorkspace.tsx';
import Stage from '../components/Stage.tsx';
import TaskPanel from '../components/TaskPanel.tsx';
import AIBuddy, { type BuddyHandle } from '../components/AIBuddy.tsx';
import { buildToolbox } from '../blocks/toolbox.ts';
import { ALL_BLOCK_TYPES, BLOCK_LABELS } from '../blocks/definitions.ts';
import { StageState, setRunSpeed, getRunSpeed, type RunSpeed } from '../runtime/stageState.ts';
import { playSound, isMuted, setMuted } from '../runtime/sounds.ts';
import { Executor } from '../runtime/executor.ts';
import { evaluateTasks, requiredTasksDone, type RunEvidence } from '../runtime/validators.ts';
import { recognizer } from '../ml/recognizer.ts';
import { parsePy, PyRunner } from '../runtime/pyinterp.ts';
import { pyStageApi } from '../runtime/pyBridge.ts';
import { workspaceToPython } from '../blocks/python.ts';
import { guideRespond, newGuideState, type GuideState } from '../runtime/guideBrain.ts';

export interface WorkshopMode {
  kind: 'lesson' | 'freeplay';
  lessonId?: string;
}

const FREEPLAY_LESSON: Lesson = {
  id: 'freeplay',
  island: '自由创造岛',
  order: 99,
  title: '自由创造',
  emoji: '✨',
  story: '',
  goals: [],
  toolbox: ALL_BLOCK_TYPES,
  actor: { costume: '🤖', x: 0, y: 0 },
  tasks: [],
  aiIntro: '',
  celebrate: '',
};

const IDEAS = [
  { emoji: '🎈', title: '追泡泡小游戏', desc: '用方向键控制角色去碰天上的气球' },
  { emoji: '📖', title: '会讲故事的机器人', desc: '让机器人一句一句讲你自己编的故事' },
  { emoji: '🎹', title: '键盘钢琴', desc: '按不同键播放不同声音，弹一首小曲子' },
];

const SPEED_LABEL: Record<RunSpeed, string> = { slow: '🐢 慢速', normal: '▶ 常速', fast: '🐇 快速' };

/** 任务完成喝彩：夸努力和方法，不夸聪明（教育设计的经典原则） */
const CHEERS = [
  (t: string) => `🎉 又完成一步！「${t}」被你搞定了——你刚才自己动手试的那几下特别关键！`,
  (t: string) => `✅ 漂亮！我注意到你刚才调整了积木再试了一次，这就叫「试错精神」，创作者都靠它！`,
  (t: string) => `💪 帅啊！「${t}」完成！遇到卡点你没有放弃，这一点我最佩服！`,
];

export default function WorkshopScreen({ mode }: { mode: WorkshopMode }) {
  const nav = useNavigate();
  const { current: profile } = useProfileStore();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [draftXml, setDraftXml] = useState<string | null>(null);
  const [progressReady, setProgressReady] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>({});
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [buddyOpen, setBuddyOpen] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [speed, setSpeed] = useState<RunSpeed>(getRunSpeed());
  const [muted, setMutedState] = useState(isMuted());
  const [camOn, setCamOn] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [codeText, setCodeText] = useState('');
  const [codeError, setCodeError] = useState<{ line: number; message: string; hint?: string } | null>(null);
  const [restOverlay, setRestOverlay] = useState(false);
  const [restCountdown, setRestCountdown] = useState(0);
  const [locked, setLocked] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const wsApiRef = useRef<WorkspaceApi | null>(null);
  const stageRef = useRef(new StageState());
  const execRef = useRef<Executor | null>(null);
  const pyRunnerRef = useRef<PyRunner | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const buddyRef = useRef<BuddyHandle>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);
  const lastFiredLabel = useRef<string | null>(null);
  const codeTextRef = useRef(codeText);
  codeTextRef.current = codeText;
  const codeModeRef = useRef(codeMode);
  codeModeRef.current = codeMode;
  const codeDraftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mountTimeRef = useRef(Date.now());
  const lastRestRef = useRef(Date.now());
  const guideRef = useRef<GuideState>(newGuideState());
  const lastActivityRef = useRef(Date.now());
  const hadBlocksRef = useRef(false);
  const [ideaHint, setIdeaHint] = useState<string | null>(null);

  const sayGuide = useCallback((ev: Parameters<typeof guideRespond>[0]) => {
    const line = guideRespond(ev, guideRef.current);
    if (line) buddyRef.current?.sayLocal(line);
  }, []);
  const taskDoneRef = useRef(taskDone);
  taskDoneRef.current = taskDone;
  const completedRef = useRef(lessonCompleted);
  completedRef.current = lessonCompleted;
  const cheerIdx = useRef(0);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ---------- 加载课程与设置 ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, l] = await Promise.all([
        api.settings().catch(() => DEFAULT_SETTINGS),
        mode.kind === 'lesson'
          ? api.lessons().then((all) => all.find((x) => x.id === mode.lessonId) ?? null)
          : Promise.resolve(FREEPLAY_LESSON),
      ]);
      if (!alive) return;
      setSettings(s);
      setWsReady(false);
      if (!l) { setToast('找不到这一课'); setProgressReady(true); return; }
      setLesson(l);
      if (mode.kind === 'freeplay') {
        const idea = localStorage.getItem('island-idea');
        if (idea) { setIdeaHint(idea); localStorage.removeItem('island-idea'); }
        else setIdeaHint(null);
      }
      setCodeMode(!!l.codeLesson);
      setCodeText(l.starterCode ?? '');
      stageRef.current.reset(l.actor, l.targets);
      setProgressReady(false);
      if (profile) {
        try {
          const p = await api.progress(profile.id);
          if (!alive) return;
          const lp = p.lessons[l.id];
          if (lp) {
            setTaskDone(Object.fromEntries(Object.entries(lp.tasks).map(([k, v]) => [k, v.done])));
            setLessonCompleted(lp.status === 'completed');
          }
          setDraftXml(p.lessonDrafts?.[l.id] ?? null);
          const savedCode = p.lessonCodes?.[l.id];
          if (savedCode) setCodeText(savedCode);
        } catch { /* 首次学习无进度 */ }
      }
      if (alive) setProgressReady(true);
    })();
    return () => { alive = false; clearTimeout(draftTimer.current); };
  }, [mode.kind, mode.lessonId, profile]);

  // 画布挂载 + 进度就绪后，显式载入草稿（有草稿用草稿，否则保留课程初始积木）
  useEffect(() => {
    if (!wsReady || !progressReady || !lesson || !wsApiRef.current) return;
    if (draftXml) wsApiRef.current.loadXml(draftXml);
  }, [wsReady, progressReady, lesson, draftXml]);

  // ---------- 运行 ----------
  const collectEvidence = useCallback((hasRun: boolean): RunEvidence => {
    const stage = stageRef.current;
    return {
      blockCounts: wsApiRef.current?.getBlockCounts() ?? {},
      saidTexts: stage.saidTexts,
      reachedTargets: stage.reachedTargetIndices(),
      hasRun,
    };
  }, []);

  const maybeComplete = useCallback((next: Record<string, boolean>) => {
    if (!lesson || lesson.tasks.length === 0) return;
    if (!requiredTasksDone(lesson.tasks, next) || completedRef.current) return;
    setLessonCompleted(true);
    setCelebrate(true);
    if (profile) {
      void api.updateProgress(profile.id, {
        lessonId: lesson.id, tasks: next, completed: true,
        draft: wsApiRef.current?.getXml(),
      }).catch(() => {});
    }
  }, [lesson, profile]);

  const revalidate = useCallback((hasRun: boolean) => {
    if (!lesson || lesson.tasks.length === 0) return;
    const next = evaluateTasks(lesson.tasks, collectEvidence(hasRun), taskDoneRef.current);
    // 新亮起的必做任务 → 伙伴本地喝彩（不耗 token）。先在 setState 外算好，避免副作用塞进 updater
    const newly = lesson.tasks.find(
      (t) => !t.optional && next[t.id] && !taskDoneRef.current[t.id],
    );
    if (newly) {
      buddyRef.current?.sayLocal(CHEERS[cheerIdx.current % CHEERS.length](newly.text.slice(0, 22)));
      cheerIdx.current++;
    }
    setTaskDone((prev) => {
      const changed = lesson.tasks.some((t) => next[t.id] !== prev[t.id]);
      return changed ? next : prev;
    });
    maybeComplete(next);
  }, [lesson, collectEvidence, maybeComplete]);

  /** 事件（按键/点击/AI识别）按当前模式路由到积木执行器或 Python 运行器 */
  const fireHat = useCallback((kind: 'key' | 'click' | 'recognized', arg?: string) => {
    if (codeModeRef.current && pyRunnerRef.current) {
      pyRunnerRef.current.fire(kind === 'key' ? 'key' : kind === 'click' ? 'click' : 'recognize', arg);
    } else if (kind === 'key') {
      void execRef.current?.trigger({ type: 'key', key: arg! });
    } else if (kind === 'click') {
      void execRef.current?.trigger({ type: 'click' });
    } else {
      void execRef.current?.trigger({ type: 'recognized', label: arg! });
    }
  }, []);

  const handleRun = () => {
    if (codeMode) {
      const { program, error } = parsePy(codeText);
      if (error || !program) {
        setCodeError(error ?? { line: 0, message: '代码有点问题' });
        return;
      }
      setCodeError(null);
      pyRunnerRef.current = new PyRunner(program, pyStageApi(stageRef.current));
      setRunning(true);
      void pyRunnerRef.current.run(() => {
        setRunning(false);
        revalidate(true);
        lastActivityRef.current = Date.now();
        sayGuide({ type: 'first-run', ok: !pyRunnerRef.current?.lastError });
        if (pyRunnerRef.current?.lastError) setToast(`程序出了点小问题：${pyRunnerRef.current.lastError}`);
      });
      return;
    }
    const exec = execRef.current;
    if (!exec) return;
    setRunning(true);
    void exec.run(() => {
      setRunning(false);
      revalidate(true);
      lastActivityRef.current = Date.now();
      sayGuide({ type: 'first-run', ok: !exec.lastError });
      if (exec.lastError) setToast(`程序出了点小问题：${exec.lastError}`);
    });
  };

  const handleStop = () => {
    execRef.current?.stop();
    pyRunnerRef.current?.stop();
    setRunning(false);
    revalidate(true);
  };

  const switchMode = () => {
    if (!lesson) return;
    if (!codeMode && !codeText.trim()) {
      // 首次进入代码模式：从积木生成（代码课用 starterCode，已预置）
      const ws = wsApiRef.current?.workspace;
      setCodeText((ws ? workspaceToPython(ws) : '') || lesson.starterCode || 'say("你好，Python！")\n');
    }
    setCodeError(null);
    setCodeMode((v) => !v);
    pyRunnerRef.current?.stop();
    execRef.current?.stop();
    setRunning(false);
  };

  const regenerateFromBlocks = () => {
    if (!confirm('用积木重新生成代码？当前改过的代码会被覆盖。')) return;
    const ws = wsApiRef.current?.workspace;
    setCodeText((ws ? workspaceToPython(ws) : '') || 'say("你好，Python！")\n');
    setCodeError(null);
  };

  const handleCodeChange = (text: string) => {
    setCodeText(text);
    if (codeError) setCodeError(null);
    if (!lesson || !profile) return;
    clearTimeout(codeDraftTimer.current);
    codeDraftTimer.current = setTimeout(() => {
      void api.updateProgress(profile.id, { lessonId: lesson.id, code: text }).catch(() => {});
    }, 1500);
  };

  // ---------- 工作区变化：校验 + 草稿自动保存 ----------
  const handleWorkspaceChange = useCallback(() => {
    revalidate(false);
    lastActivityRef.current = Date.now();
    const counts = wsApiRef.current?.getBlockCounts() ?? {};
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0 && !hadBlocksRef.current) {
      hadBlocksRef.current = true;
      sayGuide({ type: 'first-block' });
    }
    if (!lesson || !profile || !wsApiRef.current) return;
    // 立即快照 XML：防抖等待期间 workspace 可能被销毁（切课/关页）
    const xml = wsApiRef.current.getXml();
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void api.updateProgress(profile.id, { lessonId: lesson.id, draft: xml }).catch(() => {});
    }, 1500);
  }, [revalidate, lesson, profile]);

  // ---------- 键盘（运行中生效） ----------
  useEffect(() => {
    if (!running) return;
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
      if (!stageRef.current.keysHeld.has(k)) {
        stageRef.current.keysHeld.add(k);
        fireHat('key', k);
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = map(e);
      if (k) stageRef.current.keysHeld.delete(k);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      stageRef.current.keysHeld.clear();
    };
  }, [running]);

  // ---------- 使用时长心跳（每分钟上报；超时可选锁定）+ 发呆观察 ----------
  useEffect(() => {
    if (!profile) return;
    const timer = setInterval(() => {
      void api.updateProgress(profile.id, { minutesDelta: 1 })
        .then((p) => {
          const today = new Date().toISOString().slice(0, 10);
          const used = p.dailyUsage[today] ?? 0;
          if (used >= settings.limits.dailyMinutes) {
            const unlockedKey = `island-unlocked-${today}`;
            if (settings.limits.hardStop && !localStorage.getItem(unlockedKey)) {
              setLocked(true);
            } else {
              setToast('🏖 今天的创作时间到啦，保存好作品，休息一下眼睛吧！');
            }
          }
        })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(timer);
  }, [profile, settings.limits.dailyMinutes, settings.limits.hardStop]);

  // 发呆观察：45 秒无活动，伙伴轻轻开口（画布空时换开场引导）
  useEffect(() => {
    const timer = setInterval(() => {
      if (running || locked) return;
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 45_000) return;
      const counts = wsApiRef.current?.getBlockCounts() ?? {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      sayGuide(total === 0 && !codeMode ? { type: 'empty-stage' } : { type: 'idle', seconds: Math.round(idleMs / 1000) });
      lastActivityRef.current = Date.now(); // 说完重置，避免连续打扰
    }, 15_000);
    return () => clearInterval(timer);
  }, [running, locked, codeMode, sayGuide]);

  const unlockWithPin = async () => {
    const r = await api.verifyPin(pinInput).catch(() => ({ ok: false }));
    if (r.ok) {
      localStorage.setItem(`island-unlocked-${new Date().toISOString().slice(0, 10)}`, '1');
      setLocked(false);
      setPinInput('');
    } else {
      setToast('PIN 不对哦，请爸爸妈妈来输入');
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- 保存作品 ----------
  const snapshot = (): string => {
    const src = canvasRef.current;
    if (!src) return '';
    const small = document.createElement('canvas');
    small.width = 240;
    small.height = 180;
    small.getContext('2d')!.drawImage(src, 0, 0, 240, 180);
    return small.toDataURL('image/jpeg', 0.75);
  };

  const doSave = async () => {
    if (!profile || !lesson || !wsApiRef.current) return;
    try {
      await api.saveProject({
        profileId: profile.id,
        title: saveTitle.trim() || `${lesson.title}-${new Date().toLocaleDateString('zh-CN')}`,
        xml: wsApiRef.current?.getXml() ?? '<xml></xml>',
        thumb: snapshot(),
        lessonId: lesson.id === 'freeplay' ? undefined : lesson.id,
        stage: { actor: lesson.actor, targets: lesson.targets },
        code: codeMode ? codeText : undefined,
      });
      setSaveOpen(false);
      setSaveTitle('');
      setToast('🖼 作品已经挂到作品墙啦！');
    } catch (e) {
      setToast(`保存失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  // ---------- AI 上下文 ----------
  const buildContext = useCallback((): ChatContext => {
    const counts = wsApiRef.current?.getBlockCounts() ?? {};
    const labels: Record<string, number> = {};
    for (const [type, n] of Object.entries(counts)) {
      if (BLOCK_LABELS[type]) labels[BLOCK_LABELS[type]] = n;
    }
    const undone = lesson?.tasks.find((t) => !taskDoneRef.current[t.id]);
    const exec = execRef.current;
    return {
      screen: mode.kind === 'lesson' ? 'lesson' : 'freeplay',
      lessonTitle: lesson?.title,
      lessonGoals: lesson?.goals,
      currentTask: undone?.text,
      hintPrompts: undone?.hintPrompts,
      blockCounts: labels,
      runOk: exec ? !exec.lastError : undefined,
      lastError: exec?.lastError ?? undefined,
    };
  }, [lesson, mode.kind]);

  const toolbox = useMemo(() => buildToolbox(lesson?.toolbox ?? ALL_BLOCK_TYPES), [lesson]);

  // ---------- 工具条动作 ----------
  const cycleSpeed = () => {
    const order: RunSpeed[] = ['normal', 'slow', 'fast'];
    const next = order[(order.indexOf(speed) + 1) % order.length];
    setSpeed(next);
    setRunSpeed(next);
    setToast(next === 'slow' ? '🐢 慢速模式：看清楚程序一步一步怎么走！' : next === 'fast' ? '🐇 快速模式！' : '▶ 常速模式');
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => setToast('这台设备不支持全屏'));
  };
  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
    if (muted) playSound('ding');
  };

  // ---------- AI 识别：开启摄像头后持续识别，变化时触发「当 AI 认出」帽子 ----------
  const toggleCam = async () => {
    if (camOn) {
      recognizer.stopCamera();
      setCamOn(false);
      stageRef.current.recognized = null;
      return;
    }
    if (!recognizer.hasModel()) {
      setToast('先去地图上的 🧠 AI 实验室，教它认东西再来！');
      return;
    }
    try {
      if (hiddenVideoRef.current) await recognizer.ensureCamera(hiddenVideoRef.current);
      setCamOn(true);
      setToast('📷 AI 眼睛已打开！点 ▶ 运行后，做动作就能触发「当 AI 认出」积木');
    } catch {
      setToast('摄像头打不开，让爸爸妈妈检查一下权限设置～');
    }
  };

  useEffect(() => {
    if (!camOn) { lastFiredLabel.current = null; return; }
    const timer = setInterval(() => {
      const pred = recognizer.predict();
      const stage = stageRef.current;
      if (pred && pred.conf >= 0.6) {
        const label = String(pred.label);
        stage.recognized = label;
        stage.recognizedConfidence = pred.conf;
        if (running && label !== lastFiredLabel.current) {
          lastFiredLabel.current = label;
          fireHat('recognized', label);
        }
      } else {
        stage.recognized = null;
        if (!pred) lastFiredLabel.current = null;
      }
    }, 250);
    return () => clearInterval(timer);
  }, [camOn, running]);

  // 离开工作台时关掉摄像头
  useEffect(() => () => { recognizer.stopCamera(); }, []);

  // 卸载时立即保存代码草稿
  useEffect(() => {
    return () => {
      clearTimeout(codeDraftTimer.current);
      const text = codeTextRef.current;
      if (lesson && profile && text.trim()) {
        void api.updateProgress(profile.id, { lessonId: lesson.id, code: text }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, profile]);

  // ---------- 护眼 20-20-20：连续 20 分钟，远眺 20 秒 ----------
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      if (now - mountTimeRef.current >= 20 * 60_000 && now - lastRestRef.current >= 20 * 60_000) {
        lastRestRef.current = now;
        setRestCountdown(20);
        setRestOverlay(true);
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!restOverlay || restCountdown <= 0) return;
    const t = setTimeout(() => {
      setRestCountdown((c) => {
        if (c <= 1) { setRestOverlay(false); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [restOverlay, restCountdown]);

  if (!profile) {
    return <Center><button className="rounded-xl bg-sky-500 px-6 py-3 font-bold text-white" onClick={() => nav('/')}>先选一个角色吧 👋</button></Center>;
  }
  if (!lesson) {
    return <Center>正在打开工作台…</Center>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="flex items-center gap-2 bg-white/70 px-3 py-2 backdrop-blur">
        <button onClick={() => nav('/map')} className="rounded-xl bg-slate-200 px-3 py-1.5 font-bold hover:bg-slate-300">← 地图</button>
        <h1 className="text-lg font-black">{lesson.emoji} {lesson.title}</h1>
        {lesson.tasks.length > 0 && (
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${
            requiredTasksDone(lesson.tasks, taskDone) ? 'bg-violet-500 text-white' : 'bg-violet-100 text-violet-700'
          }`}>
            ✨ 发现 {lesson.tasks.filter((t) => !t.optional && taskDone[t.id]).length}/{lesson.tasks.filter((t) => !t.optional).length}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={() => setSaveOpen(true)} className="rounded-xl bg-violet-500 px-3 py-1.5 font-bold text-white hover:bg-violet-600">💾 存作品</button>
          <button
            onClick={() => setBuddyOpen((v) => !v)}
            className="rounded-xl bg-slate-200 px-3 py-1.5 font-bold hover:bg-slate-300"
          >
            {settings.buddy.emoji} {buddyOpen ? '收起伙伴' : '展开伙伴'}
          </button>
        </div>
      </header>

      {/* 工具条 */}
      <div className="flex items-center gap-1.5 bg-white/50 px-3 pb-1.5 text-sm">
        <ToolBtn title="撤销（放错积木不要紧）" onClick={() => wsApiRef.current?.workspace.undo(false)}>↩️ 撤销</ToolBtn>
        <ToolBtn title="重做" onClick={() => wsApiRef.current?.workspace.undo(true)}>↪️ 重做</ToolBtn>
        <ToolBtn title="把积木排整齐" onClick={() => wsApiRef.current?.workspace.cleanUp()}>🧹 整理</ToolBtn>
        <span className="mx-1 text-slate-300">|</span>
        <ToolBtn title="切换运行速度：慢速能看清每一步" onClick={cycleSpeed}>{SPEED_LABEL[speed]}</ToolBtn>
        <ToolBtn title="看看你的积木变成了什么代码" onClick={() => { setCodeText(wsApiRef.current?.getCode() ?? ''); setCodeOpen(true); }}>👀 魔法代码</ToolBtn>
        <span className="mx-1 text-slate-300">|</span>
        <ToolBtn title={muted ? '打开音效' : '关掉音效'} onClick={toggleMute}>{muted ? '🔇' : '🔊'}</ToolBtn>
        <ToolBtn title={camOn ? '关闭 AI 摄像头' : '打开 AI 摄像头（需先在 AI 实验室训练）'} onClick={() => void toggleCam()}>{camOn ? '📷 AI 眼睛开' : '📷 AI 眼睛'}</ToolBtn>
        <ToolBtn title={codeMode ? '回到积木画布' : '看看积木变成的 Python 代码（可以直接改！）'} onClick={switchMode}>{codeMode ? '🧩 积木模式' : '🐍 代码模式'}</ToolBtn>
        <ToolBtn title="全屏（更像一台游戏机）" onClick={toggleFullscreen}>⛶ 全屏</ToolBtn>
        <span className="ml-auto pr-1 text-xs text-slate-400">画布会自动保存，放心关掉</span>
      </div>

      {/* 主体三栏 */}
      <div className="flex min-h-0 flex-1 gap-2 p-2">
        {/* 左：任务 / 灵感 */}
        <div className="w-60 shrink-0">
          {lesson.tasks.length > 0 ? (
            <TaskPanel
              lesson={lesson}
              taskDone={taskDone}
              ideaHint={ideaHint}
              onToggleManual={(id) => {
                const next = { ...taskDoneRef.current, [id]: !taskDoneRef.current[id] };
                setTaskDone(next);
                maybeComplete(next);
              }}
              onAskHint={(text) => buddyRef.current?.askInMode('hint', `我在做「${text}」，给我一点提示！`)}
            />
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl bg-white/90 p-4 shadow-md">
              <h2 className="text-lg font-black">✨ 今天想做点什么？</h2>
              {ideaHint && (
                <div className="rounded-xl bg-violet-50 p-2.5 text-sm leading-relaxed text-violet-700">
                  💡 你今天的点子：{ideaHint}——需要什么本领就问旁边的{settings.buddy.name}，或者点下面的灵感卡开工！
                </div>
              )}
              {IDEAS.map((idea) => (
                <div key={idea.title} className="rounded-xl border border-slate-200 p-3">
                  <div className="text-2xl">{idea.emoji}</div>
                  <div className="font-bold">{idea.title}</div>
                  <div className="text-sm text-slate-500">{idea.desc}</div>
                </div>
              ))}
              <button
                onClick={() => buddyRef.current?.askInMode('idea', '给我 3 个今天就能做的小作品点子！')}
                className="mt-auto rounded-xl bg-amber-400 px-3 py-2 font-bold text-white hover:bg-amber-500"
              >
                💡 问{settings.buddy.name}要更多点子
              </button>
            </div>
          )}
        </div>

        {/* 中：积木编辑器 / Python 编辑器（积木保持挂载，切模式不丢状态） */}
        <div className="relative min-w-0 flex-1" key={lesson.id}>
          <div className={`h-full ${codeMode ? 'hidden' : ''}`}>
            {progressReady ? (
              <BlocklyWorkspace
                toolbox={toolbox}
                initialXml={lesson.starterXml}
                onReady={(api) => {
                  wsApiRef.current = api;
                  execRef.current = new Executor(api.workspace, stageRef.current);
                  (window as unknown as { __islandWs?: unknown }).__islandWs = api;
                  (window as unknown as { __islandStage?: unknown }).__islandStage = stageRef.current;
                  setWsReady(true);
                }}
                onChange={handleWorkspaceChange}
                onFlush={(xml) => {
                  clearTimeout(draftTimer.current);
                  if (profile) void api.updateProgress(profile.id, { lessonId: lesson.id, draft: xml }).catch(() => {});
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl bg-white/60 text-slate-400">正在恢复你的画布…</div>
            )}
          </div>

          {codeMode && (
            <div className="flex h-full min-h-0 flex-col rounded-2xl bg-white shadow-md">
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm">
                <span className="font-bold text-slate-700">🐍 Python 代码</span>
                <span className="text-xs text-slate-400">和学校里学的 Python 是同一种语言！直接改，点 ▶ 就能跑</span>
                <div className="ml-auto flex gap-1.5">
                  {!lesson.codeLesson && (
                    <button onClick={regenerateFromBlocks} className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-200">⟲ 从积木重新生成</button>
                  )}
                </div>
              </div>
              <textarea
                value={codeText}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const start = ta.selectionStart;
                    const next = codeText.slice(0, start) + '    ' + codeText.slice(ta.selectionEnd);
                    handleCodeChange(next);
                    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 4; });
                  }
                }}
                spellCheck={false}
                placeholder={'say("你好，Python！")\nfor _ in range(4):\n    move(80)\n    turn_right(90)'}
                className="min-h-0 flex-1 resize-none rounded-b-2xl p-4 font-mono text-[15px] leading-7 text-slate-800 outline-none"
              />
              {codeError && (
                <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                  <b>第 {codeError.line} 行</b>：{codeError.message}{codeError.hint ? `（${codeError.hint}）` : ''}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右：舞台 */}
        <div className={`flex w-[400px] shrink-0 flex-col gap-2 ${buddyOpen ? '' : 'w-[480px]'}`}>
          <Stage
            stage={stageRef.current}
            onCanvasReady={(c) => { canvasRef.current = c; }}
            onSpriteClick={() => { if (running) fireHat('click'); }}
          />
          <div className="flex items-center justify-center gap-4 rounded-2xl bg-white/90 py-3 shadow-md">
            {running ? (
              <button onClick={handleStop} className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-2xl text-white shadow-lg hover:bg-rose-600" title="停止">⏹</button>
            ) : (
              <button onClick={handleRun} className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-lg hover:bg-emerald-600" title="运行">▶</button>
            )}
            <span className="text-sm text-slate-500">{running ? '程序运行中…（点角色可以触发点击事件）' : '点 ▶ 运行你的程序'}</span>
          </div>
        </div>

        {/* 最右：AI 伙伴 */}
        {buddyOpen && (
          <div className="w-80 shrink-0">
            <AIBuddy
              ref={buddyRef}
              profileId={profile.id}
              buddy={settings.buddy}
              defaultMode={mode.kind === 'lesson' ? 'hint' : 'idea'}
              intro={lesson.aiIntro || `嗨！我是${settings.buddy.name}${settings.buddy.emoji} 今天我们做点什么好玩的？`}
              getContext={buildContext}
            />
          </div>
        )}
      </div>

      {/* 魔法代码预览 */}
      {codeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCodeOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-xl font-black">👀 你的积木变成了代码！</h3>
            <p className="mb-4 text-sm text-slate-500">
              你拖的每一块积木，在电脑里其实长这样。以后学文字编程（Python）时，就是直接写这些字——但现在你已经能「读」懂它们啦！
            </p>
            <pre className="rounded-2xl bg-slate-900 p-4 font-mono text-sm leading-relaxed text-emerald-300">{codeText || '（先拖几块积木，这里就会显示出代码）'}</pre>
            <div className="mt-4 text-right">
              <button onClick={() => setCodeOpen(false)} className="rounded-xl bg-slate-200 px-4 py-2 font-bold hover:bg-slate-300">知道了！</button>
            </div>
          </div>
        </div>
      )}

      {/* 保存作品弹窗 */}
      {saveOpen && (
        <Modal onClose={() => setSaveOpen(false)} title="💾 把作品挂到作品墙">
          <input
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            placeholder="给作品起个名字"
            maxLength={30}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-violet-400"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setSaveOpen(false)} className="rounded-xl bg-slate-200 px-4 py-2 font-bold">取消</button>
            <button onClick={() => void doSave()} className="rounded-xl bg-violet-500 px-4 py-2 font-bold text-white hover:bg-violet-600">保存</button>
          </div>
        </Modal>
      )}

      {/* 通关庆祝 */}
      {celebrate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
            <div className="mb-2 text-6xl">🌟</div>
            <h2 className="mb-2 text-2xl font-black text-violet-600">新本领 GET！</h2>
            <p className="mb-3 whitespace-pre-wrap text-slate-600">{lesson.celebrate}</p>
            {lesson.curriculum ? (
              <div className="mb-6 rounded-2xl bg-emerald-50 p-3 text-left">
                <div className="mb-1.5 text-sm font-bold text-emerald-700">
                  📗 本课解锁的课本知识（{lesson.curriculum.stage}·{lesson.curriculum.module}）
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lesson.curriculum.points.map((p) => (
                    <span key={p} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-emerald-700 shadow-sm">✓ {p}</span>
                  ))}
                </div>
              </div>
            ) : <p className="mb-6" />}
            <div className="flex justify-center gap-3">
              <button onClick={() => setCelebrate(false)} className="rounded-xl bg-slate-200 px-4 py-2 font-bold hover:bg-slate-300">再改进一下</button>
              <button onClick={() => nav('/map')} className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-white hover:bg-emerald-600">回到地图 🏝</button>
            </div>
          </div>
        </div>
      )}

      {/* 护眼 20-20-20：连续 20 分钟远眺 20 秒 */}
      {restOverlay && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-900 to-sky-900 text-white">
          <div className="text-7xl">🌌</div>
          <h2 className="text-2xl font-black">眼睛小休息</h2>
          <p className="max-w-sm text-center leading-relaxed opacity-80">
            抬起头，看看窗外<b>最远</b>的地方，眨眨眼～ {restCountdown} 秒后继续冒险
          </p>
          <div className="text-5xl font-black tabular-nums">{restCountdown}</div>
          <button onClick={() => setRestOverlay(false)} className="rounded-xl bg-white/20 px-5 py-2 font-bold hover:bg-white/30">我休息好了</button>
        </div>
      )}

      {/* 到时锁定（家长开启 hardStop 后生效，PIN 解锁当日有效） */}
      {locked && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-slate-900/95 p-6 text-white">
          <div className="text-7xl">🌙</div>
          <h2 className="text-2xl font-black">今天的创作时间用完啦</h2>
          <p className="max-w-sm text-center text-white/70">作品都保存好了。早点休息，明天的小岛还有新冒险等你！</p>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void unlockWithPin()}
              placeholder="家长 PIN"
              className="w-36 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-center text-xl tracking-widest outline-none"
            />
            <button onClick={() => void unlockWithPin()} className="rounded-xl bg-white/20 px-4 py-2 font-bold hover:bg-white/30">解锁</button>
          </div>
          <button onClick={() => nav('/map')} className="rounded-xl bg-white/10 px-5 py-2 text-sm hover:bg-white/20">回地图看看作品</button>
        </div>
      )}

      {/* AI 眼睛的隐藏视频源 */}
      <video ref={hiddenVideoRef} playsInline muted className="hidden" />

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-800/90 px-5 py-3 text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-lg bg-white/80 px-2.5 py-1 font-semibold text-slate-600 shadow-sm transition hover:bg-white hover:text-sky-700"
    >
      {children}
    </button>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen items-center justify-center text-lg">{children}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-black">{title}</h3>
        {children}
      </div>
    </div>
  );
}
