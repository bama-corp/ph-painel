/** Notificações PH — Telegram (telemóvel) + helpers de digest. */

/**
 * @param {string} text
 * @returns {Promise<{ ok: true, via: string } | { ok: false, reason: string }>}
 */
export async function sendNotify(text) {
  // ntfy primeiro (canal preferido no PH)
  const ntfy = await sendNtfy(text);
  if (ntfy.ok) return ntfy;

  const telegram = await sendTelegram(text);
  if (telegram.ok) return telegram;

  const reasons = [ntfy.reason, telegram.reason].filter(Boolean);
  return {
    ok: false,
    reason: reasons.join(" · ") || "Nenhum canal configurado (NTFY_TOPIC ou TELEGRAM_*).",
  };
}

/**
 * @param {string} text
 */
async function sendTelegram(text) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chatId) {
    return { ok: false, reason: "Telegram: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID em falta." };
  }
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        reason: `Telegram: ${data.description || res.statusText || res.status}`,
      };
    }
    return { ok: true, via: "telegram" };
  } catch (e) {
    return { ok: false, reason: `Telegram: ${e.message || e}` };
  }
}

/**
 * Canal simples (app ntfy.sh no telemóvel).
 * @param {string} text
 */
async function sendNtfy(text) {
  const topic = (process.env.NTFY_TOPIC || "").trim();
  if (!topic) {
    return { ok: false, reason: "ntfy: NTFY_TOPIC em falta." };
  }
  const base = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        Title: "PH Tarefas",
        Priority: "default",
        Tags: "clipboard",
      },
      body: text,
    });
    if (!res.ok) {
      return { ok: false, reason: `ntfy: HTTP ${res.status}` };
    }
    return { ok: true, via: "ntfy" };
  } catch (e) {
    return { ok: false, reason: `ntfy: ${e.message || e}` };
  }
}

function todayYmd(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/**
 * @param {Array<{ title?: string, status?: string, due?: string, focusToday?: boolean, entityId?: string }>} tasks
 * @param {{ today?: string }} [opts]
 */
export function buildTasksDigest(tasks, opts = {}) {
  const today = opts.today || todayYmd();
  const open = (tasks || []).filter((t) => t && t.status !== "feita");
  const overdue = open.filter((t) => t.due && t.due < today);
  const dueToday = open.filter((t) => t.due === today);
  const focus = open.filter((t) => t.focusToday);
  const inbox = open.filter((t) => t.status === "inbox");

  const lines = [];
  lines.push(`PH Tarefas · ${today}`);
  lines.push("");

  if (overdue.length) {
    lines.push(`Atrasadas (${overdue.length})`);
    for (const t of overdue.slice(0, 8)) {
      lines.push(`· ${t.title}${t.entityId && t.entityId !== "pessoal" ? ` [${t.entityId}]` : ""}`);
    }
    if (overdue.length > 8) lines.push(`· … +${overdue.length - 8}`);
    lines.push("");
  }

  if (dueToday.length) {
    lines.push(`Prazo hoje (${dueToday.length})`);
    for (const t of dueToday.slice(0, 8)) {
      lines.push(`· ${t.title}`);
    }
    if (dueToday.length > 8) lines.push(`· … +${dueToday.length - 8}`);
    lines.push("");
  }

  if (focus.length) {
    lines.push(`Hoje · foco (${focus.length})`);
    for (const t of focus.slice(0, 5)) {
      lines.push(`· ${t.title}`);
    }
    lines.push("");
  }

  if (inbox.length) {
    lines.push(`Inbox: ${inbox.length} por esclarecer`);
    lines.push("");
  }

  if (!overdue.length && !dueToday.length && !focus.length && !inbox.length) {
    lines.push("Nada urgente — inbox limpa e sem prazos hoje.");
  } else {
    lines.push("Abre o painel → Tarefas.");
  }

  return {
    text: lines.join("\n").trim(),
    counts: {
      overdue: overdue.length,
      dueToday: dueToday.length,
      focus: focus.length,
      inbox: inbox.length,
      open: open.length,
    },
  };
}

/**
 * Autoriza cron/UI: Bearer PH_API_KEY ou ?secret=NOTIFY_SECRET (ou PH_API_KEY).
 * @param {import('http').IncomingMessage | { headers?: Record<string, string|string[]|undefined>, url?: string }} req
 */
export function authorizeNotify(req) {
  const key = (process.env.PH_API_KEY || "").trim();
  const secret = (process.env.NOTIFY_SECRET || key || "").trim();
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = String(header).replace(/^Bearer\s+/i, "").trim();
  if (key && token === key) return { ok: true };
  if (secret && token === secret) return { ok: true };
  if (cronSecret && token === cronSecret) return { ok: true };

  // Vercel Cron (quando CRON_SECRET coincide com o Bearer automático)
  const vercelCron = req.headers?.["x-vercel-cron"] || req.headers?.["X-Vercel-Cron"];
  if (vercelCron && (cronSecret || secret) && token && (token === cronSecret || token === secret)) {
    return { ok: true };
  }

  try {
    const url = new URL(req.url || "/", "http://local");
    const q = (url.searchParams.get("secret") || "").trim();
    if (secret && q === secret) return { ok: true };
  } catch {
    /* ignore */
  }

  // Sem chaves configuradas: só em local (dev sem PH_API_KEY)
  if (!key && !secret && !cronSecret) return { ok: true };

  return { ok: false, status: 401, error: "Não autorizado (Bearer ou ?secret=)." };
}

export function notifyChannelsConfigured() {
  const telegram = Boolean(
    (process.env.TELEGRAM_BOT_TOKEN || "").trim() &&
      (process.env.TELEGRAM_CHAT_ID || "").trim(),
  );
  const ntfy = Boolean((process.env.NTFY_TOPIC || "").trim());
  return { telegram, ntfy, any: telegram || ntfy };
}
