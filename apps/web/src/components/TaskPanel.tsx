import type { Lesson, LessonTask } from '@shared/types.ts';

interface Props {
  lesson: Lesson;
  taskDone: Record<string, boolean>;
  onToggleManual: (taskId: string) => void;
  onAskHint: (taskText: string, hintPrompts: string[]) => void;
}

export default function TaskPanel({ lesson, taskDone, onToggleManual, onAskHint }: Props) {
  const required = lesson.tasks.filter((t) => !t.optional);
  const challenges = lesson.tasks.filter((t) => t.optional);
  const doneCount = required.filter((t) => taskDone[t.id]).length;
  const challengeDone = challenges.filter((t) => taskDone[t.id]).length;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto rounded-2xl bg-white/90 p-4 shadow-md">
      <div>
        <div className="text-2xl">{lesson.emoji}</div>
        <h2 className="text-lg font-bold">{lesson.title}</h2>
        {lesson.curriculum && (
          <div className="mt-1 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700" title="对标的校内课程标准">
            📗 对标课标：{lesson.curriculum.stage}·{lesson.curriculum.module}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-amber-50 p-2 text-sm leading-relaxed text-amber-900">
        <div className="mb-1 font-semibold">🎯 这一课的目标</div>
        <ul className="list-inside list-disc space-y-0.5">
          {lesson.goals.map((g) => <li key={g}>{g}</li>)}
        </ul>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${required.length ? (doneCount / required.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm font-bold text-emerald-700">{doneCount}/{required.length}</span>
      </div>

      <ol className="space-y-2">
        {required.map((t, i) => (
          <TaskItem key={t.id} task={t} index={i + 1} done={!!taskDone[t.id]} onToggleManual={onToggleManual} onAskHint={onAskHint} />
        ))}
      </ol>

      {challenges.length > 0 && (
        <>
          <div className="mt-1 flex items-center gap-2 border-t border-dashed border-slate-200 pt-3">
            <span className="font-bold text-amber-500">⭐ 挑战任务</span>
            <span className="text-xs text-slate-400">选做，做到就是创意岛高手 {challengeDone}/{challenges.length}</span>
          </div>
          <ol className="space-y-2">
            {challenges.map((t) => (
              <TaskItem key={t.id} task={t} index={-1} done={!!taskDone[t.id]} onToggleManual={onToggleManual} onAskHint={onAskHint} />
            ))}
          </ol>
        </>
      )}

      <p className="mt-auto text-xs text-slate-400">带 ✓ 的任务做完会自动亮起来；打勾框的任务由你自己确认</p>
    </div>
  );
}

function TaskItem({ task, index, done, onToggleManual, onAskHint }: {
  task: LessonTask;
  index: number; // -1 表示挑战任务，不显示序号
  done: boolean;
  onToggleManual: (taskId: string) => void;
  onAskHint: (taskText: string, hintPrompts: string[]) => void;
}) {
  return (
    <li
      className={`rounded-xl border p-2 text-[15px] transition ${
        done ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        {task.check.type === 'manual' ? (
          <button
            onClick={() => onToggleManual(task.id)}
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm ${
              done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'
            }`}
            title="自己打勾"
          >
            {done ? '✓' : ''}
          </button>
        ) : (
          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${
            done ? 'bg-emerald-500 text-white' : index > 0 ? 'bg-slate-200 text-slate-500' : 'bg-amber-100 text-amber-600'
          }`}>
            {done ? '✓' : index > 0 ? index : '⭐'}
          </span>
        )}
        <span className="flex-1">{task.text}</span>
      </div>
      {!done && (
        <button
          onClick={() => onAskHint(task.text, task.hintPrompts)}
          className="mt-1 ml-8 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
        >
          🆘 要一点提示
        </button>
      )}
    </li>
  );
}
