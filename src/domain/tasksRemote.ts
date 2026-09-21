import type { Task } from "./tasks";
import { coerceTask } from "./tasks";

const API_BASE = (import.meta.env.VITE_PH_API_URL as string | undefined)?.replace(/\/$/, "") || "";
const API_KEY = (import.meta.env.VITE_PH_API_KEY as string | undefined) || "";

function tasksUrl(id?: string) {
  const base = `${API_BASE}/api/tasks`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`;
  return h;
}

export type TasksRemoteLoad =
  | { ok: true; tasks: Task[] }
  | { ok: false; missingConfig?: boolean; reason: string };

function normalizeList(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceTask).filter((t): t is Task => t !== null);
}

export async function fetchRemoteTasks(): Promise<TasksRemoteLoad> {
  try {
    const res = await fetch(tasksUrl(), { headers: headers() });
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
    const data = (await res.json()) as { tasks?: unknown };
    return { ok: true, tasks: normalizeList(data.tasks) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export async function pushRemoteTask(
  task: Task,
): Promise<{ ok: true; task: Task } | { ok: false; reason: string }> {
  try {
    const res = await fetch(tasksUrl(task.id), {
      method: "PUT",
      headers: headers(true),
      body: JSON.stringify({ task }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { task?: unknown };
    const saved = data.task ? coerceTask(data.task) : null;
    return { ok: true, task: saved ?? task };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export async function deleteRemoteTask(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(tasksUrl(id), {
      method: "DELETE",
      headers: headers(),
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

/** Upsert em lote (flush) — sem wipe no servidor. */
export async function pushRemoteTasks(
  tasks: Task[],
): Promise<{ ok: true; tasks: Task[] } | { ok: false; reason: string }> {
  try {
    const res = await fetch(tasksUrl(), {
      method: "PUT",
      headers: headers(true),
      body: JSON.stringify({ tasks }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { tasks?: unknown };
    return { ok: true, tasks: normalizeList(data.tasks) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}
