import { useState, type DragEvent } from "react";
import { LayoutGroup, motion } from "framer-motion";
import {
  QUADRANT_LABEL,
  type Task,
  type TaskQuadrant,
} from "../domain/tasks";
import { Mark } from "./Page";

const CELLS: {
  q: Exclude<TaskQuadrant, "">;
  title: string;
  sub: string;
  tone: "copper" | "pine" | "moss" | "rust";
}[] = [
  { q: "fazer", title: "Fazer agora", sub: "Urgente · importante", tone: "copper" },
  { q: "agendar", title: "Agendar", sub: "Importante · não urgente", tone: "pine" },
  { q: "delegar", title: "Delegar", sub: "Urgente · não importante", tone: "moss" },
  { q: "eliminar", title: "Eliminar", sub: "Nem urgente nem importante", tone: "rust" },
];

type Props = {
  tasks: Task[];
  onSetQuadrant: (id: string, q: TaskQuadrant) => void;
  onSelect: (task: Task) => void;
  selectedId?: string;
};

const ease = [0.22, 1, 0.36, 1] as const;

export function EisenhowerMatrix({ tasks, onSetQuadrant, onSelect, selectedId }: Props) {
  const [dragOver, setDragOver] = useState<TaskQuadrant | "unset" | null>(null);
  const open = tasks.filter((t) => t.status !== "feita");
  const unset = open.filter((t) => !t.quadrant);

  function onDragStart(e: DragEvent, id: string) {
    e.dataTransfer.setData("text/task-id", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function drop(e: DragEvent, q: TaskQuadrant) {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    if (id) onSetQuadrant(id, q);
  }

  return (
    <div className="mt-8">
      <p className="eyebrow flex items-center gap-2">
        <Mark tone="pine" />
        Matriz Eisenhower
      </p>
      <p className="mt-2 max-w-xl text-sm text-ink/45">
        Arrasta para o quadrante. Urgente × importante.
      </p>

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
            Por classificar
            <span className="num text-ink/30">{unset.length}</span>
          </p>
          <ul className="flex flex-wrap gap-2">
            {unset.map((t) => (
              <Chip
                key={t.id}
                task={t}
                selected={selectedId === t.id}
                onDragStart={onDragStart}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <LayoutGroup id="ph-eisenhower">
        <div className="mt-6 grid gap-0 border border-ink/15 sm:grid-cols-2">
          {CELLS.map((cell, i) => {
            const rows = open.filter((t) => t.quadrant === cell.q);
            const over = dragOver === cell.q;
            return (
              <section
                key={cell.q}
                className={`min-h-[10rem] border-ink/15 p-3 sm:p-4 ${
                  i % 2 === 1 ? "sm:border-l" : ""
                } ${i >= 2 ? "border-t" : ""} ${over ? "bg-wash/50" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(cell.q);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOver((d) => (d === cell.q ? null : d));
                  }
                }}
                onDrop={(e) => drop(e, cell.q)}
              >
                <p className="eyebrow flex items-center gap-2">
                  <Mark tone={cell.tone} />
                  {cell.title}
                  <span className="num text-ink/30">{rows.length}</span>
                </p>
                <p className="mt-1 text-[0.72rem] text-ink/40">{cell.sub}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {rows.map((t) => (
                    <motion.li key={t.id} layout transition={{ duration: 0.25, ease }}>
                      <Chip
                        task={t}
                        selected={selectedId === t.id}
                        onDragStart={onDragStart}
                        onSelect={onSelect}
                        showQ={false}
                      />
                    </motion.li>
                  ))}
                  {rows.length === 0 ? (
                    <li className="py-2 text-sm text-ink/30">Vazio</li>
                  ) : null}
                </ul>
              </section>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}

function Chip({
  task,
  selected,
  onDragStart,
  onSelect,
  showQ = true,
}: {
  task: Task;
  selected: boolean;
  onDragStart: (e: DragEvent, id: string) => void;
  onSelect: (t: Task) => void;
  showQ?: boolean;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onSelect(task)}
      className={`w-full border border-ink/12 bg-wash/40 px-2.5 py-2 text-left text-sm transition-colors hover:border-ink/25 ${
        selected ? "border-ink/40" : ""
      }`}
    >
      <span className="line-clamp-2 leading-snug text-ink/80">
        {task.focusToday ? <span className="mr-1 text-pine">●</span> : null}
        {task.title}
      </span>
      {showQ && task.quadrant ? (
        <span className="mt-1 block text-[0.65rem] uppercase tracking-[0.1em] text-ink/35">
          {QUADRANT_LABEL[task.quadrant]}
        </span>
      ) : null}
    </button>
  );
}
