import type { Lesson, LessonTask } from '@shared/types.ts';

interface Props {
  lesson: Lesson;
  taskDone: Record<string, boolean>;
  ideaHint?: string | null;
  onToggleManual: (taskId: string) => void;
  onAskHint: (taskText: string, hintPrompts: string[]) => void;
}

/** 探险日志：不说「目标/任务」，只记录你们的探索与发现（校验器在暗中点亮发现） */
export default function TaskPanel({ lesson, taskDone, ideaHint, onToggleManual, onAskHint }: Props) {
  const required = lesson.tasks.filter((t) => !t.optional);
  const challenges = lesson.tasks.filter((t) => t.optional);
  const found = required.filter((t) => taskDone[t.id]).length;
  const challengeDone = challenges.filter((t) => taskDone[t.id]).length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto rounded-2xl bg-white/90 p-4 shadow-md">
      <div>
        <div className="text-2xl">{lesson.emoji}</div>
        <h2 className="text-lg font-bold">{lesson.title}</h2>
        {ideaHint ? (
          <div className="mt-1 rounded-xl bg-violet-50 p-2 text-xs leading-relaxed text-violet-700">
            💡 你今天的点子：{ideaHint}
          </div>
        ) : lesson.story ? (
          <div className="mt-1 rounded-xl bg-amber-50/70 p-2 text-xs leading-relaxed text-amber-800">
            {lesson.story.slice(0, 64)}…
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-violet-600">✨ 探险发现</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-violet-400 transition-all"
            style={{ width: `${required.length ? (found / required.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm font-bold text-violet-500">{found}/{required.length}</span>
      </div>

      <ol className="space-y-2">
        {required.map((t) => (
          <TaskItem key={t.id} task={t} done={!!taskDone[t.id]} onToggleManual={onToggleManual} onAskHint={onAskHint} />
        ))}
      </ol>

      {challenges.length > 0 && (
        <>
          <div className="mt-1 flex items-center gap-2 border-t border-dashed border-slate-200 pt-3">
            <span className="font-bold text-amber-500">⭐ 隐藏关卡</span>
            <span className="text-xs text-slate-400">找到就是创意岛高手 {challengeDone}/{challenges.length}</span>
          </div>
          <ol className="space-y-2">
            {challenges.map((t) => (
              <TaskItem key={t.id} task={t} done={!!taskDone[t.id]} onToggleManual={onToggleManual} onAskHint={onAskHint} />
            ))}
          </ol>
        </>
      )}

      <p className="mt-auto text-xs text-slate-400">做着做着，「发现」会自己亮起来——那是你学会的证明 ✨</p>
    </div>
  );
}

function TaskItem({ task, done, onToggleManual, onAskHint }: {
  task: LessonTask;
  done: boolean;
  onToggleManual: (taskId: string) => void;
  onAskHint: (taskText: string, hintPrompts: string[]) => void;
}) {
  return (
    <li
      className={`rounded-xl border p-2 text-[15px] transition ${
        done ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        {task.check.type === 'manual' ? (
          <button
            onClick={() => onToggleManual(task.id)}
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm ${
              done ? 'border-violet-500 bg-violet-500 text-white' : 'border-slate-300 bg-white'
            }`}
            title="自己确认"
          >
            {done ? '✓' : ''}
          </button>
        ) : (
          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${
            done ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-400'
          }`}>
            {done ? '✨' : '·'}
          </span>
        )}
        <span className={`flex-1 ${done ? 'text-slate-400 line-through decoration-violet-300' : ''}`}>{task.text}</span>
      </div>
      {!done && (
        <button
          onClick={() => onAskHint(task.text, task.hintPrompts)}
          className="mt-1 ml-8 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
        >
          💡 给我一点灵感
        </button>
      )}
    </li>
  );
}
