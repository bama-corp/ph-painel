import { useState, type KeyboardEvent } from "react";
import {
  createSubtask,
  subtasksProgress,
  type TaskSubtask,
} from "../domain/tasks";

type Props = {
  subtasks: TaskSubtask[];
  disabled?: boolean;
  onChange: (next: TaskSubtask[]) => void;
};

export function TaskSubtasks({ subtasks, disabled = false, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const { done, total } = subtasksProgress(subtasks);

  function commitAdd() {
    const title = draft.trim();
    if (!title) return;
    onChange([...subtasks, createSubtask(title)]);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitAdd();
    }
  }

  function toggle(id: string) {
    onChange(subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  }

  function rename(id: string, title: string) {
    const t = title.trim();
    if (!t) return;
    onChange(subtasks.map((s) => (s.id === id ? { ...s, title: t } : s)));
  }

  function remove(id: string) {
    onChange(subtasks.filter((s) => s.id !== id));
  }

  return (
    <div className="mt-2 max-w-xl">
      {total > 0 ? (
        <p className="mb-1.5 text-[0.65rem] uppercase tracking-[0.14em] text-ink/35">
          Subtarefas · <span className="num text-ink/55">{done}</span>/{total}
        </p>
      ) : null}
      <ul className="space-y-0.5 sm:space-y-1">
        {subtasks.map((s) => (
          <li key={s.id} className="group flex min-h-11 items-center gap-2.5 sm:min-h-0 sm:gap-2">
            <input
              type="checkbox"
              checked={s.done}
              disabled={disabled}
              onChange={() => toggle(s.id)}
              className="accent-ink h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5"
              aria-label={s.done ? "Reabrir subtarefa" : "Concluir subtarefa"}
            />
            <input
              className={`min-w-0 flex-1 border-b border-transparent bg-transparent py-2 text-base outline-none focus:border-ink/20 disabled:opacity-60 sm:py-0 sm:text-sm ${
                s.done ? "text-ink/40 line-through" : "text-ink/75"
              }`}
              defaultValue={s.title}
              key={`${s.id}-${s.title}`}
              disabled={disabled}
              onBlur={(e) => {
                if (e.target.value.trim() !== s.title) rename(s.id, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label="Título da subtarefa"
            />
            {!disabled ? (
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-base text-ink/30 hover:text-rust sm:h-auto sm:w-auto sm:text-[0.65rem] sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                onClick={() => remove(s.id)}
                aria-label="Apagar subtarefa"
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!disabled ? (
        <div className="mt-1 flex min-h-11 items-center gap-2 sm:min-h-0 sm:mt-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={() => {
              if (draft.trim()) commitAdd();
            }}
            placeholder="+ Subtarefa"
            className="min-w-0 flex-1 border-b border-ink/10 bg-transparent py-2 text-base text-ink/70 outline-none placeholder:text-ink/30 focus:border-ink/30 sm:py-1 sm:text-sm"
            aria-label="Nova subtarefa"
          />
        </div>
      ) : null}
    </div>
  );
}
