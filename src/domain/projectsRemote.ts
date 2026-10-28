import { coerceProject, type Project } from "./projects";

const API_BASE = (import.meta.env.VITE_PH_API_URL as string | undefined)?.replace(/\/$/, "") || "";
const API_KEY = (import.meta.env.VITE_PH_API_KEY as string | undefined) || "";

function projectsUrl(id?: string) {
  const base = `${API_BASE}/api/projects`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`;
  return h;
}

export type ProjectsRemoteLoad =
  | { ok: true; projects: Project[] }
  | { ok: false; missingConfig?: boolean; reason: string };

function normalizeList(raw: unknown): Project[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceProject).filter((p): p is Project => p !== null);
}

export async function fetchRemoteProjects(): Promise<ProjectsRemoteLoad> {
  try {
    const res = await fetch(projectsUrl(), { headers: headers(), credentials: "include" });
    if (res.status === 503) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; missing?: string };
      return {
        ok: false,
        missingConfig: body.missing === "TASKS_DATABASE_URL",
        reason: body.error || "TASKS_DATABASE_URL em falta.",
      };
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { projects?: unknown };
    return { ok: true, projects: normalizeList(data.projects) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export async function pushRemoteProject(
  project: Project,
): Promise<{ ok: true; project: Project } | { ok: false; reason: string }> {
  try {
    const res = await fetch(projectsUrl(project.id), {
      method: "PUT",
      headers: headers(true),
      credentials: "include",
      body: JSON.stringify({ project }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { project?: unknown };
    const saved = data.project ? coerceProject(data.project) : null;
    return { ok: true, project: saved ?? project };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export async function deleteRemoteProject(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(projectsUrl(id), {
      method: "DELETE",
      headers: headers(),
      credentials: "include",
    });
    if (res.status === 404) return { ok: true };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export async function pushRemoteProjects(
  projects: Project[],
): Promise<{ ok: true; projects: Project[] } | { ok: false; reason: string }> {
  try {
    const res = await fetch(projectsUrl(), {
      method: "PUT",
      headers: headers(true),
      credentials: "include",
      body: JSON.stringify({ projects }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { projects?: unknown };
    return { ok: true, projects: normalizeList(data.projects) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}
