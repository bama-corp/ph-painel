import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ENTITY } from "../domain/labels";
import {
  blockFromTime,
  isoWeekday,
  normalizeStartsAt,
  routinePhase,
  routinesForWeekday,
  routinesInBlock,
  todayYmd,
  type RoutinePhase,
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
import { useConfirm } from "../ui/ConfirmDialog";
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

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function clockLabel(now: Date) {
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function TarefasRotina() {
  const { routines, addMany, place, update, remove, spawnToday, syncStatus } = useRoutines();
  const confirm = useConfirm();
  const now = useClock();
  const todayWd = isoWeekday(now);
  const ymd = todayYmd(now);
  const todayFocus = WEEKDAY_AREA_FOCUS[todayWd];
  const draggingId = useRef<string | null>(null);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [weekdays, setWeekdays] = useState<Weekday[]>([todayWd]);
  const [entityId, setEntityId] = useState<EntityId>("pessoal");
  const [timeboxMin, setTimeboxMin] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [dayBlock, setDayBlock] = useState<TaskDayBlock>("");
  const [area, setArea] = useState<TaskArea>(todayFocus.areas[0] ?? "");
  const [focusToday, setFocus] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [spawnMsg, setSpawnMsg] = useState("");
  const [overKey, setOverKey] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<Weekday | null>(null);

  const byDay = useMemo(
    () => WEEKDAYS.map((d) => ({ day: d, items: routines.filter((r) => r.weekday === d) })),
    [routines],
  );

  const todayItems = useMemo(
    () => routinesForWeekday(routines, todayWd),
    [routines, todayWd],
  );
  const todayCount = todayItems.length;
  const todayDone = todayItems.filter((r) => r.doneYmd === ymd).length;
  const editing = routines.find((r) => r.id === editingId) ?? null;

  function resetForm() {
    setTitle("");
    setNote("");
    setTimeboxMin(0);
    setStartsAt("");
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
    setStartsAt("");
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
    setStartsAt(r.startsAt);
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
    const clock = normalizeStartsAt(startsAt);
    const draft = {
      entityId,
      title,
      note,
      timeboxMin,
      startsAt: clock,
      dayBlock: dayBlock || blockFromTime(clock),
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

  function daySections(day: Weekday) {
    const loose = routinesInBlock(routines, day, "");
    const sections: { id: TaskDayBlock; label: string; items: Routine[] }[] = [
      ...(loose.length > 0 ? [{ id: "" as TaskDayBlock, label: "Sem bloco", items: loose }] : []),
      ...DAY_BLOCKS.map((b) => ({
        id: b.id,
        label: b.label,
        items: routinesInBlock(routines, day, b.id),
      })),
    ];
    return sections;
  }

  function renderBlock(day: Weekday, section: { id: TaskDayBlock; label: string; items: Routine[] }, wide: boolean) {
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
        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-ink/35">{section.label}</p>
        <ul className="mt-1 space-y-2">
          {section.items.length === 0 ? (
            <li className="text-[0.72rem] text-ink/25">—</li>
          ) : (
            section.items.map((r, index) => {
              const phase: RoutinePhase | null = day === todayWd ? routinePhase(r, now, ymd) : null;
              const done = phase === "feito";
              return (
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
                } ${phase === "agora" ? "border-l-2 border-l-copper bg-copper/[0.07] pl-1" : ""} ${
                  done ? "opacity-70" : ""
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
                  <p
                    className={`min-w-0 flex-1 text-left leading-snug ${wide ? "text-base" : "text-[0.8rem]"} ${
                      done ? "text-ink/45 line-through" : "text-ink/85"
                    }`}
                  >
                    {r.startsAt ? (
                      <span className={`num mr-1.5 ${phase === "passou" ? "text-rust" : "text-copper"}`}>
                        {r.startsAt}
                      </span>
                    ) : null}
                    {r.title}
                    {phase === "agora" ? (
                      <span className="ml-1.5 text-[0.62rem] uppercase tracking-[0.12em] text-copper">Agora</span>
                    ) : null}
                  </p>
                </div>
                {wide && r.note ? (
                  <p className="mt-1 pl-4 text-sm text-ink/55 whitespace-pre-wrap">{r.note}</p>
                ) : null}
                <p className="mt-0.5 pl-4 text-[0.65rem] text-ink/40">
                  {!r.active ? "Pausada · " : ""}
                  {r.area ? `${TASK_AREA_LABEL[r.area]} · ` : ""}
                  {ENTITY[r.entityId]?.short ?? r.entityId}
                  {r.dayBlock ? ` · ${DAY_BLOCK_LABEL[r.dayBlock]}` : ""}
                  {r.timeboxMin > 0 ? ` · ${r.timeboxMin}m` : ""}
                  {r.focusToday ? " · Hoje" : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-4">
                  {day === todayWd && r.active ? (
                    <button
                      type="button"
                      aria-pressed={done}
                      onClick={() => update(r.id, { doneYmd: done ? "" : ymd })}
                      className={`text-[0.65rem] uppercase tracking-[0.1em] ${
                        done ? "text-pine" : "text-ink/45 hover:text-ink"
                      }`}
                    >
                      {done ? "✓ Feito" : "Feito"}
                    </button>
                  ) : null}
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
                      void confirm({
                        eyebrow: "Rotina",
                        title: "Apagar esta rotina?",
                        body: `«${r.title}» sai da semana.`,
                        confirmLabel: "Apagar",
                      }).then((ok) => {
                        if (!ok) return;
                        if (editingId === r.id) resetForm();
                        remove(r.id);
                      });
                    }}
                    className="text-[0.65rem] text-ink/25 hover:text-rust"
                    aria-label="Apagar"
                  >
                    ×
                  </button>
                </div>
              </li>
              );
            })
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
        <button
          type="button"
          onClick={() => setOpenDay(todayWd)}
          className="border-b border-ink/25 pb-px text-ink/70 hover:border-ink hover:text-ink"
        >
          Abrir hoje
        </button>
        {syncStatus === "local" || syncStatus === "offline" || syncStatus === "error" ? (
          <span className="text-rust">Sync: {syncStatus}</span>
        ) : null}
      </div>
      {spawnMsg ? <p className="mt-2 text-sm text-ink/55">{spawnMsg}</p> : null}

      <DaySummary
        items={todayItems}
        now={now}
        ymd={ymd}
        todayWd={todayWd}
        onToggle={(r) => update(r.id, { doneYmd: r.doneYmd === ymd ? "" : ymd })}
        onMove={(r, day) => {
          const index = routines.filter(
            (x) => x.id !== r.id && x.weekday === day && x.dayBlock === r.dayBlock,
          ).length;
          place(r.id, { weekday: day, dayBlock: r.dayBlock, index });
        }}
      />

      <section className="mt-8">
        <div className="section-head">
          <Mark tone="pine" />
          <h2 className="section-title">
            {openDay === null ? "Semana" : openDay === todayWd ? `Hoje · ${WEEKDAY_LABEL[openDay]}` : WEEKDAY_LABEL[openDay]}
          </h2>
          {openDay !== null ? (
            <button
              type="button"
              onClick={() => setOpenDay(null)}
              className="ml-auto text-[0.75rem] text-ink/50 hover:text-ink"
            >
              Semana
            </button>
          ) : null}
        </div>
        <p className="mt-2 max-w-2xl text-sm text-ink/55">
          Cada dia divide-se em manhã, tarde e noite. Abre um dia para ver as horas e as notas.
          Arrasta uma rotina — ou usa as setas — para a mudar de sítio. Em {ymd}, as activas de{" "}
          {WEEKDAY_LABEL[todayWd].toLowerCase()} entram em «Para fazer».
        </p>

        {openDay !== null ? (
          <>
            <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Escolher dia">
              {WEEKDAYS.map((d) => {
                const on = openDay === d;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setOpenDay(d)}
                    className={`border px-2 py-1 text-[0.72rem] uppercase tracking-[0.08em] ${
                      on
                        ? "border-ink bg-ink text-paper"
                        : d === todayWd
                          ? "border-copper bg-copper/[0.08] text-copper"
                          : "border-ink/15 text-ink/55 hover:border-ink/40"
                    }`}
                  >
                    {WEEKDAY_SHORT[d]}
                    {d === todayWd ? " · hoje" : ""}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-[0.65rem] uppercase tracking-[0.1em] text-ink/40">
              {WEEKDAY_AREA_FOCUS[openDay].label} · {WEEKDAY_AREA_FOCUS[openDay].hours}
              {openDay === todayWd ? " · hoje" : ""}
            </p>
            <div
              className={`mt-4 grid gap-6 ${
                daySections(openDay).some((s) => s.id === "") ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"
              }`}
            >
              {daySections(openDay).map((section) => renderBlock(openDay, section, true))}
            </div>
          </>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {byDay.map(({ day }) => {
              const isToday = day === todayWd;
              const focus = WEEKDAY_AREA_FOCUS[day];
              const sections = daySections(day);
              return (
                <div
                  key={day}
                  className={`min-h-[8rem] border-t-2 pt-3 ${
                    isToday
                      ? "border-copper bg-copper/[0.07] px-2 pb-3 shadow-[inset_0_0_0_1px_rgba(176,112,64,0.28)]"
                      : "border-ink/10"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className={`font-display text-[0.95rem] ${isToday ? "text-copper" : "text-ink/80"}`}>
                      <span className="sm:hidden">{WEEKDAY_SHORT[day]}</span>
                      <span className="hidden sm:inline">{WEEKDAY_LABEL[day]}</span>
                      {isToday ? (
                        <span className="ml-1.5 align-middle text-[0.58rem] uppercase tracking-[0.14em]">
                          Hoje
                        </span>
                      ) : null}
                    </h3>
                    <span className="num text-[0.65rem] text-ink/35">
                      {isToday && todayCount > 0
                        ? `${todayDone}/${todayCount}`
                        : sections.reduce((n, s) => n + s.items.length, 0)}
                    </span>
                  </div>
                  {isToday && todayCount > 0 ? (
                    <div className="mt-2 h-1 bg-ink/10" aria-hidden>
                      <div
                        className="h-full bg-pine transition-[width] duration-300"
                        style={{ width: `${Math.round((todayDone / todayCount) * 100)}%` }}
                      />
                    </div>
                  ) : null}
                  <p className="mt-1 text-[0.65rem] uppercase tracking-[0.1em] text-ink/40">
                    {focus.label} · {focus.hours}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpenDay(day)}
                    className="mt-2 text-[0.7rem] uppercase tracking-[0.12em] text-ink/45 hover:text-ink"
                  >
                    Abrir dia
                  </button>
                  <div className="mt-3 space-y-3">{sections.map((section) => renderBlock(day, section, false))}</div>
                </div>
              );
            })}
          </div>
        )}
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
            <label className="flex flex-wrap items-center gap-3 text-sm text-ink/70">
              <span className="text-[0.65rem] uppercase tracking-[0.14em] text-ink/40">Hora</span>
              <input
                type="time"
                value={startsAt}
                onChange={(e) => {
                  const next = e.target.value;
                  setStartsAt(next);
                  if (!dayBlock && next) {
                    const inferred = blockFromTime(next);
                    if (inferred) setDayBlock(inferred);
                  }
                }}
                className="border border-ink/15 bg-transparent px-2 py-1 text-ink"
              />
              {startsAt ? (
                <button
                  type="button"
                  onClick={() => setStartsAt("")}
                  className="text-[0.72rem] text-ink/40 hover:text-ink"
                >
                  Limpar
                </button>
              ) : (
                <span className="text-[0.72rem] text-ink/35">
                  Opcional. Sem bloco escolhido, a hora define manhã, tarde ou noite.
                </span>
              )}
            </label>
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

function DaySummary({
  items,
  now,
  ymd,
  todayWd,
  onToggle,
  onMove,
}: {
  items: Routine[];
  now: Date;
  ymd: string;
  todayWd: Weekday;
  onToggle: (r: Routine) => void;
  onMove: (r: Routine, day: Weekday) => void;
}) {
  const rows = items
    .map((r) => ({ r, phase: routinePhase(r, now, ymd) }))
    .sort((a, b) => (a.r.startsAt || "99:99").localeCompare(b.r.startsAt || "99:99") || a.r.sortOrder - b.r.sortOrder);
  const groups: { id: RoutinePhase; label: string; tone: string }[] = [
    { id: "agora", label: "Agora", tone: "text-copper" },
    { id: "passou", label: "Não feito", tone: "text-rust" },
    { id: "a-seguir", label: "A seguir", tone: "text-ink/70" },
    { id: "sem-hora", label: "Sem hora", tone: "text-ink/55" },
    { id: "feito", label: "Feito", tone: "text-pine" },
  ];
  const done = rows.filter((x) => x.phase === "feito").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const closing = now.getHours() >= 18;
  const others = WEEKDAYS.filter((d) => d !== todayWd);

  return (
    <section className="mt-8 border border-copper/30 bg-copper/[0.05] px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mark tone="copper" />
          <h2 className="font-display text-xl tracking-tight text-ink">
            {closing ? "Fecho do dia" : "Resumo do dia"}
          </h2>
        </div>
        <p className="num text-sm text-ink/55">
          {clockLabel(now)} · {done}/{items.length || 0}
        </p>
      </div>
      <div className="mt-3 h-1.5 bg-ink/10" aria-hidden>
        <div className="h-full bg-pine transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-sm text-ink/55">
        {closing
          ? "O que ficou por fazer pode ir para outro dia da semana."
          : "Marca o que já fizeste. À hora de cada rotina, o ntfy manda o lembrete."}
      </p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-ink/45">Hoje sem rotina activa.</p>
      ) : (
        <div className="mt-5 space-y-5">
          {groups.map((g) => {
            const list = rows.filter((x) => x.phase === g.id);
            if (!list.length) return null;
            return (
              <div key={g.id}>
                <p className={`text-[0.65rem] uppercase tracking-[0.14em] ${g.tone}`}>
                  {g.label} · {list.length}
                </p>
                <ul className="mt-2 space-y-2">
                  {list.map(({ r }) => (
                    <li key={r.id} className="border-b border-ink/[0.06] pb-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p className={`min-w-0 flex-1 text-sm ${g.id === "feito" ? "text-ink/45 line-through" : "text-ink"}`}>
                          {r.startsAt ? <span className="num mr-1.5 text-copper">{r.startsAt}</span> : null}
                          {r.title}
                        </p>
                        <button
                          type="button"
                          onClick={() => onToggle(r)}
                          className={`text-[0.65rem] uppercase tracking-[0.1em] ${
                            g.id === "feito" ? "text-pine" : "text-ink/45 hover:text-ink"
                          }`}
                        >
                          {g.id === "feito" ? "Desfazer" : "Feito"}
                        </button>
                      </div>
                      {g.id !== "feito" ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="mr-1 text-[0.62rem] uppercase tracking-[0.12em] text-ink/35">
                            Mover
                          </span>
                          {others.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => onMove(r, d)}
                              className="border border-ink/15 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-[0.08em] text-ink/55 hover:border-ink hover:text-ink"
                            >
                              {WEEKDAY_SHORT[d]}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
