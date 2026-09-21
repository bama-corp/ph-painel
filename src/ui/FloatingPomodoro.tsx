import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { formatPomodoro, usePomodoro } from "../domain/pomodoroStore";

const POS_KEY = "ph-pomodoro-float-pos";

type Pos = { x: number; y: number };

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return { x: 16, y: 16 };
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    /* ignore */
  }
  return { x: 16, y: 16 };
}

/** Widget flutuante — canto inferior direito, arrastável. */
export function FloatingPomodoro() {
  const {
    floating,
    setFloating,
    left,
    running,
    toggleRunning,
    reset,
    modeLabel,
    cycleLabel,
    task,
    endPrompt,
    endStop,
    endExtend,
    endMarkDone,
    endToBreak,
  } = usePomodoro();

  const [pos, setPos] = useState<Pos>(loadPos);
  const drag = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.ox;
    const dy = e.clientY - drag.current.oy;
    setPos({
      x: Math.max(8, drag.current.px - dx),
      y: Math.max(8, drag.current.py - dy),
    });
  }, []);

  const onPointerUp = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  useEffect(() => {
    if (!floating) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos, floating]);

  if (!floating) return null;

  return (
    <aside
      role="timer"
      aria-label="Pomodoro flutuante"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="fixed z-50 w-[min(17rem,calc(100vw-1.5rem))] cursor-grab touch-none select-none border border-ink/20 bg-wash/95 px-3 py-3 backdrop-blur-sm active:cursor-grabbing"
      style={{ right: pos.x, bottom: pos.y }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow text-ink/45">Pomodoro</p>
        <button
          type="button"
          className="text-[0.65rem] uppercase tracking-[0.12em] text-ink/40 hover:text-ink"
          onClick={() => setFloating(false)}
        >
          Acoplar
        </button>
      </div>

      <p
        className={`mt-1 font-display text-[1.85rem] tracking-tight tabular-nums ${
          endPrompt ? "text-copper" : ""
        }`}
      >
        {formatPomodoro(left)}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-ink/50">
        {endPrompt
          ? `Fim · ${endPrompt.taskTitle}`
          : `${modeLabel} · ${cycleLabel}${task ? ` · ${task.title}` : ""}`}
      </p>

      {endPrompt ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" className="btn-solid !min-h-8 px-2 text-[0.65rem]" onClick={endMarkDone}>
            Feita
          </button>
          <button type="button" className="btn-ghost !min-h-8 px-2 text-[0.65rem]" onClick={endExtend}>
            +5′
          </button>
          <button type="button" className="btn-ghost !min-h-8 px-2 text-[0.65rem]" onClick={endToBreak}>
            Pausar
          </button>
          <button type="button" className="btn-ghost !min-h-8 px-2 text-[0.65rem]" onClick={endStop}>
            Parar
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-solid !min-h-9 px-3 text-xs" onClick={toggleRunning}>
            {running ? "Pausar" : "Começar"}
          </button>
          <button type="button" className="btn-ghost !min-h-9 px-3 text-xs" onClick={reset}>
            Reiniciar
          </button>
        </div>
      )}
    </aside>
  );
}
