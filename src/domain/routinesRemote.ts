import type { Routine } from "./routines";
import { coerceRoutine } from "./routines";

const API_BASE = (import.meta.env.VITE_PH_API_URL as string | undefined)?.replace(/\/$/, "") || "";
const API_KEY = (import.meta.env.VITE_PH_API_KEY as string | undefined) || "";

function routinesUrl(id?: string) {
  const base = `${API_BASE}/api/routines`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`;
  return h;
}

export type RoutinesRemoteLoad =
  | { ok: true; routines: Routine[] }
  | { ok: false; missingConfig?: boolean; reason: string };

function normalizeList(raw: unknown): Routine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceRoutine).filter((r): r is Routine => r !== null);
}

export async function fetchRemoteRoutines(): Promise<RoutinesRemoteLoad> {
  try {
    const res = await fetch(routinesUrl(), { headers: headers() });
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
    const data = (await res.json()) as { routines?: unknown };
    return { ok: true, routines: normalizeList(data.routines) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export async function pushRemoteRoutine(
  routine: Routine,
): Promise<{ ok: true; routine: Routine } | { ok: false; reason: string }> {
  try {
    const res = await fetch(routinesUrl(routine.id), {
      method: "PUT",
      headers: headers(true),
      body: JSON.stringify({ routine }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { routine?: unknown };
    const saved = data.routine ? coerceRoutine(data.routine) : null;
    return { ok: true, routine: saved ?? routine };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export async function deleteRemoteRoutine(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(routinesUrl(id), {
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

export async function pushRemoteRoutines(
  routines: Routine[],
): Promise<{ ok: true; routines: Routine[] } | { ok: false; reason: string }> {
  try {
    const res = await fetch(routinesUrl(), {
      method: "PUT",
      headers: headers(true),
      body: JSON.stringify({ routines }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { routines?: unknown };
    return { ok: true, routines: normalizeList(data.routines) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}
