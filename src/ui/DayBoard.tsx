import { useState, type DragEvent } from "react";
import { LayoutGroup, motion } from "framer-motion";
import {
  DAY_BLOCK_LABEL,
  MAX_FOCUS_TODAY,
  type Task,
  type TaskDayBlock,
} from "../domain/tasks";
import { Mark } from "./Page";

const BANDS: {
  id: Exclude<TaskDayBlock, "">;
  sub: string;
  /** Faixa de relógio (orientação) */
  clock: string;
  /** Minutos “úteis” sugeridos no bloco */
  capacity: number;
  tone: "pine" | "copper" | "moss";
}[] = [
  { id: "manha", sub: "Foco profundo", clock: "09:00–12:00", capacity: 180, tone: "pine" },
  { id: "tarde", sub: "Execução e reuniões", clock: "14:00–18:00", capacity: 180, tone: "copper" },
  { id: "noite", sub: "Leve / fecho", clock: "19:00–21:00", capacity: 90, tone: "moss" },
];

type Props = {
  /** Prioridades «Hoje» a encaixar */
  focusTasks: Task[];
  onSetBlock: (id: string, block: TaskDayBlock) => void;
  onSelect: (task: Task) => void;
  selectedId?: string;
  focusSlotsLeft: number;
};

const ease = [0.22, 1, 0.36, 1] as const;

function minutesOf(tasks: Task[]) {
  return tasks.reduce((s, t) => s + (t.timeboxMin > 0 ? t.timeboxMin : 25), 0);
}

export function DayBoard({
  focusTasks,
  onSetBlock,
  onSelect,
  selectedId,
  focusSlotsLeft,
}: Props) {
  const [dragOver, setDragOver] = useState<TaskDayBlock | "unset" | null>(null);
  const unset = focusTasks.filter((t) => !t.dayBlock);

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/task-id", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function drop(e: DragEvent, block: TaskDayBlock) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    if (id) onSetBlock(id, block);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Mark tone="pine" />
            Vista do dia · time blocking
          </p>
          <p className="mt-2 max-w-xl text-sm text-ink/45">
            Encaixa as ≤{MAX_FOCUS_TODAY} «Hoje» em manhã (09–12), tarde (14–18) ou noite
            (19–21). Arrasta entre faixas. A barra mostra carga vs capacidade do bloco.
          </p>
        </div>
        <p className="num text-sm text-ink/40">
          {focusTasks.length}/{MAX_FOCUS_TODAY}
          {focusSlotsLeft > 0 ? ` · +${focusSlotsLeft}` : ""}
        </p>
      </div>

      {focusTasks.length === 0 ? (
        <p className="mt-8 flex items-center gap-2.5 text-sm text-ink/45">
          <Mark tone="soft" />
          Ainda sem «Hoje». Marca prioridades na Revisão ou no Kanban.
        </p>
      ) : (
        <>
          {unset.length > 0 ? (
            <div
              className={`mt-6 border border-ink/15 px-3 py-3 ${
                dragOver === "unset" ? "bg-wash/50" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver("unset");
              }}
              onDragLeave={() => setDragOver((d) => (d === "unset" ? null : d))}
              onDrop={(e) => drop(e, "")}
            >
              <p className="eyebrow mb-2 flex items-center gap-2">
                <Mark tone="soft" />
                Por encaixar
                <span className="num text-ink/30">{unset.length}</span>
              </p>
              <p className="mb-3 text-[0.8rem] text-ink/40">
                Arrasta para uma faixa — senão o bloco fica desprotegido.
              </p>
              <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {unset.map((t) => (
                  <li key={t.id} className="sm:max-w-xs sm:flex-1">
                    <DayChip
                      task={t}
                      selected={selectedId === t.id}
                      onDragStart={onDragStart}
                      onSelect={onSelect}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <LayoutGroup id="ph-dayboard">
            <div className="mt-6 grid gap-0 border border-ink/15 lg:grid-cols-3">
              {BANDS.map((band, i) => {
                const rows = focusTasks.filter((t) => t.dayBlock === band.id);
                const used = minutesOf(rows);
                const over = used > band.capacity;
                const pct = Math.min(100, Math.round((used / band.capacity) * 100));
                const overCol = dragOver === band.id;

                return (
                  <section
                    key={band.id}
                    className={`min-h-[14rem] border-ink/15 p-3 sm:p-4 ${
                      i > 0 ? "border-t lg:border-t-0 lg:border-l" : ""
                    } ${overCol ? "bg-wash/50" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(band.id);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOver((d) => (d === band.id ? null : d));
                      }
                    }}
                    onDrop={(e) => drop(e, band.id)}
                  >
                    <p className="eyebrow flex items-center gap-2">
                      <Mark tone={band.tone} />
                      {DAY_BLOCK_LABEL[band.id]}
                      <span className="num text-ink/30">{rows.length}</span>
                    </p>
                    <p className="mt-1 text-[0.72rem] text-ink/40">
                      {band.clock} · {band.sub}
                    </p>

                    <div className="mt-3">
                      <div className="flex justify-between text-[0.65rem] uppercase tracking-[0.1em] text-ink/35">
                        <span>
                          {used}′ / {band.capacity}′
                        </span>
                        <span className={over ? "text-rust" : ""}>
                          {over ? "Cheio" : `${pct}%`}
                        </span>
                      </div>
                      <div className="mt-1.5 h-px w-full bg-ink/10">
                        <div
                          className={`h-px transition-[width] duration-300 ${
                            over ? "bg-rust/70" : "bg-pine/55"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <ul className="mt-4 flex flex-col gap-2">
                      {rows.map((t) => (
                        <motion.li key={t.id} layout transition={{ duration: 0.25, ease }}>
                          <DayChip
                            task={t}
                            selected={selectedId === t.id}
                            onDragStart={onDragStart}
                            onSelect={onSelect}
                          />
                        </motion.li>
                      ))}
                      {rows.length === 0 ? (
                        <li className="border border-dashed border-ink/12 px-2.5 py-6 text-center text-sm text-ink/30">
                          Solta aqui
                        </li>
                      ) : null}
                    </ul>
                  </section>
                );
              })}
            </div>
          </LayoutGroup>
        </>
      )}
    </div>
  );
}

function DayChip({
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
  const mins = task.timeboxMin > 0 ? task.timeboxMin : 25;
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onSelect(task)}
      className={`w-full border border-ink/12 bg-wash/40 px-2.5 py-2.5 text-left transition-colors hover:border-ink/25 ${
        selected ? "border-ink/40" : ""
      }`}
    >
      <span className="line-clamp-2 text-sm leading-snug text-ink/80">{task.title}</span>
      <span className="mt-1.5 flex flex-wrap gap-x-2 text-[0.65rem] uppercase tracking-[0.1em] text-ink/35">
        <span className="num">{mins}′</span>
        {task.quadrant ? <span>{task.quadrant}</span> : null}
      </span>
    </button>
  );
}
