import type { Lesson } from '@shared/types.ts';

interface Props {
  lesson: Lesson;
  taskDone: Record<string, boolean>;
  onToggleManual: (taskId: string) => void;
  onAskHint: (taskText: string, hintPrompts: string[]) => void;
}

export default function TaskPanel({ lesson, taskDone, onToggleManual, onAskHint }: Props) {
  const doneCount = lesson.tasks.filter((t) => taskDone[t.id]).length;
  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto rounded-2xl bg-white/90 p-4 shadow-md">
      <div>
        <div className="text-2xl">{lesson.emoji}</div>
        <h2 className="text-lg font-bold">{lesson.title}</h2>
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
            style={{ width: `${lesson.tasks.length ? (doneCount / lesson.tasks.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm font-bold text-emerald-700">{doneCount}/{lesson.tasks.length}</span>
      </div>

      <ol className="space-y-2">
        {lesson.tasks.map((t, i) => {
          const done = !!taskDone[t.id];
          return (
            <li
              key={t.id}
              className={`rounded-xl border p-2 text-[15px] transition ${
                done ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-2">
                {t.check.type === 'manual' ? (
                  <button
                    onClick={() => onToggleManual(t.id)}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm ${
                      done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'
                    }`}
                    title="自己打勾"
                  >
                    {done ? '✓' : ''}
                  </button>
                ) : (
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {done ? '✓' : i + 1}
                  </span>
                )}
                <span className="flex-1">{t.text}</span>
              </div>
              {!done && (
                <button
                  onClick={() => onAskHint(t.text, t.hintPrompts)}
                  className="mt-1 ml-8 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                >
                  🆘 要一点提示
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-auto text-xs text-slate-400">带 ✓ 的任务做完会自动亮起来；打勾框的任务由你自己确认</p>
    </div>
  );
}
