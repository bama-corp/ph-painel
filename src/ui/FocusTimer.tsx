import { DAY_BLOCK_LABEL, type Task } from "../domain/tasks";
import {
  formatPomodoro,
  POMODORO_CYCLES,
  usePomodoro,
} from "../domain/pomodoroStore";
import { Mark } from "./Page";

type Props = {
  focusTasks: Task[];
};

function EndPromptBar() {
  const { endPrompt, endStop, endExtend, endMarkDone, endToBreak } = usePomodoro();
  if (!endPrompt) return null;
  return (
    <div className="mt-4 border border-ink/20 bg-wash/60 px-3 py-3">
      <p className="text-sm text-ink/70">
        Timebox acabou
        {endPrompt.taskTitle ? (
          <>
            {" · "}
            <span className="text-ink">{endPrompt.taskTitle}</span>
          </>
        ) : null}
        . O que fazes?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-solid !min-h-9 px-3 text-xs" onClick={endMarkDone}>
          Marcar feita
        </button>
        <button type="button" className="btn-ghost !min-h-9 px-3 text-xs" onClick={endExtend}>
          +5′
        </button>
        <button type="button" className="btn-ghost !min-h-9 px-3 text-xs" onClick={endToBreak}>
          Pausar
        </button>
        <button type="button" className="btn-ghost !min-h-9 px-3 text-xs" onClick={endStop}>
          Parar
        </button>
      </div>
    </div>
  );
}

export function FocusTimer({ focusTasks }: Props) {
  const {
    floating,
    setFloating,
    task,
    taskId,
    setTaskId,
    left,
    running,
    toggleRunning,
    reset,
    startWork,
    modeLabel,
    cycleLabel,
    endPrompt,
  } = usePomodoro();

  return (
    <div className="mt-10 border-t border-ink/15 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Mark tone="copper" />
            Foco · Pomodoro
          </p>
          <p className="mt-2 max-w-md text-sm text-ink/45">
            Trabalho (ou timebox) + pausa 5′. Após {POMODORO_CYCLES} ciclos, pausa 15′. No fim:
            parar / +5′ / feita.
            {task?.dayBlock ? ` Bloco: ${DAY_BLOCK_LABEL[task.dayBlock]}.` : ""}
          </p>
        </div>
        <button
          type="button"
          className={`text-[0.72rem] uppercase tracking-[0.12em] ${
            floating ? "text-pine" : "text-ink/40 hover:text-ink"
          }`}
          onClick={() => setFloating(!floating)}
        >
          {floating ? "Flutuante ✓" : "Flutuante"}
        </button>
      </div>

      {focusTasks.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {focusTasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setTaskId(t.id)}
                className={`border px-2.5 py-1.5 text-xs transition-colors ${
                  taskId === t.id
                    ? "border-ink bg-ink text-paper"
                    : "border-ink/20 text-ink/60 hover:border-ink/40"
                }`}
              >
                {t.title}
                {t.timeboxMin > 0 ? ` · ${t.timeboxMin}′` : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink/40">
          Marca até 3 «Hoje» (80/20 do dia) para focares aqui.
        </p>
      )}

      {!floating ? (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-6">
            <p
              className={`font-display text-[2.75rem] tracking-tight tabular-nums sm:text-[3.25rem] ${
                endPrompt ? "text-copper" : ""
              }`}
            >
              {formatPomodoro(left)}
            </p>
            <div className="flex flex-wrap gap-2 pb-1">
              <button
                type="button"
                className="btn-solid !min-h-10 text-xs sm:!min-h-0"
                onClick={toggleRunning}
                disabled={Boolean(endPrompt) || (!task && focusTasks.length === 0)}
              >
                {running ? "Pausar" : "Começar"}
              </button>
              <button
                type="button"
                className="btn-ghost !min-h-10 text-xs sm:!min-h-0"
                onClick={reset}
              >
                Reiniciar
              </button>
              <button
                type="button"
                className="btn-ghost !min-h-10 text-xs sm:!min-h-0"
                onClick={startWork}
              >
                Trabalho
                {task?.timeboxMin ? ` ${task.timeboxMin}′` : " 25′"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[0.72rem] uppercase tracking-[0.12em] text-ink/35">
            {modeLabel} · {cycleLabel}
            {task ? ` · ${task.title}` : ""}
          </p>
          <EndPromptBar />
        </>
      ) : (
        <p className="mt-6 text-sm text-ink/45">
          Relógio no canto — continua a contar enquanto mudas de vista.
          {endPrompt ? " Fecho pendente no flutuante." : ""}
        </p>
      )}
    </div>
  );
}
