import type { EntityId } from "./types";

export type ProjectStatus = "activo" | "parado" | "fechado";

export type Project = {
  id: string;
  name: string;
  note: string;
  status: ProjectStatus;
  /** YYYY-MM-DD. Vazio = sem prazo. */
  due: string;
  entityId: EntityId;
  updatedAt: string;
};

export const PROJECTS_STORAGE_KEY = "ph-projectos-v1";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  activo: "Activo",
  parado: "Parado",
  fechado: "Fechado",
};

export const PROJECT_STATUSES: ProjectStatus[] = ["activo", "parado", "fechado"];

function uid() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(raw: unknown): ProjectStatus {
  if (raw === "activo" || raw === "parado" || raw === "fechado") return raw;
  return "activo";
}

function normalizeDue(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function normalizeEntity(raw: unknown): EntityId {
  if (raw === "pessoal" || raw === "cw" || raw === "rove" || raw === "picasso" || raw === "ph") {
    return raw;
  }
  return "pessoal";
}

export function touchProject(p: Project): Project {
  return { ...p, updatedAt: nowIso() };
}

export function createProject(draft: {
  name: string;
  note?: string;
  status?: ProjectStatus;
  due?: string;
  entityId?: EntityId;
}): Project {
  return {
    id: uid(),
    name: draft.name.trim(),
    note: (draft.note ?? "").trim(),
    status: draft.status ?? "activo",
    due: normalizeDue(draft.due),
    entityId: draft.entityId ?? "pessoal",
    updatedAt: nowIso(),
  };
}

export function coerceProject(x: unknown): Project | null {
  if (!x || typeof x !== "object") return null;
  const p = x as Record<string, unknown>;
  if (typeof p.id !== "string" || typeof p.name !== "string") return null;
  const name = p.name.trim();
  if (!name) return null;
  const updatedAt =
    typeof p.updatedAt === "string" && p.updatedAt
      ? p.updatedAt
      : typeof p.updated_at === "string" && p.updated_at
        ? p.updated_at
        : nowIso();
  return {
    id: p.id,
    name,
    note: typeof p.note === "string" ? p.note : "",
    status: normalizeStatus(p.status),
    due: normalizeDue(p.due),
    entityId: normalizeEntity(p.entityId ?? p.entity_id),
    updatedAt,
  };
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(coerceProject).filter((p): p is Project => p !== null);
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

export function mergeProjects(local: Project[], remote: Project[]): Project[] {
  const map = new Map<string, Project>();
  for (const p of remote) map.set(p.id, p);
  for (const p of local) {
    const cur = map.get(p.id);
    if (!cur || p.updatedAt >= cur.updatedAt) map.set(p.id, p);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt"));
}

export function projectsByStatus(projects: Project[], status: ProjectStatus): Project[] {
  return projects.filter((p) => p.status === status).sort((a, b) => a.name.localeCompare(b.name, "pt"));
}
