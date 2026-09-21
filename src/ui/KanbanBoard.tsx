import { useState, type DragEvent } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { ENTITY } from "../domain/labels";
import { formatDatePt } from "../domain/money";
import {
  KANBAN_COLUMNS,
  QUADRANT_LABEL,
  STATUS_LABEL,
  WIP_EXECUTAR_LIMIT,
  type Task,
  type TaskStatus,
} from "../domain/tasks";
import { dueUrgency, dueUrgencyClass, dueUrgencyLabel } from "../domain/tasksReview";
import { Mark } from "./Page";

/** Tons do sistema (copper / pine / moss / rust / ink). */
const TILE: Record<"fazer" | "agendar" | "delegar" | "eliminar" | "none", string> = {
  fazer: "bg-copper",
  agendar: "bg-pine",
  delegar: "bg-moss",
  eliminar: "bg-rust",
  none: "bg-ink/40",
};

const LEGEND = [
  { tone: "fazer" as const, label: "Fazer" },
  { tone: "agendar" as const, label: "Agendar" },
  { tone: "delegar" as const, label: "Delegar" },
  { tone: "eliminar" as const, label: "Eliminar" },
];

type Props = {
  tasks: Task[];
  onMove: (id: string, status: TaskStatus) => { ok: true } | { ok: false; reason: string };
  onSelect: (task: Task) => void;
  selectedId?: string;
};

const ease = [0.22, 1, 0.36, 1] as const;

export function KanbanBoard({ tasks, onMove, onSelect, selectedId }: Props) {
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [wipHint, setWipHint] = useState("");

  const executarN = tasks.filter((t) => t.status === "executar").length;
  const wipFull = executarN >= WIP_EXECUTAR_LIMIT;

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/task-id", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
    setWipHint("");
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOver(null);
  }

  function onDropColumn(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id");
    setDragOver(null);
    setDraggingId(null);
    if (!id) return;
    const r = onMove(id, status);
    if (!r.ok) setWipHint(r.reason);
    else setWipHint("");
  }

  return (
    <div className="mt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Mark tone="pine" />
            Quadro Kanban
          </p>
          <p className="mt-2 text-sm text-ink/45">
            Arrasta entre colunas. Cor = Eisenhower. Executar ≤{WIP_EXECUTAR_LIMIT} (WIP).
          </p>
        </div>
        <ul className="flex flex-wrap gap-3 text-[0.65rem] uppercase tracking-[0.12em] text-ink/40">
          {LEGEND.map(({ tone, label }) => (
            <li key={tone} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 ${TILE[tone]}`} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>

      {wipHint ? <p className="mb-4 text-sm text-rust">{wipHint}</p> : null}

      <LayoutGroup id="ph-kanban">
        <div className="scroll-panel -mx-4 overflow-x-auto px-4 pb-2 sm:-mx-0 sm:px-0">
          <div className="flex min-w-[52rem] gap-0 border-t border-ink/15 lg:min-w-0">
            {KANBAN_COLUMNS.map((col, i) => {
              const rows = tasks.filter((t) => t.status === col);
              const isOver = dragOver === col;
              const isExec = col === "executar";
              return (
                <section
                  key={col}
                  className={`flex w-[8.5rem] shrink-0 flex-col border-ink/15 sm:w-[9.5rem] lg:min-w-0 lg:flex-1 ${
                    i > 0 ? "border-l" : ""
                  } ${isOver ? "bg-wash/50" : ""} ${
                    isExec && wipFull ? "bg-rust/[0.04]" : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOver(col);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOver((c) => (c === col ? null : c));
                    }
                  }}
                  onDrop={(e) => onDropColumn(e, col)}
                >
                  <header className="border-b border-ink/15 px-2 py-3 text-center">
                    <p className="font-display text-[0.85rem] tracking-tight">{STATUS_LABEL[col]}</p>
                    <p
                      className={`num mt-0.5 text-[0.65rem] ${
                        isExec && wipFull ? "text-rust" : "text-ink/30"
                      }`}
                    >
                      {isExec ? `${rows.length}/${WIP_EXECUTAR_LIMIT}` : rows.length}
                    </p>
                  </header>

                  <ul className="flex min-h-[8rem] flex-col gap-2 px-2 py-3">
                    {rows.map((t) => {
                      const tone = t.quadrant || "none";
                      const selected = selectedId === t.id;
                      const dragging = draggingId === t.id;
                      return (
                        <motion.li
                          key={t.id}
                          layout
                          transition={{ duration: 0.28, ease }}
                          className={dragging ? "opacity-40" : ""}
                        >
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => onDragStart(e, t.id)}
                            onDragEnd={onDragEnd}
                            onClick={() => onSelect(t)}
                            title={`${t.title}${t.quadrant ? ` · ${QUADRANT_LABEL[t.quadrant]}` : ""}`}
                            className={`group flex w-full flex-col gap-1.5 text-left outline-none ${
                              selected ? "opacity-100" : ""
                            }`}
                          >
                            <span
                              className={`block h-8 w-full border border-ink/10 transition-opacity duration-200 group-hover:opacity-90 sm:h-9 ${TILE[tone]} ${
                                selected ? "outline outline-1 outline-offset-2 outline-ink/40" : ""
                              }`}
                              aria-hidden
                            />
                            <span className="line-clamp-2 text-[0.7rem] leading-snug text-ink/65 group-hover:text-ink">
                              {t.focusToday ? <span className="mr-1 text-pine">●</span> : null}
                              {t.title}
                            </span>
                            {t.due ? (
                              <span
                                className={`text-[0.58rem] uppercase tracking-[0.1em] ${dueUrgencyClass(dueUrgency(t.due))}`}
                              >
                                {dueUrgencyLabel(dueUrgency(t.due))}
                                {dueUrgency(t.due) === "later" || dueUrgency(t.due) === "soon"
                                  ? ` ${formatDatePt(t.due)}`
                                  : ""}
                              </span>
                            ) : t.entityId !== "pessoal" ? (
                              <span className="text-[0.58rem] uppercase tracking-[0.1em] text-ink/30">
                                {ENTITY[t.entityId].short}
                              </span>
                            ) : null}
                          </button>
                        </motion.li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </LayoutGroup>
    </div>
  );
}
