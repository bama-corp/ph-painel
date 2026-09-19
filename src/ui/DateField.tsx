import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MONTHS_PT, formatDatePt, todayIso } from "../domain/money";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

type DateFieldProps = {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  /** Compacto — cabeçalhos / barras */
  inline?: boolean;
  disabled?: boolean;
  /** Mostra acção Limpar (valor vazio). Default false. */
  clearable?: boolean;
  placeholder?: string;
};

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

/** 0=Seg … 6=Dom */
function mondayIndex(y: number, m: number, d: number) {
  const js = new Date(y, m - 1, d).getDay(); // 0=Dom
  return (js + 6) % 7;
}

export function DateField({
  value,
  onChange,
  className = "",
  inline = false,
  disabled = false,
  clearable = false,
  placeholder = "Escolher data…",
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const today = todayIso();
  const parsed = parseIso(value);

  const initialView = parsed ?? parseIso(today)!;
  const [viewY, setViewY] = useState(initialView.y);
  const [viewM, setViewM] = useState(initialView.m);

  useEffect(() => {
    if (!open) return;
    const base = parseIso(value) ?? parseIso(today)!;
    setViewY(base.y);
    setViewM(base.m);
  }, [open, value, today]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const cells = useMemo(() => {
    const firstDow = mondayIndex(viewY, viewM, 1);
    const dim = daysInMonth(viewY, viewM);
    const prevDim = daysInMonth(viewY, viewM === 1 ? 12 : viewM - 1);
    const out: { iso: string; day: number; inMonth: boolean }[] = [];

    for (let i = 0; i < 42; i++) {
      let y = viewY;
      let m = viewM;
      let d: number;
      let inMonth = true;
      if (i < firstDow) {
        inMonth = false;
        d = prevDim - firstDow + i + 1;
        m = viewM === 1 ? 12 : viewM - 1;
        y = viewM === 1 ? viewY - 1 : viewY;
      } else if (i >= firstDow + dim) {
        inMonth = false;
        d = i - firstDow - dim + 1;
        m = viewM === 12 ? 1 : viewM + 1;
        y = viewM === 12 ? viewY + 1 : viewY;
      } else {
        d = i - firstDow + 1;
      }
      out.push({ iso: toIso(y, m, d), day: d, inMonth });
    }
    return out;
  }, [viewY, viewM]);

  function shiftMonth(delta: number) {
    let m = viewM + delta;
    let y = viewY;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewY(y);
    setViewM(m);
  }

  function pick(iso: string) {
    onChange(iso);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    }
  }

  const label = parsed ? formatDatePt(value) : placeholder;

  return (
    <div
      ref={rootRef}
      data-open={open || undefined}
      className={`select-root ${inline ? "select-root-inline" : ""} ${className}`}
    >
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`select-trigger ${inline ? "select-trigger-inline" : ""}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className={`select-value ${parsed ? "" : "text-ink/35"}`}>{label}</span>
        <span className="select-chevron" aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Escolher data"
          className="date-menu"
        >
          <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1">
            <button
              type="button"
              className="date-nav"
              aria-label="Mês anterior"
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <p className="text-[0.78rem] font-medium tracking-wide text-ink">
              {MONTHS_PT[viewM - 1]} {viewY}
            </p>
            <button
              type="button"
              className="date-nav"
              aria-label="Mês seguinte"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0 px-2 pb-1">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="py-1 text-center text-[0.62rem] uppercase tracking-[0.12em] text-ink/35"
              >
                {w}
              </span>
            ))}
            {cells.map((c) => {
              const selected = c.iso === value;
              const isToday = c.iso === today;
              return (
                <button
                  key={c.iso}
                  type="button"
                  className={[
                    "date-day",
                    c.inMonth ? "" : "date-day-muted",
                    selected ? "date-day-selected" : "",
                    isToday && !selected ? "date-day-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => pick(c.iso)}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-ink/10 px-3 py-2">
            {clearable ? (
              <button
                type="button"
                className="text-[0.72rem] tracking-wide text-ink/45 hover:text-ink"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Limpar
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="text-[0.72rem] font-medium tracking-wide text-pine hover:text-ink"
              onClick={() => pick(today)}
            >
              Hoje
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
