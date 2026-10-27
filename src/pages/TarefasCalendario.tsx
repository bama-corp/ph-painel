import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { triggerServerNotify } from "../domain/deviceNotify";
import { ENTITY } from "../domain/labels";
import { formatDatePt, todayIso } from "../domain/money";
import {
  composeEventNote,
  DAY_BLOCK_LABEL,
  EVENT_BUNDLE,
  isEventTask,
  NEXT_STATUS,
  parseEventNote,
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
import { useConfirm } from "../ui/ConfirmDialog";
import { PostingCalendarBoard } from "../ui/PostingCalendarBoard";
import { Select, type SelectOption } from "../ui/Select";
import { TaskSubtasks } from "../ui/TaskSubtasks";
import { DateField } from "../ui/DateField";
import { Mark, PageHeader } from "../ui/Page";
import type { EntityId } from "../domain/types";
import { COMPANIES } from "../domain/types";

type CalKind = "prazos" | "postagem" | "eventos";

const ENTITY_OPTIONS: SelectOption<EntityId>[] = [
  { value: "pessoal", label: "Minhas", tone: "pine" },
  ...COMPANIES.map((id) => ({
    value: id,
    label: ENTITY[id].short,
    tone: "moss" as const,
  })),
];

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
  const { tasks, add, setStatus, setQuadrant, toggleFocusToday, update, remove } = useTasks();
  const confirm = useConfirm();
  const [kind, setKind] = useState<CalKind>("prazos");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [ntfyMsg, setNtfyMsg] = useState("");
  const [ntfyBusy, setNtfyBusy] = useState(false);

  const selected = selectedId ? (tasks.find((t) => t.id === selectedId) ?? null) : null;
  const deadlines = tasks.filter((t) => !isEventTask(t));
  const events = tasks.filter((t) => isEventTask(t));

  async function onNtfy() {
    setNtfyBusy(true);
    setNtfyMsg("");
    const r = await triggerServerNotify("digest");
    setNtfyBusy(false);
    setNtfyMsg(r.ok ? `Enviado${r.via ? ` via ${r.via}` : ""}. Vê o telemóvel.` : r.reason);
  }

  function onUpdate(
    id: string,
    patch: Partial<
      Pick<
        Task,
        | "title"
        | "note"
        | "due"
        | "quadrant"
        | "focusToday"
        | "status"
        | "timeboxMin"
        | "dayBlock"
        | "subtasks"
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
        {kind === "prazos"
          ? "Prazos de Minhas e das empresas num só sítio. Arrasta entre dias."
          : kind === "eventos"
            ? "Eventos com hora e local. O aviso ntfy leva as tarefas de hoje e a rotina de amanhã."
            : "Semana de publicações da marca pessoal — LinkedIn, Instagram e WhatsApp."}{" "}
        <Link to="/tarefas" className="border-b border-ink/25 pb-px hover:border-ink">
          Minhas
        </Link>
        {" · "}
        <Link to="/tarefas/sistema" className="border-b border-ink/25 pb-px hover:border-ink">
          Sistema
        </Link>
      </PageHeader>

      <div className="page-tabs mt-8" role="tablist" aria-label="Tipo de calendário">
        {(
          [
            ["prazos", "Prazos"],
            ["eventos", "Eventos"],
            ["postagem", "Postagem"],
          ] as const
        ).map(([id, label]) => {
          const on = kind === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`page-tab ${on ? "text-ink border-b border-ink -mb-px" : "text-ink/40 hover:text-ink"}`}
              onClick={() => {
                setKind(id);
                setErr("");
                if (id !== "prazos") setSelectedId(null);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.78rem]">
        <button
          type="button"
          onClick={() => void onNtfy()}
          disabled={ntfyBusy}
          className="border-b border-ink/25 pb-px text-ink/70 hover:border-ink hover:text-ink disabled:opacity-40"
        >
          {ntfyBusy ? "A enviar…" : "Avisar no ntfy"}
        </button>
        {ntfyMsg ? <span className="text-ink/55">{ntfyMsg}</span> : null}
      </div>

      {err ? <p className="mt-4 text-sm text-rust">{err}</p> : null}

      {kind === "prazos" ? (
        <CalendarBoard
          tasks={deadlines}
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
                    void confirm({
                      eyebrow: "Prazo",
                      title: "Apagar este prazo?",
                      body: `«${selected.title}» sai do calendário.`,
                      confirmLabel: "Apagar",
                    }).then((ok) => {
                      if (!ok) return;
                      remove(selected.id);
                      setSelectedId(null);
                    });
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
      ) : kind === "eventos" ? (
        <>
          <EventForm
            onCreate={(draft) => {
              const r = add({
                entityId: draft.entityId,
                title: draft.title,
                due: draft.due,
                note: composeEventNote(draft.time, draft.place, draft.note),
                bundle: EVENT_BUNDLE,
                status: "planejar",
                quadrant: "agendar",
              });
              if (!r.ok) setErr(r.reason);
              else setErr("");
              return r.ok;
            }}
          />
          <CalendarBoard
            tasks={events}
            selectedId={selectedId ?? undefined}
            emptyDayLabel="Sem eventos neste dia."
            undatedLabel="Sem data"
            onSetDue={(id, due) => onUpdate(id, { due })}
            onSelect={(t) => setSelectedId((cur) => (cur === t.id ? null : t.id))}
            detail={
              selected && isEventTask(selected) ? (
                <EventDetail
                  task={selected}
                  onUpdate={onUpdate}
                  onRemove={() => {
                    void confirm({
                      eyebrow: "Evento",
                      title: "Apagar este evento?",
                      body: `«${selected.title}» sai do calendário.`,
                      confirmLabel: "Apagar",
                    }).then((ok) => {
                      if (!ok) return;
                      remove(selected.id);
                      setSelectedId(null);
                    });
                  }}
                  onClose={() => setSelectedId(null)}
                />
              ) : null
            }
          />
        </>
      ) : (
        <PostingCalendarBoard />
      )}
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
        | "title"
        | "note"
        | "due"
        | "quadrant"
        | "focusToday"
        | "status"
        | "timeboxMin"
        | "dayBlock"
        | "subtasks"
      >
    >,
  ) => void;
  onToggleFocus: () => void;
  onRemove: () => void;
}) {
  const feita = task.status === "feita";
  const next = NEXT_STATUS[task.status];
  const urgency = dueUrgency(task.due);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNote, setEditNote] = useState(task.note);

  useEffect(() => {
    setEditTitle(task.title);
    setEditNote(task.note);
  }, [task.id, task.title, task.note]);

  function commitTitle() {
    const nextTitle = editTitle.trim();
    if (!nextTitle) {
      setEditTitle(task.title);
      return;
    }
    if (nextTitle !== task.title) onUpdate(task.id, { title: nextTitle });
  }

  function commitNote() {
    const nextNote = editNote.trim();
    if (nextNote !== task.note) onUpdate(task.id, { note: nextNote });
  }

  return (
    <div className="border-b border-ink/[0.07] py-2">
      <input
        aria-label="Título"
        className={`w-full border-b border-transparent bg-transparent font-display text-lg tracking-tight outline-none focus:border-ink/25 ${
          feita ? "text-ink/45 line-through" : "text-ink"
        }`}
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setEditTitle(task.title);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <textarea
        aria-label="Nota"
        className="mt-1 w-full resize-y border-b border-transparent bg-transparent text-sm text-ink/55 outline-none focus:border-ink/20"
        rows={editNote ? Math.min(4, editNote.split("\n").length + 1) : 1}
        placeholder="Nota…"
        value={editNote}
        onChange={(e) => setEditNote(e.target.value)}
        onBlur={commitNote}
      />
      <TaskSubtasks
        subtasks={task.subtasks ?? []}
        onChange={(nextSubs) => onUpdate(task.id, { subtasks: nextSubs })}
      />
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
        <Select
          inline
          menuAlign="right"
          aria-label="Timebox"
          className="!min-w-[6.75rem]"
          value={String(task.timeboxMin)}
          onChange={(v) => onUpdate(task.id, { timeboxMin: Number(v) })}
          options={TIMEBOX_OPTIONS}
        />
        <Select
          inline
          menuAlign="right"
          aria-label="Bloco do dia"
          className="!min-w-[5.75rem]"
          value={task.dayBlock}
          onChange={(v) => onUpdate(task.id, { dayBlock: v })}
          options={DAY_BLOCK_OPTIONS}
        />
        <Select
          inline
          menuAlign="right"
          aria-label="Eisenhower"
          className="!min-w-[8.5rem]"
          value={task.quadrant}
          onChange={(v) => onQuadrant(task.id, v)}
          options={QUADRANT_OPTIONS}
        />
        <button
          type="button"
          className={`min-h-10 px-2 text-xs uppercase tracking-[0.12em] sm:min-h-0 ${
            task.focusToday ? "text-pine" : "text-ink/40 hover:text-ink"
          }`}
          onClick={onToggleFocus}
        >
          {task.focusToday ? "Hoje ✓" : "Hoje"}
        </button>
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

function EventForm({
  onCreate,
}: {
  onCreate: (draft: {
    title: string;
    due: string;
    time: string;
    place: string;
    note: string;
    entityId: EntityId;
  }) => boolean;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(() => todayIso());
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [entityId, setEntityId] = useState<EntityId>("cw");
  const [open, setOpen] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = onCreate({ title, due, time, place, note, entityId });
    if (!ok) return;
    setTitle("");
    setTime("");
    setPlace("");
    setNote("");
    setOpen(false);
  }

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[0.75rem] text-ink/50 hover:text-ink"
      >
        {open ? "Fechar" : "+ Evento"}
      </button>
      {open ? (
        <form onSubmit={onSubmit} className="mt-4 max-w-xl space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome do evento"
            required
            className="w-full border-b border-ink/20 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink/30 focus:border-ink"
          />
          <div className="flex flex-wrap items-end gap-3">
            <DateField value={due} onChange={setDue} />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Hora"
              className="border-b border-ink/20 bg-transparent py-2 text-sm text-ink outline-none focus:border-ink"
            />
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Local"
              aria-label="Local"
              className="min-w-[10rem] flex-1 border-b border-ink/20 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink/30 focus:border-ink"
            />
            <Select
              value={entityId}
              onChange={setEntityId}
              options={ENTITY_OPTIONS}
              aria-label="Âmbito"
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (opcional)"
            rows={2}
            className="w-full resize-none border-b border-ink/15 bg-transparent py-2 text-sm text-ink/80 outline-none placeholder:text-ink/30 focus:border-ink"
          />
          <button
            type="submit"
            className="border border-ink/20 px-4 py-2 text-sm tracking-wide text-ink hover:border-ink hover:bg-ink hover:text-paper"
          >
            Guardar evento
          </button>
        </form>
      ) : null}
    </section>
  );
}

function EventDetail({
  task,
  onUpdate,
  onRemove,
  onClose,
}: {
  task: Task;
  onUpdate: (id: string, patch: Partial<Pick<Task, "title" | "note" | "due">>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const parsed = parseEventNote(task.note);
  const [title, setTitle] = useState(task.title);
  const [time, setTime] = useState(parsed.time);
  const [place, setPlace] = useState(parsed.place);
  const [note, setNote] = useState(parsed.note);

  useEffect(() => {
    const next = parseEventNote(task.note);
    setTitle(task.title);
    setTime(next.time);
    setPlace(next.place);
    setNote(next.note);
  }, [task.id, task.title, task.note]);

  function save(next?: { title?: string; time?: string; place?: string; note?: string }) {
    const t = (next?.title ?? title).trim();
    if (!t) {
      setTitle(task.title);
      return;
    }
    onUpdate(task.id, {
      title: t,
      note: composeEventNote(next?.time ?? time, next?.place ?? place, next?.note ?? note),
    });
  }

  return (
    <div>
      <p className="eyebrow mb-3 flex items-center gap-2">
        <Mark tone={ENTITY[task.entityId].tone} />
        {ENTITY[task.entityId].short}
        {task.due ? ` · ${formatDatePt(task.due)}` : ""}
      </p>
      <input
        aria-label="Título do evento"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => save()}
        className="w-full border-b border-transparent bg-transparent font-display text-lg tracking-tight text-ink outline-none focus:border-ink/25"
      />
      <div className="mt-3 flex flex-wrap gap-3">
        <input
          type="time"
          aria-label="Hora"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={(e) => save({ time: e.target.value })}
          className="border-b border-ink/15 bg-transparent py-1 text-sm text-ink outline-none focus:border-ink"
        />
        <input
          aria-label="Local"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          onBlur={(e) => save({ place: e.target.value })}
          placeholder="Local"
          className="min-w-[8rem] flex-1 border-b border-ink/15 bg-transparent py-1 text-sm text-ink outline-none placeholder:text-ink/30 focus:border-ink"
        />
      </div>
      <textarea
        aria-label="Nota"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => save()}
        placeholder="Nota…"
        rows={2}
        className="mt-2 w-full resize-none border-b border-transparent bg-transparent text-sm text-ink/60 outline-none focus:border-ink/20"
      />
      <div className="mt-3 flex gap-3">
        <button type="button" className="text-xs text-ink/40 hover:text-rust" onClick={onRemove}>
          Apagar
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
