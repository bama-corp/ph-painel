/** Alertas no dispositivo (browser / PWA) — sem servidor. */

const PREF_KEY = "ph-device-notify-v1";

export type DeviceNotifyPrefs = {
  enabled: boolean;
  /** Pedido de permissão já feito */
  asked: boolean;
};

export function loadDeviceNotifyPrefs(): DeviceNotifyPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { enabled: false, asked: false };
    const p = JSON.parse(raw) as Partial<DeviceNotifyPrefs>;
    return {
      enabled: Boolean(p.enabled),
      asked: Boolean(p.asked),
    };
  } catch {
    return { enabled: false, asked: false };
  }
}

export function saveDeviceNotifyPrefs(prefs: DeviceNotifyPrefs) {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function enableDeviceNotifications(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!("Notification" in window)) {
    return { ok: false, reason: "Este browser não suporta notificações." };
  }
  const perm = await Notification.requestPermission();
  saveDeviceNotifyPrefs({ enabled: perm === "granted", asked: true });
  if (perm !== "granted") {
    return { ok: false, reason: "Permissão recusada — activa nas definições do browser." };
  }
  return { ok: true };
}

export function disableDeviceNotifications() {
  saveDeviceNotifyPrefs({ enabled: false, asked: true });
}

/** Mostra notificação local se o utilizador activou e a permissão está granted. */
export function showDeviceNotification(title: string, body?: string) {
  const prefs = loadDeviceNotifyPrefs();
  if (!prefs.enabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body: body || undefined,
      tag: "ph-tarefas",
      silent: false,
    });
    window.setTimeout(() => n.close(), 12_000);
  } catch {
    /* ignore */
  }
}

function apiBase() {
  const base = (import.meta.env.VITE_PH_API_URL as string | undefined)?.replace(/\/$/, "") || "";
  return base;
}

function apiHeaders(): HeadersInit {
  const key = (import.meta.env.VITE_PH_API_KEY as string | undefined) || "";
  const h: Record<string, string> = { Accept: "application/json" };
  if (key) h.Authorization = `Bearer ${key}`;
  return h;
}

/** Dispara digest / teste no servidor (Telegram ou ntfy). */
export async function triggerServerNotify(
  mode: "digest" | "test" | "dry",
): Promise<{ ok: true; via?: string; text?: string } | { ok: false; reason: string }> {
  const q =
    mode === "test" ? "?test=1" : mode === "dry" ? "?dry=1" : "";
  try {
    const res = await fetch(`${apiBase()}/api/notify/tasks${q}`, {
      method: "POST",
      headers: apiHeaders(),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      via?: string;
      text?: string;
      digest?: { text?: string };
    };
    if (!res.ok) {
      return { ok: false, reason: data.error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      via: data.via,
      text: data.text || data.digest?.text,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Falha de rede (API a correr?)",
    };
  }
}
