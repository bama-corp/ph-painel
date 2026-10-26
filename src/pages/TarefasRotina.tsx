import { useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ENTITY } from "../domain/labels";
import {
  isoWeekday,
  routinesForWeekday,
  routinesInBlock,
  todayYmd,
  WEEKDAY_LABEL,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type Routine,
  type Weekday,
} from "../domain/routines";
import { useRoutines } from "../domain/routinesStore";
import {
  DAY_BLOCK_LABEL,
  TASK_AREA_LABEL,
  TIMEBOX_PRESETS,
  WEEKDAY_AREA_FOCUS,
  type TaskArea,
  type TaskDayBlock,
} from "../domain/tasks";
import type { EntityId } from "../domain/types";
import { COMPANIES } from "../domain/types";
import { Mark, PageHeader, Sep } from "../ui/Page";
import { Select, type SelectOption } from "../ui/Select";

const ENTITY_OPTIONS: SelectOption<EntityId>[] = [
  { value: "pessoal", label: "Minhas", tone: "pine" },
  ...COMPANIES.map((id) => ({
    value: id,
    label: ENTITY[id].short,
    tone: "moss" as const,
  })),
];

const TIMEBOX_OPTIONS: SelectOption<string>[] = TIMEBOX_PRESETS.map((m) => ({
  value: String(m),
  label: m === 0 ? "— Timebox" : `${m} min`,
  tone: m === 0 ? "soft" : m <= 25 ? "pine" : "moss",
}));

const AREA_OPTIONS: SelectOption<TaskArea>[] = [
  { value: "", label: "— Área", tone: "soft" },
  { value: "tecnologia", label: "Tecnologia", tone: "pine" },
  { value: "negocios", label: "Negócios", tone: "copper" },
  { value: "financas", label: "Finanças", tone: "moss" },
  { value: "projeto", label: "Projeto", tone: "ink" },
  { value: "revisao", label: "Revisão", tone: "soft" },
];

const DAY_BLOCKS: { id: Exclude<TaskDayBlock, "">; label: string }[] = [
  { id: "manha", label: "Manhã" },
  { id: "tarde", label: "Tarde" },
  { id: "noite", label: "Noite" },
];

const BLOCK_CHOICES: { id: TaskDayBlock; label: string }[] = [
  { id: "", label: "Sem bloco" },
  ...DAY_BLOCKS,
];

function blockKey(day: Weekday, block: TaskDayBlock) {
  return `${day}:${block}`;
}

export function TarefasRotina() {
  const { routines, addMany, place, update, remove, spawnToday, syncStatus } = useRoutines();
  const todayWd = isoWeekday();
  const ymd = todayYmd();
  const todayFocus = WEEKDAY_AREA_FOCUS[todayWd];
  const draggingId = useRef<string | null>(null);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [weekdays, setWeekdays] = useState<Weekday[]>([todayWd]);
  const [entityId, setEntityId] = useState<EntityId>("pessoal");
  const [timeboxMin, setTimeboxMin] = useState(0);
  const [dayBlock, setDayBlock] = useState<TaskDayBlock>("");
  const [area, setArea] = useState<TaskArea>(todayFocus.areas[0] ?? "");
  const [focusToday, setFocus] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [spawnMsg, setSpawnMsg] = useState("");
  const [overKey, setOverKey] = useState<string | null>(null);

  const byDay = useMemo(
    () => WEEKDAYS.map((d) => ({ day: d, items: routines.filter((r) => r.weekday === d) })),
    [routines],
  );

  const todayCount = routinesForWeekday(routines, todayWd).length;
  const editing = routines.find((r) => r.id === editingId) ?? null;

  function resetForm() {
    setTitle("");
    setNote("");
    setTimeboxMin(0);
    setDayBlock("");
    setArea(WEEKDAY_AREA_FOCUS[weekdays[0] ?? todayWd].areas[0] ?? "");
    setFocus(false);
    setEditingId(null);
    setShowForm(false);
  }

  function openCreate(day: Weekday, block: TaskDayBlock) {
    setEditingId(null);
    setTitle("");
    setNote("");
    setWeekdays([day]);
    setDayBlock(block);
    setArea(WEEKDAY_AREA_FOCUS[day].areas[0] ?? "");
    setTimeboxMin(0);
    setFocus(false);
    setErr("");
    setShowForm(true);
  }

  function openEdit(r: Routine) {
    setEditingId(r.id);
    setTitle(r.title);
    setNote(r.note);
    setWeekdays([r.weekday]);
    setEntityId(r.entityId);
    setTimeboxMin(r.timeboxMin);
    setDayBlock(r.dayBlock);
    setArea(r.area);
    setFocus(r.focusToday);
    setErr("");
    setShowForm(true);
  }

  function toggleDay(day: Weekday) {
    setWeekdays((cur) => {
      if (editingId) return [day];
      const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day];
      next.sort((a, b) => a - b);
      return next;
    });
    if (!editingId) setArea(WEEKDAY_AREA_FOCUS[day].areas[0] ?? "");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!weekdays.length) {
      setErr("Escolhe pelo menos um dia.");
      return;
    }
    const draft = {
      entityId,
      title,
      note,
      timeboxMin,
      dayBlock,
      focusToday,
      area,
    };

    if (editing) {
      const saved = update(editing.id, { ...draft, weekday: weekdays[0] });
      if (!saved.ok) {
        setErr(saved.reason);
        return;
      }
      resetForm();
      return;
    }

    const created = addMany(
      weekdays.map((weekday) => ({
        ...draft,
        weekday,
        area: area || WEEKDAY_AREA_FOCUS[weekday].areas[0] || "",
      })),
    );
    if (!created.ok) {
      setErr(created.reason);
      return;
    }
    resetForm();
  }

  function onSpawn() {
    const n = spawnToday();
    setSpawnMsg(
      n === 0
        ? `Nada novo para ${WEEKDAY_LABEL[todayWd].toLowerCase()} — já gerado ou sem rotinas activas.`
        : `${n} tarefa${n === 1 ? "" : "s"} criada${n === 1 ? "" : "s"} para hoje.`,
    );
  }

  function moveTo(id: string, day: Weekday, block: TaskDayBlock, index: number) {
    place(id, { weekday: day, dayBlock: block, index });
  }

  function onDragStart(e: DragEvent, id: string) {
    draggingId.current = id;
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDrop(e: DragEvent, day: Weekday, block: TaskDayBlock, index: number) {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain") || draggingId.current;
    setOverKey(null);
    draggingId.current = null;
    if (!id) return;
    moveTo(id, day, block, index);
  }

  return (
    <div className="page">
      <PageHeader title="Rotina" mark="pine">
        Semana por áreas: tech · negócios · projeto · revisão.{" "}
        <Link to="/tarefas" className="border-b border-ink/25 pb-px hover:border-ink">
          Minhas
        </Link>
      </PageHeader>

      <Sep />

      <div className="border-l-2 border-copper pl-3">
        <p className="text-sm text-ink/70">
          <span className="uppercase tracking-[0.12em] text-ink/40">{WEEKDAY_LABEL[todayWd]}</span>
          {" · "}
          <span className="text-ink">{todayFocus.label}</span>
          {" · "}
          <span className="num text-ink/55">{todayFocus.hours}</span>
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.78rem] text-ink/50">
        <span>
          Hoje · <span className="text-ink/80">{WEEKDAY_LABEL[todayWd]}</span>
          {todayCount > 0 ? (
            <>
              {" "}
              · <span className="num text-ink/70">{todayCount}</span> na rotina
            </>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onSpawn}
          className="border-b border-ink/25 pb-px text-ink/70 hover:border-ink hover:text-ink"
        >
          Gerar tarefas de hoje
        </button>
        {syncStatus === "local" || syncStatus === "offline" || syncStatus === "error" ? (
          <span className="text-rust">Sync: {syncStatus}</span>
        ) : null}
      </div>
      {spawnMsg ? <p className="mt-2 text-sm text-ink/55">{spawnMsg}</p> : null}

      <section className="mt-8">
        <div className="section-head">
          <Mark tone="pine" />
          <h2 className="section-title">Semana</h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-ink/55">
          Cada dia divide-se em manhã, tarde e noite. Arrasta uma rotina — ou usa as setas — para a
          mudar de sítio. Em {ymd}, as activas de {WEEKDAY_LABEL[todayWd].toLowerCase()} entram em
          «Para fazer».
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {byDay.map(({ day }) => {
            const isToday = day === todayWd;
            const focus = WEEKDAY_AREA_FOCUS[day];
            const loose = routinesInBlock(routines, day, "");
            const sections: { id: TaskDayBlock; label: string; items: Routine[] }[] = [
              ...(loose.length > 0
                ? [{ id: "" as TaskDayBlock, label: "Sem bloco", items: loose }]
                : []),
              ...DAY_BLOCKS.map((b) => ({
                id: b.id,
                label: b.label,
                items: routinesInBlock(routines, day, b.id),
              })),
            ];
            return (
              <div
                key={day}
                className={`min-h-[8rem] border-t-2 pt-3 ${isToday ? "border-copper" : "border-ink/10"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className={`font-display text-[0.95rem] ${isToday ? "text-copper" : "text-ink/80"}`}>
                    <span className="sm:hidden">{WEEKDAY_SHORT[day]}</span>
                    <span className="hidden sm:inline">{WEEKDAY_LABEL[day]}</span>
                  </h3>
                  <span className="num text-[0.65rem] text-ink/35">
                    {sections.reduce((n, s) => n + s.items.length, 0)}
                  </span>
                </div>
                <p className="mt-1 text-[0.65rem] uppercase tracking-[0.1em] text-ink/40">
                  {focus.label} · {focus.hours}
                </p>

                <div className="mt-3 space-y-3">
                  {sections.map((section) => {
                    const key = blockKey(day, section.id);
                    return (
                      <div
                        key={key}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setOverKey(key);
                        }}
                        onDragLeave={() => setOverKey((cur) => (cur === key ? null : cur))}
                        onDrop={(e) => onDrop(e, day, section.id, section.items.length)}
                        className={`rounded-sm px-1 py-1 ${overKey === key ? "bg-copper/[0.08]" : ""}`}
                      >
                        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-ink/35">
                          {section.label}
                        </p>
                        <ul className="mt-1 space-y-2">
                          {section.items.length === 0 ? (
                            <li className="text-[0.72rem] text-ink/25">—</li>
                          ) : (
                            section.items.map((r, index) => (
                              <li
                                key={r.id}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOverKey(key);
                                }}
                                onDrop={(e) => {
                                  const id = draggingId.current;
                                  const without = section.items.filter((item) => item.id !== id);
                                  const at = without.findIndex((item) => item.id === r.id);
                                  onDrop(e, day, section.id, at < 0 ? without.length : at);
                                }}
                                className={`border-b border-ink/[0.06] pb-2 ${r.active ? "" : "opacity-50"} ${
                                  editingId === r.id ? "bg-copper/[0.06]" : ""
                                }`}
                              >
                                <div className="flex items-start gap-1">
                                  <span
                                    draggable
                                    onDragStart={(e) => onDragStart(e, r.id)}
                                    onDragEnd={() => {
                                      draggingId.current = null;
                                      setOverKey(null);
                                    }}
                                    className="mt-0.5 cursor-grab select-none px-0.5 text-[0.7rem] leading-none text-ink/30 hover:text-ink"
                                    title="Arrastar para outro dia ou bloco"
                                    aria-label="Reposicionar"
                                  >
                                    ⋮⋮
                                  </span>
                                  <p className="min-w-0 flex-1 text-left text-[0.8rem] leading-snug text-ink/85">
                                    {r.title}
                                  </p>
                                </div>
                                <p className="mt-0.5 pl-4 text-[0.65rem] text-ink/40">
                                  {!r.active ? "Pausada · " : ""}
                                  {r.area ? `${TASK_AREA_LABEL[r.area]} · ` : ""}
                                  {ENTITY[r.entityId]?.short ?? r.entityId}
                                  {r.dayBlock ? ` · ${DAY_BLOCK_LABEL[r.dayBlock]}` : ""}
                                  {r.timeboxMin > 0 ? ` · ${r.timeboxMin}m` : ""}
                                  {r.focusToday ? " · Hoje" : ""}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-4">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => moveTo(r.id, day, section.id, index - 1)}
                                    className="text-[0.65rem] text-ink/35 hover:text-ink disabled:opacity-30"
                                    aria-label="Subir"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === section.items.length - 1}
                                    onClick={() => moveTo(r.id, day, section.id, index + 1)}
                                    className="text-[0.65rem] text-ink/35 hover:text-ink disabled:opacity-30"
                                    aria-label="Descer"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEdit(r)}
                                    className="text-[0.65rem] uppercase tracking-[0.1em] text-ink/40 hover:text-ink"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => update(r.id, { active: !r.active })}
                                    className="text-[0.65rem] uppercase tracking-[0.1em] text-ink/35 hover:text-ink"
                                    title={r.active ? "Pausar (não gera amanhã)" : "Reactivar"}
                                  >
                                    {r.active ? "Pausar" : "Activar"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!window.confirm(`Apagar «${r.title}» da rotina?`)) return;
                                      if (editingId === r.id) resetForm();
                                      remove(r.id);
                                    }}
                                    className="text-[0.65rem] text-ink/25 hover:text-rust"
                                    aria-label="Apagar"
                                  >
                                    ×
                                  </button>
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                        <button
                          type="button"
                          onClick={() => openCreate(day, section.id)}
                          className="mt-1 pl-1 text-[0.7rem] text-ink/40 hover:text-ink"
                        >
                          + {section.label.toLowerCase()}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Sep />

      <section>
        <div className="section-head">
          <Mark tone="copper" />
          <h2 className="section-title">{editing ? "Editar rotina" : "Nova rotina"}</h2>
          <button
            type="button"
            onClick={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
            className="ml-auto text-[0.75rem] text-ink/50 hover:text-ink"
          >
            {showForm ? "Fechar" : "Abrir"}
          </button>
        </div>

        {showForm ? (
          <form onSubmit={onSubmit} className="mt-5 max-w-xl space-y-4">
            {editing ? (
              <p className="text-[0.75rem] text-ink/45">A editar «{editing.title}».</p>
            ) : (
              <p className="text-[0.75rem] text-ink/45">Podes marcar mais do que um dia.</p>
            )}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Bloco Tecnologia, outreach…"
              className="w-full border-b border-ink/20 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink/30 focus:border-ink"
              autoFocus
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota (opcional)"
              rows={2}
              className="w-full resize-none border-b border-ink/15 bg-transparent py-2 text-sm text-ink/80 outline-none placeholder:text-ink/30 focus:border-ink"
            />
            <div>
              <p className="mb-2 text-[0.65rem] uppercase tracking-[0.14em] text-ink/40">
                Dias da semana
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
                {WEEKDAYS.map((d) => {
                  const on = weekdays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleDay(d)}
                      className={`border px-2 py-1 text-[0.72rem] uppercase tracking-[0.08em] ${
                        on ? "border-ink bg-ink text-paper" : "border-ink/15 text-ink/55 hover:border-ink/40"
                      } ${d === todayWd && !on ? "text-copper" : ""}`}
                    >
                      {WEEKDAY_SHORT[d]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[0.65rem] uppercase tracking-[0.14em] text-ink/40">
                Bloco do dia
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bloco do dia">
                {BLOCK_CHOICES.map((b) => {
                  const on = dayBlock === b.id;
                  return (
                    <button
                      key={b.id || "none"}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDayBlock(b.id)}
                      className={`border px-2 py-1 text-[0.72rem] uppercase tracking-[0.08em] ${
                        on ? "border-ink bg-ink text-paper" : "border-ink/15 text-ink/55 hover:border-ink/40"
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={area} onChange={setArea} options={AREA_OPTIONS} aria-label="Área" />
              <Select
                value={entityId}
                onChange={setEntityId}
                options={ENTITY_OPTIONS}
                aria-label="Âmbito"
              />
              <Select
                value={String(timeboxMin)}
                onChange={(v) => setTimeboxMin(Number(v))}
                options={TIMEBOX_OPTIONS}
                aria-label="Timebox"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink/60">
              <input
                type="checkbox"
                checked={focusToday}
                onChange={(e) => setFocus(e.target.checked)}
                className="accent-ink"
              />
              Marcar como prioridade «Hoje» ao gerar
            </label>
            {err ? <p className="text-sm text-rust">{err}</p> : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="border border-ink/20 px-4 py-2 text-sm tracking-wide text-ink hover:border-ink hover:bg-ink hover:text-paper"
              >
                {editing ? "Guardar alterações" : "Guardar na semana"}
              </button>
              {editing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-2 py-2 text-sm text-ink/50 hover:text-ink"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-ink/45">
            Ou escolhe «+ manhã», «+ tarde» ou «+ noite» numa coluna da grelha. Podes marcar vários
            dias de uma vez.
          </p>
        )}
      </section>
    </div>
  );
}
