import { useState } from "react";
import { Link } from "react-router-dom";
import { ENTITY } from "../domain/labels";
import { formatDatePt } from "../domain/money";
import {
  DAY_BLOCK_LABEL,
  NEXT_STATUS,
  QUADRANT_LABEL,
  STATUS_LABEL,
  TIMEBOX_PRESETS,
  type Task,
  type TaskDayBlock,
  type TaskQuadrant,
  type TaskStatus,
} from "../domain/tasks";
import { dueUrgency, dueUrgencyClass, dueUrgencyLabel } from "../domain/tasksReview";
import { useTasks } from "../domain/tasksStore";
import { CalendarBoard } from "../ui/CalendarBoard";
import { Select, type SelectOption } from "../ui/Select";
import { Mark, PageHeader } from "../ui/Page";

const QUADRANT_OPTIONS: SelectOption<TaskQuadrant>[] = [
  { value: "", label: "— Eisenhower", tone: "soft" },
  { value: "fazer", label: "Fazer agora", tone: "copper" },
  { value: "agendar", label: "Agendar", tone: "pine" },
  { value: "delegar", label: "Delegar", tone: "moss" },
  { value: "eliminar", label: "Eliminar", tone: "rust" },
];

const TIMEBOX_OPTIONS: SelectOption<string>[] = TIMEBOX_PRESETS.map((m) => ({
  value: String(m),
  label: m === 0 ? "— Timebox" : `${m} min`,
  tone: m === 0 ? "soft" : m <= 2 ? "copper" : m <= 25 ? "pine" : "moss",
}));

const DAY_BLOCK_OPTIONS: SelectOption<TaskDayBlock>[] = [
  { value: "", label: "— Bloco", tone: "soft" },
  { value: "manha", label: "Manhã", tone: "pine" },
  { value: "tarde", label: "Tarde", tone: "copper" },
  { value: "noite", label: "Noite", tone: "moss" },
];

export function TarefasCalendario() {
  const { tasks, setStatus, setQuadrant, toggleFocusToday, update, remove } = useTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const selected = selectedId ? (tasks.find((t) => t.id === selectedId) ?? null) : null;

  function onUpdate(
    id: string,
    patch: Partial<
      Pick<
        Task,
        "title" | "note" | "due" | "quadrant" | "focusToday" | "status" | "timeboxMin" | "dayBlock"
      >
    >,
  ) {
    const r = update(id, patch);
    if (!r.ok) setErr(r.reason);
  }

  function onSetStatus(id: string, status: TaskStatus) {
    const r = setStatus(id, status);
    if (!r.ok) setErr(r.reason);
  }

  return (
    <div className="page">
      <PageHeader title="Calendário" mark="pine">
        Prazos de Minhas e das empresas num só sítio. Arrasta entre dias.{" "}
        <Link to="/tarefas" className="border-b border-ink/25 pb-px hover:border-ink">
          Minhas
        </Link>
        {" · "}
        <Link to="/tarefas/sistema" className="border-b border-ink/25 pb-px hover:border-ink">
          Sistema
        </Link>
      </PageHeader>

      {err ? <p className="mt-4 text-sm text-rust">{err}</p> : null}

      <CalendarBoard
        tasks={tasks}
        selectedId={selectedId ?? undefined}
        onSetDue={(id, due) => onUpdate(id, { due })}
        onSelect={(t) => setSelectedId((cur) => (cur === t.id ? null : t.id))}
        detail={
          selected ? (
            <>
              <p className="eyebrow mb-3 flex items-center gap-2">
                <Mark tone={ENTITY[selected.entityId].tone} />
                {ENTITY[selected.entityId].short}
                {" · "}
                {selected.due ? `prazo ${formatDatePt(selected.due)}` : "Sem prazo"}
              </p>
              <CalTaskRow
                task={selected}
                onStatus={onSetStatus}
                onQuadrant={setQuadrant}
                onUpdate={onUpdate}
                onToggleFocus={() => {
                  const r = toggleFocusToday(selected.id);
                  if (!r.ok) setErr(r.reason);
                }}
                onRemove={() => {
                  if (!window.confirm(`Apagar «${selected.title}»?`)) return;
                  remove(selected.id);
                  setSelectedId(null);
                }}
              />
              <button
                type="button"
                className="btn-ghost mt-2 text-xs"
                onClick={() => setSelectedId(null)}
              >
                Fechar
              </button>
            </>
          ) : null
        }
      />
    </div>
  );
}

/** Linha compacta — só no cartão do calendário (sem ranking/meta de revisão). */
function CalTaskRow({
  task,
  onStatus,
  onQuadrant,
  onUpdate,
  onToggleFocus,
  onRemove,
}: {
  task: Task;
  onStatus: (id: string, s: TaskStatus) => void;
  onQuadrant: (id: string, q: TaskQuadrant) => void;
  onUpdate: (
    id: string,
    patch: Partial<
      Pick<
        Task,
        "title" | "note" | "due" | "quadrant" | "focusToday" | "status" | "timeboxMin" | "dayBlock"
      >
    >,
  ) => void;
  onToggleFocus: () => void;
  onRemove: () => void;
}) {
  const feita = task.status === "feita";
  const next = NEXT_STATUS[task.status];
  const urgency = dueUrgency(task.due);

  return (
    <div className="border-b border-ink/[0.07] py-2">
      <p
        className={`font-display text-lg tracking-tight ${feita ? "text-ink/45 line-through" : ""}`}
      >
        {task.title}
      </p>
      {task.note ? <p className="mt-1 text-sm text-ink/55">{task.note}</p> : null}
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] uppercase tracking-[0.14em] text-ink/35">
        <span>{STATUS_LABEL[task.status]}</span>
        {task.due ? (
          <span className={dueUrgencyClass(urgency)}>
            {dueUrgencyLabel(urgency)} · {formatDatePt(task.due)}
          </span>
        ) : null}
        {task.dayBlock ? <span>{DAY_BLOCK_LABEL[task.dayBlock]}</span> : null}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!feita ? (
          <Select
            inline
            menuAlign="right"
            aria-label="Timebox"
            className="!min-w-[6.75rem]"
            value={String(task.timeboxMin)}
            onChange={(v) => onUpdate(task.id, { timeboxMin: Number(v) })}
            options={TIMEBOX_OPTIONS}
          />
        ) : null}
        {!feita ? (
          <Select
            inline
            menuAlign="right"
            aria-label="Bloco do dia"
            className="!min-w-[5.75rem]"
            value={task.dayBlock}
            onChange={(v) => onUpdate(task.id, { dayBlock: v })}
            options={DAY_BLOCK_OPTIONS}
          />
        ) : null}
        {!feita ? (
          <Select
            inline
            menuAlign="right"
            aria-label="Eisenhower"
            className="!min-w-[8.5rem]"
            value={task.quadrant}
            onChange={(v) => onQuadrant(task.id, v)}
            options={QUADRANT_OPTIONS}
          />
        ) : null}
        {!feita ? (
          <button
            type="button"
            className={`min-h-10 px-2 text-xs uppercase tracking-[0.12em] sm:min-h-0 ${
              task.focusToday ? "text-pine" : "text-ink/40 hover:text-ink"
            }`}
            onClick={onToggleFocus}
          >
            {task.focusToday ? "Hoje ✓" : "Hoje"}
          </button>
        ) : null}
        {next ? (
          <button
            type="button"
            className="btn-ghost !min-h-10 py-2 text-xs sm:!min-h-0 sm:py-1"
            onClick={() => onStatus(task.id, next)}
          >
            → {STATUS_LABEL[next]}
          </button>
        ) : null}
        <button
          type="button"
          className="min-h-10 px-2 text-xs text-ink/40 hover:text-rust sm:min-h-0"
          onClick={onRemove}
        >
          Apagar
        </button>
      </div>
    </div>
  );
}
