import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Task } from "./tasks";
import { showDeviceNotification } from "./deviceNotify";
import { useTasks } from "./tasksStore";

const DEFAULT_WORK = 25 * 60;
const SHORT_BREAK = 5 * 60;
const LONG_BREAK = 15 * 60;
const EXTEND_SEC = 5 * 60;
export const POMODORO_CYCLES = 4;

export type PomodoroMode = "work" | "break" | "long";

/** Prompt de fecho disciplinado no fim do trabalho (timeboxing). */
export type PomodoroEndPrompt = {
  taskId: string | null;
  taskTitle: string;
};

function workSeconds(task: Task | null | undefined) {
  if (task?.timeboxMin && task.timeboxMin > 0) return task.timeboxMin * 60;
  return DEFAULT_WORK;
}

export function formatPomodoro(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Beep curto (Web Audio) — sem ficheiro externo. */
export function playPomodoroChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    for (const [i, freq] of [880, 660].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.02 + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 + i * 0.12);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + i * 0.12);
      o.stop(now + 0.22 + i * 0.12);
    }
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    /* ignore */
  }
}

type PomodoroApi = {
  floating: boolean;
  setFloating: (v: boolean) => void;
  mode: PomodoroMode;
  left: number;
  running: boolean;
  cycles: number;
  taskId: string | null;
  task: Task | null;
  endPrompt: PomodoroEndPrompt | null;
  setTaskId: (id: string | null) => void;
  toggleRunning: () => void;
  reset: () => void;
  startWork: () => void;
  /** Fecho: parar sem avançar */
  endStop: () => void;
  /** Fecho: +5 minutos de trabalho */
  endExtend: () => void;
  /** Fecho: marcar tarefa feita e ir à pausa */
  endMarkDone: () => void;
  /** Fecho: só ir à pausa (tarefa continua aberta) */
  endToBreak: () => void;
  modeLabel: string;
  cycleLabel: string;
};

const Ctx = createContext<PomodoroApi | null>(null);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { tasks, update } = useTasks();
  const [floating, setFloating] = useState(false);
  const [mode, setMode] = useState<PomodoroMode>("work");
  const [left, setLeft] = useState(DEFAULT_WORK);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [endPrompt, setEndPrompt] = useState<PomodoroEndPrompt | null>(null);

  const task = useMemo(
    () => (taskId ? (tasks.find((t) => t.id === taskId) ?? null) : null),
    [tasks, taskId],
  );

  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeRef = useRef(mode);
  const taskRef = useRef(task);
  const cyclesRef = useRef(0);
  modeRef.current = mode;
  taskRef.current = task;
  cyclesRef.current = cycles;

  useEffect(() => {
    if (running || endPrompt) return;
    setMode("work");
    setLeft(workSeconds(task));
  }, [task?.id, task?.timeboxMin, running, task, endPrompt]);

  const enterBreak = useCallback(() => {
    const nextCycles = cyclesRef.current + 1;
    cyclesRef.current = nextCycles;
    setCycles(nextCycles);
    if (nextCycles % POMODORO_CYCLES === 0) {
      setMode("long");
      setLeft(LONG_BREAK);
    } else {
      setMode("break");
      setLeft(SHORT_BREAK);
    }
    setEndPrompt(null);
  }, []);

  useEffect(() => {
    if (!running) {
      if (tick.current) clearInterval(tick.current);
      tick.current = null;
      return;
    }
    tick.current = setInterval(() => {
      setLeft((n) => {
        if (n > 1) return n - 1;
        setRunning(false);
        playPomodoroChime();
        if (modeRef.current === "work") {
          const t = taskRef.current;
          showDeviceNotification(
            "Timebox acabou",
            t?.title ? `${t.title} — parar / +5′ / feita` : "Parar / +5′ / feita",
          );
          setEndPrompt({
            taskId: t?.id ?? null,
            taskTitle: t?.title ?? "Sessão",
          });
          return 0;
        }
        setMode("work");
        return workSeconds(taskRef.current);
      });
    }, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [running]);

  const reset = useCallback(() => {
    setRunning(false);
    setEndPrompt(null);
    setMode((m) => {
      if (m === "long") {
        setLeft(LONG_BREAK);
        return m;
      }
      if (m === "break") {
        setLeft(SHORT_BREAK);
        return m;
      }
      setLeft(workSeconds(taskRef.current));
      return m;
    });
  }, []);

  const startWork = useCallback(() => {
    setRunning(false);
    setEndPrompt(null);
    setMode("work");
    setLeft(workSeconds(taskRef.current));
  }, []);

  const toggleRunning = useCallback(() => {
    if (endPrompt) return;
    setRunning((r) => !r);
  }, [endPrompt]);

  const endStop = useCallback(() => {
    setEndPrompt(null);
    setRunning(false);
    setMode("work");
    setLeft(workSeconds(taskRef.current));
  }, []);

  const endExtend = useCallback(() => {
    setEndPrompt(null);
    setMode("work");
    setLeft(EXTEND_SEC);
    setRunning(true);
  }, []);

  const endToBreak = useCallback(() => {
    enterBreak();
  }, [enterBreak]);

  const endMarkDone = useCallback(() => {
    const id = endPrompt?.taskId ?? taskRef.current?.id;
    if (id) update(id, { status: "feita", focusToday: false });
    enterBreak();
  }, [endPrompt?.taskId, enterBreak, update]);

  const modeLabel =
    mode === "work" ? "Trabalho" : mode === "long" ? "Pausa longa" : "Pausa";
  const cycleDisp = cycles % POMODORO_CYCLES || (cycles > 0 ? POMODORO_CYCLES : 0);
  const cycleLabel = `ciclo ${cycleDisp}/${POMODORO_CYCLES}`;

  const value = useMemo(
    () => ({
      floating,
      setFloating,
      mode,
      left,
      running,
      cycles,
      taskId,
      task,
      endPrompt,
      setTaskId,
      toggleRunning,
      reset,
      startWork,
      endStop,
      endExtend,
      endMarkDone,
      endToBreak,
      modeLabel,
      cycleLabel,
    }),
    [
      floating,
      mode,
      left,
      running,
      cycles,
      taskId,
      task,
      endPrompt,
      toggleRunning,
      reset,
      startWork,
      endStop,
      endExtend,
      endMarkDone,
      endToBreak,
      modeLabel,
      cycleLabel,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePomodoro() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePomodoro fora de PomodoroProvider");
  return ctx;
}
