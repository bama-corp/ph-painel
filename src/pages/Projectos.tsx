import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ENTITY } from "../domain/labels";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  type Project,
  type ProjectStatus,
} from "../domain/projects";
import { useProjects } from "../domain/projectsStore";
import { STATUS_LABEL, type Task } from "../domain/tasks";
import { useTasks } from "../domain/tasksStore";
import type { EntityId } from "../domain/types";
import { COMPANIES } from "../domain/types";
import { useConfirm } from "../ui/ConfirmDialog";
import { Mark, PageHeader } from "../ui/Page";
import { Select, type SelectOption } from "../ui/Select";

const ENTITY_OPTIONS: SelectOption<EntityId>[] = [
  { value: "pessoal", label: "Minhas", tone: "pine" },
  ...COMPANIES.map((id) => ({
    value: id,
    label: ENTITY[id].short,
    tone: "moss" as const,
  })),
];

const STATUS_OPTIONS: SelectOption<ProjectStatus>[] = PROJECT_STATUSES.map((s) => ({
  value: s,
  label: PROJECT_STATUS_LABEL[s],
  tone: s === "activo" ? "pine" : s === "parado" ? "copper" : "soft",
}));

export function Projectos() {
  const { id } = useParams();
  if (id) return <ProjectoDetalhe id={id} />;
  return <ProjectosLista />;
}

function ProjectosLista() {
  const { projects, add, syncStatus, syncError } = useProjects();
  const { tasks } = useTasks();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [entityId, setEntityId] = useState<EntityId>("pessoal");
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);

  const groups = PROJECT_STATUSES.map((status) => ({
    status,
    items: projects.filter((p) => p.status === status),
  })).filter((g) => g.items.length > 0 || g.status === "activo");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const r = add({ name, note, due, entityId, status: "activo" });
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setName("");
    setNote("");
    setDue("");
    setErr("");
    setShowForm(false);
  }

  return (
    <div className="page">
      <ProjectosHead syncStatus={syncStatus} syncError={syncError} />
      <PageHeader title="Projectos" mark="ink">
        Cada projecto junta as tarefas que lhe pertencem. Criar e concluir continua na lista de tarefas.
      </PageHeader>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="border-b border-ink/25 pb-px text-sm text-ink/70 hover:border-ink hover:text-ink"
        >
          {showForm ? "Fechar" : "Novo projecto"}
        </button>
        {showForm ? (
          <form onSubmit={onSubmit} className="mt-5 max-w-xl space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do projecto"
              className="w-full border-b border-ink/20 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink/30 focus:border-ink"
              autoFocus
              required
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota (opcional)"
              rows={2}
              className="w-full resize-none border-b border-ink/15 bg-transparent py-2 text-sm text-ink/80 outline-none placeholder:text-ink/30 focus:border-ink"
            />
            <div className="flex flex-wrap items-end gap-4">
              <label className="text-sm text-ink/60">
                <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.14em] text-ink/40">
                  Prazo
                </span>
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="border border-ink/15 bg-transparent px-2 py-1 text-ink"
                />
              </label>
              <Select value={entityId} onChange={setEntityId} options={ENTITY_OPTIONS} aria-label="Âmbito" />
            </div>
            {err ? <p className="text-sm text-rust">{err}</p> : null}
            <button
              type="submit"
              className="border border-ink/20 px-4 py-2 text-sm tracking-wide text-ink hover:border-ink hover:bg-ink hover:text-paper"
            >
              Criar
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-10 space-y-10">
        {groups.map((g) => (
          <section key={g.status}>
            <h2 className="text-[0.65rem] uppercase tracking-[0.14em] text-ink/40">
              {PROJECT_STATUS_LABEL[g.status]} · {g.items.length}
            </h2>
            {g.items.length === 0 ? (
              <p className="mt-3 text-sm text-ink/40">Nenhum projecto activo.</p>
            ) : (
              <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
                {g.items.map((p) => (
                  <ProjectCard key={p.id} project={p} tasks={tasks} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project, tasks }: { project: Project; tasks: Task[] }) {
  const mine = tasks.filter((t) => t.projectId === project.id);
  const open = mine.filter((t) => t.status !== "feita").length;
  return (
    <li>
      <Link to={`/projectos/${project.id}`} className="flex flex-wrap items-baseline justify-between gap-3 py-4 hover:bg-wash/40">
        <span>
          <span className="font-display text-xl tracking-tight text-ink">{project.name}</span>
          <span className="ml-3 text-[0.65rem] uppercase tracking-[0.12em] text-ink/40">
            {ENTITY[project.entityId]?.short ?? project.entityId}
          </span>
        </span>
        <span className="text-sm text-ink/50">
          {open} por fazer
          {mine.length !== open ? ` · ${mine.length - open} feitas` : ""}
          {project.due ? <span className="num ml-3 text-ink/40">{project.due}</span> : null}
        </span>
      </Link>
    </li>
  );
}

function ProjectoDetalhe({ id }: { id: string }) {
  const { projects, update, remove } = useProjects();
  const { tasks, add, update: updateTask, setStatus } = useTasks();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");

  const mine = useMemo(
    () => tasks.filter((t) => t.projectId === id).sort((a, b) => a.title.localeCompare(b.title, "pt")),
    [tasks, id],
  );
  const open = mine.filter((t) => t.status !== "feita");
  const done = mine.filter((t) => t.status === "feita");

  if (!project) {
    return (
      <div className="page">
        <ProjectosHead />
        <p className="mt-8 text-sm text-ink/55">Este projecto não está na lista.</p>
        <Link to="/projectos" className="mt-4 inline-block border-b border-ink/25 text-sm text-ink/70">
          Voltar
        </Link>
      </div>
    );
  }

  function onAddTask(e: FormEvent) {
    e.preventDefault();
    if (!project) return;
    const r = add({
      entityId: project.entityId,
      title,
      status: "para_fazer",
      area: "projeto",
      projectId: project.id,
    });
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setTitle("");
    setErr("");
  }

  async function onDelete() {
    const ok = await confirm({
      eyebrow: "Projecto",
      title: "Apagar este projecto?",
      body: `«${project?.name ?? ""}» sai da lista. As tarefas ficam, sem projecto.`,
      confirmLabel: "Apagar",
    });
    if (!ok || !project) return;
    for (const t of mine) updateTask(t.id, { projectId: "" });
    remove(project.id);
    navigate("/projectos");
  }

  return (
    <div className="page">
      <ProjectosHead />
      <Link to="/projectos" className="text-[0.75rem] uppercase tracking-[0.12em] text-ink/45 hover:text-ink">
        ← Projectos
      </Link>
      <PageHeader title={project.name} mark={project.status === "parado" ? "copper" : "ink"}>
        {project.note || "Tarefas deste projecto."}
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="text-sm text-ink/60">
          <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.14em] text-ink/40">Estado</span>
          <Select
            value={project.status}
            onChange={(status) => update(project.id, { status })}
            options={STATUS_OPTIONS}
            aria-label="Estado"
          />
        </label>
        <label className="text-sm text-ink/60">
          <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.14em] text-ink/40">Prazo</span>
          <input
            type="date"
            value={project.due}
            onChange={(e) => update(project.id, { due: e.target.value })}
            className="border border-ink/15 bg-transparent px-2 py-1 text-ink"
          />
        </label>
        <button type="button" onClick={() => void onDelete()} className="mb-1 text-sm text-ink/35 hover:text-rust">
          Apagar projecto
        </button>
      </div>

      <form onSubmit={onAddTask} className="mt-8 flex max-w-xl flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 text-sm text-ink/60">
          <span className="mb-1 block text-[0.65rem] uppercase tracking-[0.14em] text-ink/40">
            Nova tarefa
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="O que falta fazer"
            className="w-full border-b border-ink/20 bg-transparent py-2 text-ink outline-none placeholder:text-ink/30 focus:border-ink"
          />
        </label>
        <button
          type="submit"
          className="border border-ink/20 px-3 py-2 text-sm text-ink hover:border-ink hover:bg-ink hover:text-paper"
        >
          Acrescentar
        </button>
      </form>
      {err ? <p className="mt-2 text-sm text-rust">{err}</p> : null}

      <TaskGroup title="Por fazer" items={open} onDone={(t) => setStatus(t.id, "feita")} onDetach={(t) => updateTask(t.id, { projectId: "" })} />
      <TaskGroup title="Feitas" items={done} onDone={(t) => setStatus(t.id, "para_fazer")} onDetach={(t) => updateTask(t.id, { projectId: "" })} done />
    </div>
  );
}

function TaskGroup({
  title,
  items,
  onDone,
  onDetach,
  done = false,
}: {
  title: string;
  items: Task[];
  onDone: (t: Task) => void;
  onDetach: (t: Task) => void;
  done?: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[0.65rem] uppercase tracking-[0.14em] text-ink/40">
        {title} · {items.length}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink/35">—</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/[0.07]">
          {items.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
              <p className={done ? "text-ink/45 line-through" : "text-ink"}>
                {t.title}
                <span className="ml-2 text-[0.65rem] uppercase tracking-[0.1em] text-ink/35">
                  {STATUS_LABEL[t.status]}
                </span>
              </p>
              <span className="flex gap-3 text-[0.72rem]">
                <button type="button" onClick={() => onDone(t)} className="text-ink/50 hover:text-ink">
                  {done ? "Reabrir" : "Feito"}
                </button>
                <button type="button" onClick={() => onDetach(t)} className="text-ink/35 hover:text-ink">
                  Tirar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectosHead({
  syncStatus,
  syncError,
}: {
  syncStatus?: string;
  syncError?: string;
}) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <Link
          to="/"
          className="brand inline-flex items-end gap-0.5 text-[1.85rem] text-ink transition-opacity hover:opacity-70 sm:text-[2.35rem]"
          title="Voltar ao hub"
        >
          <span>PH</span>
          <img src="/logo.png?v=3" alt="" width={48} height={48} className="-ml-0.5 mb-[0.08em] h-[1.05em] w-auto" />
        </Link>
        <span className="eyebrow mb-1.5">Projectos</span>
        <Link to="/tarefas" className="mb-1.5 ml-auto text-[0.75rem] text-ink/45 hover:text-ink">
          Tarefas
        </Link>
      </div>
      {syncStatus && syncStatus !== "synced" && syncStatus !== "saving" && syncStatus !== "loading" ? (
        <p className="mt-3 text-sm text-rust">
          Sync: {syncError || syncStatus}
        </p>
      ) : null}
      <div className="mt-4 flex items-center gap-3">
        <Mark />
        <span className="sep-line flex-1" />
      </div>
    </header>
  );
}
