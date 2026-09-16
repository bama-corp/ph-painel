import type { AppState } from "./types";
import { migrate } from "./persist";

const API_BASE = (import.meta.env.VITE_PH_API_URL as string | undefined)?.replace(/\/$/, "") || "";
const API_KEY = (import.meta.env.VITE_PH_API_KEY as string | undefined) || "";

function stateUrl() {
  return `${API_BASE}/api/state`;
}

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  if (API_KEY) h.Authorization = `Bearer ${API_KEY}`;
  return h;
}

export type RemoteLoad =
  | { ok: true; state: AppState; updatedAt?: string }
  | { ok: false; empty?: boolean; reason: string };

export async function fetchRemoteState(): Promise<RemoteLoad> {
  try {
    const res = await fetch(stateUrl(), { headers: headers() });
    if (res.status === 404) {
      const body = (await res.json().catch(() => ({}))) as { empty?: boolean };
      return { ok: false, empty: Boolean(body.empty), reason: "Sem snapshot na BD." };
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { state: AppState; updatedAt?: string };
    if (!data.state?.accounts) {
      return { ok: false, reason: "Resposta da API sem state válido." };
    }
    return { ok: true, state: migrate(data.state), updatedAt: data.updatedAt };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export async function pushRemoteState(state: AppState): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(stateUrl(), {
      method: "PUT",
      headers: headers(true),
      body: JSON.stringify({ state }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export function remoteConfigured() {
  // Em dev com proxy Vite, API_BASE pode ser "" e /api funciona via proxy.
  return true;
}
