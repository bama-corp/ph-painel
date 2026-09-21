import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ENTITY } from "../domain/labels";
import {
  isoWeekday,
  routinesForWeekday,
  todayYmd,
  WEEKDAY_LABEL,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type Weekday,
} from "../domain/routines";
import { useRoutines } from "../domain/routinesStore";
import {
  DAY_BLOCK_LABEL,
  TIMEBOX_PRESETS,
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

const WEEKDAY_OPTIONS: SelectOption<string>[] = WEEKDAYS.map((d) => ({
  value: String(d),
  label: WEEKDAY_LABEL[d],
  tone: d === isoWeekday() ? "copper" : "soft",
}));

const TIMEBOX_OPTIONS: SelectOption<string>[] = TIMEBOX_PRESETS.map((m) => ({
  value: String(m),
  label: m === 0 ? "— Timebox" : `${m} min`,
  tone: m === 0 ? "soft" : m <= 25 ? "pine" : "moss",
}));

const DAY_BLOCK_OPTIONS: SelectOption<TaskDayBlock>[] = [
  { value: "", label: "— Bloco", tone: "soft" },
  { value: "manha", label: "Manhã", tone: "pine" },
  { value: "tarde", label: "Tarde", tone: "copper" },
  { value: "noite", label: "Noite", tone: "moss" },
];

export function TarefasRotina() {
  const { routines, add, update, remove, spawnToday, syncStatus } = useRoutines();
  const todayWd = isoWeekday();
  const ymd = todayYmd();

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [weekday, setWeekday] = useState<Weekday>(todayWd);
  const [entityId, setEntityId] = useState<EntityId>("pessoal");
  const [timeboxMin, setTimeboxMin] = useState(0);
  const [dayBlock, setDayBlock] = useState<TaskDayBlock>("");
  const [focusToday, setFocus] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState("");
  const [spawnMsg, setSpawnMsg] = useState("");

  const byDay = useMemo(
    () => WEEKDAYS.map((d) => ({ day: d, items: routinesForWeekday(routines, d) })),
    [routines],
  );

  const todayCount = routinesForWeekday(routines, todayWd).length;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const r = add({
      entityId,
      title,
      note,
      weekday,
      timeboxMin,
      dayBlock,
      focusToday,
    });
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setTitle("");
    setNote("");
    setTimeboxMin(0);
    setDayBlock("");
    setFocus(false);
    setShowForm(false);
  }

  function onSpawn() {
    const n = spawnToday();
    setSpawnMsg(
      n === 0
        ? `Nada novo para ${WEEKDAY_LABEL[todayWd].toLowerCase()} — já gerado ou sem rotinas activas.`
        : `${n} tarefa${n === 1 ? "" : "s"} criada${n === 1 ? "" : "s"} para hoje.`,
    );
  }

  return (
    <div className="page">
      <PageHeader title="Rotina" mark="pine">
        Tarefas semanais recorrentes. Cada dia da semana gera automaticamente a tarefa
        correspondente.{" "}
        <Link to="/tarefas" className="border-b border-ink/25 pb-px hover:border-ink">
          Minhas
        </Link>
      </PageHeader>

      <Sep />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.78rem] text-ink/50">
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
          Define o que se repete em cada dia. Em {ymd}, as activas de{" "}
          {WEEKDAY_LABEL[todayWd].toLowerCase()} entram em «Para fazer».
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {byDay.map(({ day, items }) => {
            const isToday = day === todayWd;
            return (
              <div
                key={day}
                className={`min-h-[8rem] border-t-2 pt-3 ${
                  isToday ? "border-copper" : "border-ink/10"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className={`font-display text-[0.95rem] ${
                      isToday ? "text-copper" : "text-ink/80"
                    }`}
                  >
                    <span className="sm:hidden">{WEEKDAY_SHORT[day]}</span>
                    <span className="hidden sm:inline">{WEEKDAY_LABEL[day]}</span>
                  </h3>
                  <span className="num text-[0.65rem] text-ink/35">{items.length}</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {items.length === 0 ? (
                    <li className="text-[0.72rem] text-ink/30">—</li>
                  ) : (
                    items.map((r) => (
                      <li
                        key={r.id}
                        className={`group border-b border-ink/[0.06] pb-2 ${
                          r.active ? "" : "opacity-40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => update(r.id, { active: !r.active })}
                            className="text-left text-[0.8rem] leading-snug text-ink/85 hover:text-ink"
                            title={r.active ? "Pausar" : "Activar"}
                          >
                            {r.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(r.id)}
                            className="shrink-0 text-[0.65rem] text-ink/25 opacity-0 transition-opacity hover:text-rust group-hover:opacity-100"
                            aria-label="Apagar"
                          >
                            ×
                          </button>
                        </div>
                        <p className="mt-0.5 text-[0.65rem] text-ink/40">
                          {ENTITY[r.entityId]?.short ?? r.entityId}
                          {r.dayBlock ? ` · ${DAY_BLOCK_LABEL[r.dayBlock]}` : ""}
                          {r.timeboxMin > 0 ? ` · ${r.timeboxMin}m` : ""}
                          {r.focusToday ? " · Hoje" : ""}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setWeekday(day);
                    setShowForm(true);
                  }}
                  className="mt-3 text-[0.7rem] text-ink/40 hover:text-ink"
                >
                  + neste dia
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <Sep />

      <section>
        <div className="section-head">
          <Mark tone="copper" />
          <h2 className="section-title">Nova rotina</h2>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="ml-auto text-[0.75rem] text-ink/50 hover:text-ink"
          >
            {showForm ? "Fechar" : "Abrir"}
          </button>
        </div>

        {showForm ? (
          <form onSubmit={onSubmit} className="mt-5 max-w-xl space-y-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Treino, rever caixa, standup…"
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
            <div className="flex flex-wrap gap-3">
              <Select
                value={String(weekday)}
                onChange={(v) => setWeekday(Number(v) as Weekday)}
                options={WEEKDAY_OPTIONS}
                aria-label="Dia da semana"
              />
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
              <Select
                value={dayBlock}
                onChange={setDayBlock}
                options={DAY_BLOCK_OPTIONS}
                aria-label="Bloco do dia"
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
            <button
              type="submit"
              className="border border-ink/20 px-4 py-2 text-sm tracking-wide text-ink hover:border-ink hover:bg-ink hover:text-paper"
            >
              Guardar na semana
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-ink/45">
            Ou escolhe «+ neste dia» numa coluna da grelha.
          </p>
        )}
      </section>
    </div>
  );
}
