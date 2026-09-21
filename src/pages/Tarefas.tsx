import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ENTITY } from "../domain/labels";
import { formatDatePt } from "../domain/money";
import {
  DAY_BLOCK_LABEL,
  entityFromTasksPath,
  focusTodayCount,
  IMPACT_TIER_LABEL,
  impactScore,
  impactTier,
  MAX_FOCUS_TODAY,
  NEXT_STATUS,
  openCount,
  QUADRANT_LABEL,
  STATUS_LABEL,
  TIMEBOX_PRESETS,
  tasksOf,
  type Task,
  type TaskDayBlock,
  type TaskQuadrant,
  type TaskStatus,
} from "../domain/tasks";
import {
  buildReviewSnapshot,
  clearReviewDone,
  clearWeeklyReviewDone,
  dueUrgency,
  dueUrgencyClass,
  dueUrgencyLabel,
  formatWeekLabel,
  isReviewMarkedDone,
  isWeeklyReviewDone,
  markReviewDone,
  markWeeklyReviewDone,
  type TasksVista,
} from "../domain/tasksReview";
import { useTasks } from "../domain/tasksStore";
import { DayBoard } from "../ui/DayBoard";
import { EisenhowerMatrix } from "../ui/EisenhowerMatrix";
import { FocusTimer } from "../ui/FocusTimer";
import { KanbanBoard } from "../ui/KanbanBoard";
import { Select, type SelectOption } from "../ui/Select";
import { Mark, PageHeader, Sep, type MarkTone } from "../ui/Page";

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

export function Tarefas() {
  const { ambito } = useParams();
  const entityId = entityFromTasksPath(ambito);
  const meta = ENTITY[entityId];
  const { tasks, add, setStatus, setQuadrant, toggleFocusToday, update, remove } = useTasks();
  const list = tasksOf(tasks, entityId);
  const focusN = focusTodayCount(tasks, entityId);
  const review = buildReviewSnapshot(tasks, entityId);

  const [vista, setVista] = useState<TasksVista>("revisao");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [quadrant, setQuad] = useState<TaskQuadrant>("");
  const [focusToday, setFocus] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [reviewDone, setReviewDone] = useState(() => isReviewMarkedDone(entityId, review.today));
  const [weeklyDone, setWeeklyDone] = useState(() =>
    isWeeklyReviewDone(entityId, review.weekStart),
  );

  useEffect(() => {
    setReviewDone(isReviewMarkedDone(entityId, review.today));
  }, [entityId, review.today]);

  useEffect(() => {
    setWeeklyDone(isWeeklyReviewDone(entityId, review.weekStart));
  }, [entityId, review.weekStart]);

  const isMine = entityId === "pessoal";
  const heading = isMine ? "Minhas tarefas" : `Tarefas · ${meta.short}`;
  const stepsOk = review.steps.filter((s) => s.ok).length;
  const weeklyOk = review.weekly.filter((s) => s.ok).length;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const r = add({
      entityId,
      title,
      note,
      due,
      quadrant,
      focusToday,
      status: "inbox",
    });
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setTitle("");
    setNote("");
    setDue("");
    setQuad("");
    setFocus(false);
    setShowForm(false);
  }

  function confirmRemove(id: string, taskTitle: string) {
    if (!window.confirm(`Apagar «${taskTitle}»?`)) return;
    remove(id);
  }

  function onToggleFocus(id: string) {
    const r = toggleFocusToday(id);
    if (!r.ok) setErr(r.reason);
  }

  function onSetStatus(id: string, status: TaskStatus) {
    const r = setStatus(id, status);
    if (!r.ok) setErr(r.reason);
  }

  function onUpdateTask(
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

  function rowProps(t: Task) {
    return {
      task: t,
      onStatus: onSetStatus,
      onQuadrant: setQuadrant,
      onUpdate: onUpdateTask,
      onToggleFocus: () => onToggleFocus(t.id),
      onRemove: () => confirmRemove(t.id, t.title),
    };
  }

  return (
    <div className="page">
      <PageHeader title={heading} mark={meta.tone}>
        {isMine
          ? "Revisão do dia → prioriza → executa no Kanban. Até 3 «Hoje»."
          : `Pendentes de ${meta.full}. Mesmo ritual; âmbito separado.`}{" "}
        <Link to="/tarefas/sistema" className="border-b border-ink/25 pb-px hover:border-ink">
          Sistema
        </Link>
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink/45">
          <span className="num text-ink/70">{openCount(tasks, entityId)}</span> abertas
          {" · "}
          <span className="num text-ink/70">{focusN}</span>/{MAX_FOCUS_TODAY} hoje
        </p>
        <span className="sep-line hidden min-w-[2rem] flex-1 sm:block" />
        <div className="flex gap-1 text-xs uppercase tracking-[0.12em]" role="tablist" aria-label="Vista">
          {(
            [
              ["revisao", "Revisão"],
              ["dia", "Dia"],
              ["matriz", "Matriz"],
              ["kanban", "Kanban"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vista === id}
              className={`min-h-10 px-3 sm:min-h-0 ${
                vista === id ? "text-ink border-b border-ink" : "text-ink/40 hover:text-ink"
              }`}
              onClick={() => setVista(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setShowForm((v) => !v);
            setErr("");
          }}
        >
          {showForm ? "Cancelar" : "Nova tarefa"}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={onSubmit} className="panel mt-6 max-w-xl space-y-4">
          <p className="eyebrow flex items-center gap-2">
            <Mark tone={meta.tone} />
            Caixa de entrada
          </p>
          <label className="field-label block">
            Acção (verbo + objecto)
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isMine ? "Ex.: ligar ao BAI" : `Ex.: fechar mês ${meta.short}`}
              autoFocus
              required
            />
          </label>
          <label className="field-label block">
            Nota
            <textarea
              className="field min-h-[4.5rem] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contexto opcional…"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label block">
              Eisenhower
              <Select value={quadrant} onChange={setQuad} options={QUADRANT_OPTIONS} />
            </label>
            <label className="field-label block">
              Prazo (opcional)
              <input
                type="date"
                className="field text-base sm:text-sm"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink/60">
            <input
              type="checkbox"
              checked={focusToday}
              onChange={(e) => setFocus(e.target.checked)}
              className="accent-[rgb(var(--pine))]"
            />
            Prioridade do dia (máx. {MAX_FOCUS_TODAY})
          </label>
          {err ? <p className="text-sm text-rust">{err}</p> : null}
          <button type="submit" className="btn-solid" disabled={!title.trim()}>
            Capturar
          </button>
        </form>
      ) : null}

      {err && !showForm ? <p className="mt-4 text-sm text-rust">{err}</p> : null}

      {vista === "revisao" ? (
        <div className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow flex items-center gap-2">
                <Mark tone="pine" />
                Ritual do dia
              </p>
              <p className="mt-2 max-w-xl text-sm text-ink/55">
                Inbox → Hoje (≤{MAX_FOCUS_TODAY}) → prazos da semana → fecho. Semana{" "}
                {formatWeekLabel(review.weekStart, review.weekEnd)}.
              </p>
            </div>
            <p className="num text-sm text-ink/40">
              {stepsOk}/{review.steps.length}
              {reviewDone ? " · feita" : ""}
            </p>
          </div>

          <ol className="mt-6">
            {review.steps.map((step, i) => (
              <li
                key={step.id}
                className="flex gap-3 border-b border-ink/[0.07] py-3.5 first:pt-0"
              >
                <span
                  className={`num shrink-0 w-6 ${step.ok ? "text-pine" : "text-ink/35"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${step.ok ? "text-ink/45" : "text-ink"}`}>
                    {step.label}
                    {step.ok ? " ✓" : ""}
                  </p>
                  <p className="mt-0.5 text-[0.8rem] text-ink/45">{step.hint}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-3">
            {reviewDone ? (
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => {
                  clearReviewDone(entityId);
                  setReviewDone(false);
                }}
              >
                Reabrir ritual
              </button>
            ) : (
              <button
                type="button"
                className="btn-solid"
                onClick={() => {
                  markReviewDone(entityId, review.today);
                  setReviewDone(true);
                }}
              >
                Marcar revisão feita
              </button>
            )}
            <button type="button" className="btn-ghost text-xs" onClick={() => setVista("kanban")}>
              Ir ao Kanban
            </button>
          </div>

          <Sep />

          {review.twoMin.length > 0 ? (
            <ReviewBlock
              tone="copper"
              title="Fazer já · ≤2 min"
              count={review.twoMin.length}
              hint="Candidatos óbvios (timebox 2′ ou inbox sem Eisenhower). Faz e limpa."
            >
              {review.twoMin.map((t) => (
                <TaskRow key={t.id} {...rowProps(t)} highlightTwoMin />
              ))}
            </ReviewBlock>
          ) : null}

          {review.inboxRest.length > 0 ||
          (review.inbox.length > 0 && review.twoMin.length === 0) ? (
            <ReviewBlock
              tone={meta.tone}
              title="Esclarecer · caixa de entrada"
              count={review.inboxRest.length || review.inbox.length}
              hint="Eisenhower + passa a «Para fazer». Se for ≤2 min, marca timebox 2′."
            >
              {(review.twoMin.length > 0 ? review.inboxRest : review.inbox).map((t) => (
                <TaskRow key={t.id} {...rowProps(t)} />
              ))}
            </ReviewBlock>
          ) : null}

          <ReviewBlock
            tone="pine"
            title={`Hoje · ${review.focusN}/${MAX_FOCUS_TODAY}`}
            count={review.focus.length}
            hint={
              review.focusSlotsLeft > 0
                ? `80/20: ranking por impacto. Ainda podes marcar ${review.focusSlotsLeft}.`
                : "Limite do dia. Ordenadas por impacto (Eisenhower + prazo)."
            }
          >
            {review.focus.length === 0 ? (
              <p className="py-3 text-sm text-ink/45">Nenhuma prioridade — vê sugestões abaixo.</p>
            ) : (
              review.focus.map((t, i) => (
                <TaskRow key={t.id} {...rowProps(t)} impactRank={i + 1} />
              ))
            )}
          </ReviewBlock>

          {review.focusSlotsLeft > 0 && review.impactCandidates.length > 0 ? (
            <ReviewBlock
              tone="soft"
              title="Sugestões 80/20"
              count={Math.min(review.focusSlotsLeft, review.impactCandidates.length)}
              hint="Maior impacto primeiro — marca «Hoje» nas que contam."
            >
              {review.impactCandidates.slice(0, review.focusSlotsLeft + 2).map((t, i) => (
                <TaskRow key={t.id} {...rowProps(t)} impactRank={i + 1} />
              ))}
            </ReviewBlock>
          ) : null}

          {review.focus.length > 0 ? (
            <p className="mt-4 text-sm text-ink/45">
              <button
                type="button"
                className="border-b border-ink/25 pb-px hover:border-ink"
                onClick={() => setVista("dia")}
              >
                Abrir vista do dia
              </button>
              {" · "}
              encaixar 09–12 / 14–18 / 19–21.
            </p>
          ) : null}

          {review.overdue.length > 0 ? (
            <ReviewBlock
              tone="copper"
              title="Em atraso"
              count={review.overdue.length}
              hint="Reagenda o prazo ou conclui."
            >
              {review.overdue.map((t) => (
                <TaskRow key={t.id} {...rowProps(t)} />
              ))}
            </ReviewBlock>
          ) : null}

          <ReviewBlock
            tone="ink"
            title="Prazos esta semana"
            count={review.dueWeek.length}
            hint={formatWeekLabel(review.weekStart, review.weekEnd)}
          >
            {review.dueWeek.length === 0 ? (
              <p className="py-3 text-sm text-ink/45">Sem prazos nesta semana.</p>
            ) : (
              review.dueWeek.map((t) => <TaskRow key={t.id} {...rowProps(t)} />)
            )}
          </ReviewBlock>

          <ReviewBlock
            tone="soft"
            title="Feitas hoje"
            count={review.doneToday.length}
            hint="Fecho do dia."
          >
            {review.doneToday.length === 0 ? (
              <p className="py-3 text-sm text-ink/45">Ainda sem conclusões hoje.</p>
            ) : (
              review.doneToday.map((t) => <TaskRow key={t.id} {...rowProps(t)} />)
            )}
          </ReviewBlock>

          <Sep />

          <section className="mt-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow flex items-center gap-2">
                  <Mark tone="pine" />
                  Revisão semanal · GTD
                </p>
                <p className="mt-2 max-w-xl text-sm text-ink/55">
                  Semana {formatWeekLabel(review.weekStart, review.weekEnd)}. Checklist rápida —
                  não substitui o ritual do dia.
                </p>
              </div>
              <p className="num text-sm text-ink/40">
                {weeklyOk}/{review.weekly.length}
                {weeklyDone ? " · feita" : ""}
              </p>
            </div>
            <ol className="mt-5">
              {review.weekly.map((step, i) => (
                <li
                  key={step.id}
                  className="flex gap-3 border-b border-ink/[0.07] py-3 first:pt-0"
                >
                  <span
                    className={`num shrink-0 w-6 ${step.ok ? "text-pine" : "text-ink/35"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${step.ok ? "text-ink/45" : "text-ink"}`}>
                      {step.label}
                      {step.ok ? " ✓" : ""}
                    </p>
                    <p className="mt-0.5 text-[0.8rem] text-ink/45">{step.hint}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5">
              {weeklyDone ? (
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => {
                    clearWeeklyReviewDone(entityId);
                    setWeeklyDone(false);
                  }}
                >
                  Reabrir revisão semanal
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-solid"
                  onClick={() => {
                    markWeeklyReviewDone(entityId, review.weekStart);
                    setWeeklyDone(true);
                  }}
                >
                  Marcar revisão semanal feita
                </button>
              )}
            </div>
          </section>

          <FocusTimer focusTasks={review.focus} />
        </div>
      ) : vista === "dia" ? (
        <>
          <DayBoard
            focusTasks={review.focus}
            focusSlotsLeft={review.focusSlotsLeft}
            selectedId={selectedId ?? undefined}
            onSetBlock={(id, block) => onUpdateTask(id, { dayBlock: block })}
            onSelect={(t) => setSelectedId((cur) => (cur === t.id ? null : t.id))}
          />
          {selectedId ? (
            (() => {
              const t = list.find((x) => x.id === selectedId);
              if (!t) return null;
              return (
                <div className="panel mt-8 max-w-xl">
                  <p className="eyebrow mb-3 flex items-center gap-2">
                    <Mark tone={meta.tone} />
                    Cartão · {t.dayBlock ? DAY_BLOCK_LABEL[t.dayBlock] : "Sem bloco"}
                  </p>
                  <TaskRow {...rowProps(t)} />
                  <button
                    type="button"
                    className="btn-ghost mt-2 text-xs"
                    onClick={() => setSelectedId(null)}
                  >
                    Fechar
                  </button>
                </div>
              );
            })()
          ) : null}
          <FocusTimer focusTasks={review.focus} />
        </>
      ) : vista === "matriz" ? (
        <>
          <EisenhowerMatrix
            tasks={list}
            selectedId={selectedId ?? undefined}
            onSetQuadrant={setQuadrant}
            onSelect={(t) => setSelectedId((cur) => (cur === t.id ? null : t.id))}
          />
          {selectedId ? (
            (() => {
              const t = list.find((x) => x.id === selectedId);
              if (!t) return null;
              return (
                <div className="panel mt-8 max-w-xl">
                  <p className="eyebrow mb-3 flex items-center gap-2">
                    <Mark tone={meta.tone} />
                    Cartão · {t.quadrant ? QUADRANT_LABEL[t.quadrant] : "Sem quadrante"}
                  </p>
                  <TaskRow {...rowProps(t)} />
                  <button
                    type="button"
                    className="btn-ghost mt-2 text-xs"
                    onClick={() => setSelectedId(null)}
                  >
                    Fechar
                  </button>
                </div>
              );
            })()
          ) : null}
        </>
      ) : (
        <>
          {list.filter((t) => t.status !== "inbox").length === 0 &&
          list.every((t) => t.status === "inbox") ? (
            <p className="mt-10 flex items-center gap-2.5 text-sm text-ink/45">
              <Mark tone="soft" />
              Quadro vazio — esclarece a inbox na Revisão para entrar em «Para fazer».
            </p>
          ) : list.length === 0 ? (
            <p className="mt-10 flex items-center gap-2.5 text-sm text-ink/45">
              <Mark tone="soft" />
              Ainda sem tarefas. Captura na caixa de entrada.
            </p>
          ) : (
            <KanbanBoard
              tasks={list.filter((t) => t.status !== "inbox")}
              selectedId={selectedId ?? undefined}
              onMove={(id, status) => {
                const r = setStatus(id, status);
                if (!r.ok) setErr(r.reason);
                return r;
              }}
              onSelect={(t) => setSelectedId((cur) => (cur === t.id ? null : t.id))}
            />
          )}

          {selectedId ? (
            (() => {
              const t = list.find((x) => x.id === selectedId);
              if (!t) return null;
              return (
                <div className="panel mt-8 max-w-xl">
                  <p className="eyebrow mb-3 flex items-center gap-2">
                    <Mark tone={meta.tone} />
                    Cartão · {STATUS_LABEL[t.status]}
                  </p>
                  <TaskRow {...rowProps(t)} />
                  <button
                    type="button"
                    className="btn-ghost mt-2 text-xs"
                    onClick={() => setSelectedId(null)}
                  >
                    Fechar
                  </button>
                </div>
              );
            })()
          ) : null}

          {list.some((t) => t.status === "inbox") ? (
            <section className="mt-12">
              <p className="eyebrow mb-3 flex items-center gap-2">
                <Mark tone="soft" />
                Ainda na inbox
                <span className="num text-ink/30">
                  {list.filter((t) => t.status === "inbox").length}
                </span>
              </p>
              <p className="mb-3 text-sm text-ink/45">
                Não entram no quadro até esclareceres (→ Para fazer).
              </p>
              <ul>
                {list
                  .filter((t) => t.status === "inbox")
                  .map((t) => (
                    <TaskRow key={t.id} {...rowProps(t)} />
                  ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReviewBlock({
  tone,
  title,
  count,
  hint,
  children,
}: {
  tone: MarkTone;
  title: string;
  count: number;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <p className="eyebrow mb-1 flex items-center gap-2">
        <Mark tone={tone} />
        {title}
        <span className="num text-ink/30">{count}</span>
      </p>
      <p className="mb-3 text-[0.8rem] text-ink/40">{hint}</p>
      <ul>{children}</ul>
    </section>
  );
}

function TaskRow({
  task,
  onStatus,
  onQuadrant,
  onUpdate,
  onToggleFocus,
  onRemove,
  impactRank,
  highlightTwoMin,
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
  impactRank?: number;
  highlightTwoMin?: boolean;
}) {
  const feita = task.status === "feita";
  const next = NEXT_STATUS[task.status];
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNote, setEditNote] = useState(task.note);
  const urgency = dueUrgency(task.due);
  const tier = impactTier(impactScore(task));

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

  function doTwoMin() {
    onUpdate(task.id, { timeboxMin: 2, status: "feita" });
  }

  return (
    <li
      className={`border-b border-ink/[0.07] py-4 ${
        highlightTwoMin ? "bg-copper/[0.04] px-2 -mx-2 sm:px-3 sm:-mx-3" : ""
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-x-2">
            {impactRank ? (
              <span className="num shrink-0 text-[0.7rem] text-ink/35">#{impactRank}</span>
            ) : null}
            {task.focusToday && !feita ? (
              <span className="shrink-0 text-[0.65rem] uppercase tracking-[0.14em] text-pine">
                Hoje
              </span>
            ) : null}
            {highlightTwoMin ? (
              <span className="shrink-0 text-[0.65rem] uppercase tracking-[0.14em] text-copper">
                ≤2 min
              </span>
            ) : null}
            <input
              aria-label="Título"
              className={`min-w-0 w-full border-b border-transparent bg-transparent font-display text-lg tracking-tight outline-none focus:border-ink/25 ${
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
              disabled={feita}
            />
          </div>
          <textarea
            aria-label="Nota"
            className="mt-1.5 w-full max-w-xl resize-y border-b border-transparent bg-transparent text-sm leading-relaxed text-ink/55 outline-none focus:border-ink/20 disabled:opacity-60"
            rows={editNote ? Math.min(4, editNote.split("\n").length + 1) : 1}
            placeholder={feita ? "" : "Nota…"}
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            onBlur={commitNote}
            disabled={feita}
          />
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.65rem] uppercase tracking-[0.14em] text-ink/35">
            <span>{formatDatePt(task.at)}</span>
            {task.due ? (
              <span className={dueUrgencyClass(urgency)}>
                {dueUrgencyLabel(urgency)} · {formatDatePt(task.due)}
              </span>
            ) : null}
            {/* Em abertas, timebox/bloco/Eisenhower vivem nos selects à direita */}
            {feita && task.quadrant ? <span>{QUADRANT_LABEL[task.quadrant]}</span> : null}
            {feita && task.timeboxMin > 0 ? <span>timebox {task.timeboxMin}′</span> : null}
            {feita && task.dayBlock ? <span>{DAY_BLOCK_LABEL[task.dayBlock]}</span> : null}
            {!feita && (impactRank || task.focusToday) ? (
              <span className={tier === "alto" ? "text-pine" : ""}>
                {IMPACT_TIER_LABEL[tier]}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-2 md:w-auto md:max-w-[18rem] md:shrink-0 md:justify-end lg:max-w-[22rem]">
          {!feita && (task.status === "inbox" || task.timeboxMin === 2 || highlightTwoMin) ? (
            <button
              type="button"
              className="btn-ghost !min-h-10 py-2 text-xs sm:!min-h-0 sm:py-1"
              onClick={doTwoMin}
              title="Regra dos 2 min — marcar como feita"
            >
              ≤2 min ✓
            </button>
          ) : null}
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
          {feita ? (
            <button
              type="button"
              className="btn-ghost !min-h-10 py-2 text-xs sm:!min-h-0 sm:py-1"
              onClick={() => onStatus(task.id, "para_fazer")}
            >
              Reabrir
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
    </li>
  );
}
