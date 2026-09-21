import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ENTITY } from "../domain/labels";
import { MONTHS_PT, formatDatePt, todayIso } from "../domain/money";
import {
  QUADRANT_LABEL,
  type Task,
} from "../domain/tasks";
import { dueUrgency, dueUrgencyClass } from "../domain/tasksReview";
import { Mark } from "./Page";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

type Props = {
  tasks: Task[];
  onSetDue: (id: string, due: string) => void;
  onSelect: (task: Task) => void;
  selectedId?: string;
  /** Cartão de detalhe — renderizado na coluna lateral (visível ao clicar). */
  detail?: ReactNode;
};

function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

/** 0=Seg … 6=Dom */
function mondayIndex(y: number, m: number, d: number) {
  const js = new Date(y, m - 1, d).getDay();
  return (js + 6) % 7;
}

type Cell = { iso: string; day: number; inMonth: boolean };

function monthCells(y: number, m: number): Cell[] {
  const firstDow = mondayIndex(y, m, 1);
  const dim = daysInMonth(y, m);
  const prevDim = daysInMonth(y, m === 1 ? 12 : m - 1);
  const out: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    let yy = y;
    let mm = m;
    let d: number;
    let inMonth = true;
    if (i < firstDow) {
      inMonth = false;
      d = prevDim - firstDow + i + 1;
      mm = m === 1 ? 12 : m - 1;
      yy = m === 1 ? y - 1 : y;
    } else if (i >= firstDow + dim) {
      inMonth = false;
      d = i - firstDow - dim + 1;
      mm = m === 12 ? 1 : m + 1;
      yy = m === 12 ? y + 1 : y;
    } else {
      d = i - firstDow + 1;
    }
    out.push({ iso: toIso(yy, mm, d), day: d, inMonth });
  }
  return out;
}

const TILE: Record<"fazer" | "agendar" | "delegar" | "eliminar" | "none", string> = {
  fazer: "bg-copper",
  agendar: "bg-pine",
  delegar: "bg-moss",
  eliminar: "bg-rust",
  none: "bg-ink/35",
};

export function CalendarBoard({ tasks, onSetDue, onSelect, selectedId, detail }: Props) {
  const today = todayIso();
  const base = today.match(/^(\d{4})-(\d{2})/)!;
  const [viewY, setViewY] = useState(Number(base[1]));
  const [viewM, setViewM] = useState(Number(base[2]));
  const [dragOver, setDragOver] = useState<string | "undated" | null>(null);
  const [focusDay, setFocusDay] = useState<string | null>(today);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!detail || !detailRef.current) return;
    detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [detail, selectedId]);

  const open = useMemo(
    () => tasks.filter((t) => t.status !== "feita"),
    [tasks],
  );
  const undated = useMemo(() => open.filter((t) => !t.due), [open]);
  const byDue = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of open) {
      if (!t.due) continue;
      const list = map.get(t.due) ?? [];
      list.push(t);
      map.set(t.due, list);
    }
    return map;
  }, [open]);

  const cells = useMemo(() => monthCells(viewY, viewM), [viewY, viewM]);
  const monthLabel = `${MONTHS_PT[viewM - 1]} ${viewY}`;

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

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/task-id", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function drop(e: DragEvent, due: string) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    if (id) onSetDue(id, due);
  }

  const dayTasks = focusDay ? (byDue.get(focusDay) ?? []) : [];

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Mark tone="pine" />
            Calendário · prazos
          </p>
          <p className="mt-2 max-w-xl text-sm text-ink/45">
            Tarefas com prazo no dia. Arrasta entre dias — ou tira o prazo em «Sem data».
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-xs uppercase tracking-[0.12em] text-ink/40 hover:text-ink"
            onClick={() => shiftMonth(-1)}
            aria-label="Mês anterior"
          >
            ‹
          </button>
          <p className="font-display text-[1.05rem] tracking-tight tabular-nums">{monthLabel}</p>
          <button
            type="button"
            className="text-xs uppercase tracking-[0.12em] text-ink/40 hover:text-ink"
            onClick={() => shiftMonth(1)}
            aria-label="Mês seguinte"
          >
            ›
          </button>
          <button
            type="button"
            className="text-[0.65rem] uppercase tracking-[0.12em] text-ink/40 hover:text-ink"
            onClick={() => {
              const t = todayIso();
              const [y, m] = t.split("-").map(Number);
              setViewY(y);
              setViewM(m);
              setFocusDay(t);
            }}
          >
            Hoje
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_16rem]">
        <div>
          <div className="grid grid-cols-7 border-b border-ink/15">
            {WEEKDAYS.map((d) => (
              <p
                key={d}
                className="py-2 text-center text-[0.65rem] uppercase tracking-[0.12em] text-ink/35"
              >
                {d}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-t border-ink/12">
            {cells.map((c) => {
              const rows = byDue.get(c.iso) ?? [];
              const isToday = c.iso === today;
              const isFocus = c.iso === focusDay;
              const isOver = dragOver === c.iso;
              return (
                <div
                  key={c.iso}
                  className={`min-h-[5.5rem] border-b border-r border-ink/12 p-1.5 sm:min-h-[6.5rem] sm:p-2 ${
                    !c.inMonth ? "bg-wash/30" : ""
                  } ${isOver ? "bg-wash/70" : ""} ${isFocus ? "bg-wash/50" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(c.iso);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOver((d) => (d === c.iso ? null : d));
                    }
                  }}
                  onDrop={(e) => drop(e, c.iso)}
                  onClick={() => setFocusDay(c.iso)}
                >
                  <p
                    className={`num text-[0.7rem] ${
                      isToday
                        ? "text-pine"
                        : c.inMonth
                          ? "text-ink/55"
                          : "text-ink/25"
                    }`}
                  >
                    {c.day}
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {rows.slice(0, 3).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            onDragStart(e, t.id);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(t);
                            setFocusDay(c.iso);
                          }}
                          title={t.title}
                          className={`flex w-full items-center gap-1 truncate text-left text-[0.65rem] leading-tight ${
                            selectedId === t.id ? "text-ink" : "text-ink/65 hover:text-ink"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 ${TILE[t.quadrant || "none"]}`}
                            aria-hidden
                          />
                          <span className="truncate">{t.title}</span>
                        </button>
                      </li>
                    ))}
                    {rows.length > 3 ? (
                      <li className="num text-[0.58rem] text-ink/30">+{rows.length - 3}</li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-4 lg:self-start">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <Mark tone="copper" />
              {focusDay ? formatDatePt(focusDay) : "Dia"}
              <span className="num text-ink/30">{dayTasks.length}</span>
            </p>
            {focusDay && dayTasks.length === 0 ? (
              <p className="mt-3 text-sm text-ink/40">Sem prazos neste dia.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {dayTasks.map((t) => (
                  <SideChip
                    key={t.id}
                    task={t}
                    selected={selectedId === t.id}
                    onDragStart={onDragStart}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            )}
          </div>

          <div
            className={`border border-ink/12 px-3 py-3 ${
              dragOver === "undated" ? "bg-wash/50" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver("undated");
            }}
            onDragLeave={() => setDragOver((d) => (d === "undated" ? null : d))}
            onDrop={(e) => drop(e, "")}
          >
            <p className="eyebrow flex items-center gap-2">
              <Mark tone="soft" />
              Sem data
              <span className="num text-ink/30">{undated.length}</span>
            </p>
            <p className="mt-1 text-[0.72rem] text-ink/40">Arrasta para cá para limpar o prazo.</p>
            <ul className="scroll-panel mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto">
              {undated.length === 0 ? (
                <li className="text-sm text-ink/35">Todas com prazo.</li>
              ) : (
                undated.map((t) => (
                  <SideChip
                    key={t.id}
                    task={t}
                    selected={selectedId === t.id}
                    onDragStart={onDragStart}
                    onSelect={onSelect}
                  />
                ))
              )}
            </ul>
          </div>

          {detail ? (
            <div
              ref={detailRef}
              className="border border-ink/15 bg-wash/40 px-3 py-3"
              data-cal-detail
            >
              {detail}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SideChip({
  task,
  selected,
  onDragStart,
  onSelect,
}: {
  task: Task;
  selected: boolean;
  onDragStart: (e: DragEvent, id: string) => void;
  onSelect: (t: Task) => void;
}) {
  const u = task.due ? dueUrgency(task.due) : "none";
  const origin = useRef<{ x: number; y: number } | null>(null);

  return (
    <button
      type="button"
      draggable
      onPointerDown={(e) => {
        origin.current = { x: e.clientX, y: e.clientY };
      }}
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={(e) => {
        e.stopPropagation();
        const o = origin.current;
        origin.current = null;
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 8) return;
        onSelect(task);
      }}
      className={`w-full border border-ink/12 bg-wash/40 px-2.5 py-2 text-left transition-colors hover:border-ink/25 ${
        selected ? "border-ink/40 outline outline-1 outline-offset-1 outline-ink/25" : ""
      }`}
    >
      <span className="line-clamp-2 text-sm leading-snug text-ink/80">{task.title}</span>
      <span className="mt-1 flex flex-wrap gap-x-2 text-[0.65rem] uppercase tracking-[0.1em] text-ink/35">
        {task.entityId !== "pessoal" ? <span>{ENTITY[task.entityId].short}</span> : null}
        {task.quadrant ? <span>{QUADRANT_LABEL[task.quadrant]}</span> : null}
        {task.due ? <span className={dueUrgencyClass(u)}>prazo</span> : <span>sem data</span>}
      </span>
    </button>
  );
}
