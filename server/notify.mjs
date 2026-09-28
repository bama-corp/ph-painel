/** Notificações PH — ntfy (preferido) + Telegram; digest de tarefas. */

const ENTITY_SHORT = {
  pessoal: "Minhas",
  cw: "PDS",
  rove: "Plural",
  picasso: "Picasso's",
  ph: "PH",
};

const MONTHS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/**
 * @param {string} text
 * @param {{ title?: string, priority?: string, tags?: string, click?: string }} [meta]
 * @returns {Promise<{ ok: true, via: string } | { ok: false, reason: string }>}
 */
export async function sendNotify(text, meta = {}) {
  const ntfy = await sendNtfy(text, meta);
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
 * @param {string} text
 * @param {{ title?: string, priority?: string, tags?: string, click?: string }} [meta]
 */
async function sendNtfy(text, meta = {}) {
  const topic = (process.env.NTFY_TOPIC || "").trim();
  if (!topic) {
    return { ok: false, reason: "ntfy: NTFY_TOPIC em falta." };
  }
  const base = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
  const title = (meta.title || "PH Tarefas").trim() || "PH Tarefas";
  const priority = (meta.priority || "default").trim() || "default";
  const tags = (meta.tags || "clipboard").trim() || "clipboard";
  const click =
    (meta.click || process.env.NOTIFY_CLICK_URL || "").trim() || undefined;

  try {
    /** @type {Record<string, string>} */
    const headers = {
      Title: title,
      Priority: priority,
      Tags: tags,
    };
    if (click) headers.Click = click;

    const res = await fetch(`${base}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers,
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

/** Data local YYYY-MM-DD (não UTC). */
export function todayYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayShort(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const day = Number(m[3]);
  const month = MONTHS_PT[Number(m[2]) - 1] || m[2];
  return `${day} ${month}`;
}

function entityLabel(entityId) {
  if (!entityId) return "";
  return ENTITY_SHORT[entityId] || entityId;
}

function taskLine(t) {
  const title = String(t.title || "").trim() || "(sem título)";
  const label = entityLabel(t.entityId);
  if (!label) return `· ${title}`;
  return `· ${title} — ${label}`;
}

/**
 * Metadados ntfy a partir dos counts do digest.
 * @param {{ overdue: number, dueToday: number, focus: number, inbox: number }} counts
 * @param {string} todayYmdStr
 */
export function digestNotifyMeta(counts, todayYmdStr) {
  const day = formatDayShort(todayYmdStr);
  let title = `PH · ${day}`;
  let priority = "default";
  let tags = "clipboard";

  if (counts.overdue > 0) {
    title = `PH · ${counts.overdue} atrasada${counts.overdue === 1 ? "" : "s"}`;
    priority = "high";
    tags = "warning";
  } else if (counts.dueToday > 0) {
    title = `PH · ${counts.dueToday} prazo${counts.dueToday === 1 ? "" : "s"} hoje`;
    priority = "default";
    tags = "calendar";
  } else if (counts.focus > 0) {
    title = `PH · ${counts.focus} foco`;
    priority = "default";
    tags = "pushpin";
  } else if (counts.inbox > 0) {
    title = `PH · ${counts.inbox} inbox`;
    priority = "default";
    tags = "inbox_tray";
  } else {
    title = `PH · dia limpo · ${day}`;
    priority = "low";
    tags = "white_check_mark";
  }

  const click = (process.env.NOTIFY_CLICK_URL || "").trim() || undefined;
  return { title, priority, tags, click };
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

  const counts = {
    overdue: overdue.length,
    dueToday: dueToday.length,
    focus: focus.length,
    inbox: inbox.length,
    open: open.length,
  };

  const summaryParts = [];
  if (counts.overdue) summaryParts.push(`${counts.overdue} atrasada${counts.overdue === 1 ? "" : "s"}`);
  if (counts.dueToday) summaryParts.push(`${counts.dueToday} prazo${counts.dueToday === 1 ? "" : "s"}`);
  if (counts.focus) summaryParts.push(`${counts.focus} foco`);
  if (counts.inbox) summaryParts.push(`${counts.inbox} inbox`);

  const lines = [];
  if (summaryParts.length) {
    lines.push(summaryParts.join(" · "));
    lines.push("");
  }

  if (overdue.length) {
    lines.push("ATRASADAS");
    for (const t of overdue.slice(0, 8)) lines.push(taskLine(t));
    if (overdue.length > 8) lines.push(`· … +${overdue.length - 8}`);
    lines.push("");
  }

  if (dueToday.length) {
    lines.push("PRAZO HOJE");
    for (const t of dueToday.slice(0, 8)) lines.push(taskLine(t));
    if (dueToday.length > 8) lines.push(`· … +${dueToday.length - 8}`);
    lines.push("");
  }

  if (focus.length) {
    lines.push("HOJE · FOCO");
    for (const t of focus.slice(0, 5)) lines.push(taskLine(t));
    if (focus.length > 5) lines.push(`· … +${focus.length - 5}`);
    lines.push("");
  }

  if (inbox.length) {
    lines.push(`INBOX · ${inbox.length} por esclarecer`);
    lines.push("");
  }

  if (!overdue.length && !dueToday.length && !focus.length && !inbox.length) {
    lines.push("Nada urgente — inbox limpa e sem prazos hoje.");
  } else {
    lines.push("Abre Tarefas no painel.");
  }

  const meta = digestNotifyMeta(counts, today);

  return {
    text: lines.join("\n").trim(),
    title: meta.title,
    priority: meta.priority,
    tags: meta.tags,
    click: meta.click,
    counts,
  };
}

/** Mensagem de teste no mesmo formato estruturado do digest. */
export function buildTestNotify() {
  const now = new Date();
  const ymd = todayYmd(now);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const day = formatDayShort(ymd);

  const text = [
    "Canal ntfy · OK",
    "",
    "TESTE",
    `· Digest estruturado activo — ${day} ${hh}:${mm}`,
    "· Título, prioridade e tags dinâmicos",
    "",
    "Se leste isto no telemóvel, está tudo certo.",
  ].join("\n");

  return {
    text,
    title: `PH · teste · ${day}`,
    priority: "default",
    tags: "white_check_mark",
    click: (process.env.NOTIFY_CLICK_URL || "").trim() || undefined,
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
