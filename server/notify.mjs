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

function isEvent(t) {
  return t && t.bundle === "eventos";
}

function isoWeekdayFromYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return (new Date().getDay() + 6) % 7;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return (date.getDay() + 6) % 7;
}

const WEEKDAY_PT = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DAY_BLOCK_PT = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
const BLOCK_RANK = { manha: 0, tarde: 1, noite: 2 };

function addDaysYmd(ymd, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  const date = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date();
  date.setDate(date.getDate() + days);
  return todayYmd(date);
}

function routineLine(r) {
  const title = String(r.title || "").trim() || "(sem título)";
  const time = /^\d{2}:\d{2}$/.test(String(r.startsAt || "")) ? r.startsAt : "";
  const block = DAY_BLOCK_PT[r.dayBlock] || "";
  const mins = Number(r.timeboxMin) > 0 ? `${r.timeboxMin}m` : "";
  const label = entityLabel(r.entityId);
  const extra = [time, block, mins, label].filter(Boolean).join(" · ");
  return extra ? `· ${title} — ${extra}` : `· ${title}`;
}

/**
 * Metadados ntfy: tarefas de hoje. A rotina vai no corpo, para o dia seguinte.
 * @param {{ overdue: number, day: number }} counts
 * @param {string} todayYmdStr
 */
export function digestNotifyMeta(counts, todayYmdStr) {
  const day = formatDayShort(todayYmdStr);
  let title = `PH · dia limpo · ${day}`;
  let priority = "low";
  let tags = "white_check_mark";

  if (counts.overdue > 0) {
    title = `PH · ${counts.overdue} atrasada${counts.overdue === 1 ? "" : "s"} · ${day}`;
    priority = "high";
    tags = "warning";
  } else if (counts.day > 0) {
    title = `PH · ${counts.day} tarefa${counts.day === 1 ? "" : "s"} hoje`;
    priority = "default";
    tags = "clipboard";
  }

  const click = (process.env.NOTIFY_CLICK_URL || "").trim() || undefined;
  return { title, priority, tags, click };
}

/**
 * Tarefas de hoje (atrasadas + prazo hoje + «Hoje») e a rotina de amanhã.
 * A rotina chega no dia anterior ao dia em que se cumpre.
 * @param {Array<{ title?: string, status?: string, due?: string, focusToday?: boolean, entityId?: string, bundle?: string }>} tasks
 * @param {{ today?: string, routines?: Array<{ title?: string, weekday?: number, active?: boolean, dayBlock?: string, timeboxMin?: number, entityId?: string, sortOrder?: number }> }} [opts]
 */
export function buildTasksDigest(tasks, opts = {}) {
  const today = opts.today || todayYmd();
  const open = (tasks || []).filter((t) => t && t.status !== "feita" && !isEvent(t));
  const dayTasks = open
    .filter((t) => t.focusToday || (t.due && t.due <= today))
    .sort((a, b) => {
      const ra = a.due && a.due < today ? 0 : a.due === today ? 1 : 2;
      const rb = b.due && b.due < today ? 0 : b.due === today ? 1 : 2;
      if (ra !== rb) return ra - rb;
      if (Boolean(a.focusToday) !== Boolean(b.focusToday)) return a.focusToday ? -1 : 1;
      return String(a.title || "").localeCompare(String(b.title || ""), "pt");
    });
  const overdue = dayTasks.filter((t) => t.due && t.due < today);

  const tomorrowWd = (isoWeekdayFromYmd(today) + 1) % 7;
  const tomorrowName = WEEKDAY_PT[tomorrowWd] || "Amanhã";
  const routinesTomorrow = (opts.routines || [])
    .filter((r) => r && r.active !== false && Number(r.weekday) === tomorrowWd)
    .sort((a, b) => {
      const ba = BLOCK_RANK[a.dayBlock] ?? 3;
      const bb = BLOCK_RANK[b.dayBlock] ?? 3;
      if (ba !== bb) return ba - bb;
      const ta = /^\d{2}:\d{2}$/.test(String(a.startsAt || "")) ? a.startsAt : "99:99";
      const tb = /^\d{2}:\d{2}$/.test(String(b.startsAt || "")) ? b.startsAt : "99:99";
      if (ta !== tb) return ta.localeCompare(tb);
      return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
        String(a.title || "").localeCompare(String(b.title || ""), "pt");
    });

  const counts = {
    overdue: overdue.length,
    dueToday: dayTasks.filter((t) => t.due === today).length,
    focus: dayTasks.filter((t) => t.focusToday).length,
    inbox: 0,
    open: open.length,
    day: dayTasks.length,
    routineTomorrow: routinesTomorrow.length,
    tomorrow: addDaysYmd(today, 1),
  };

  const lines = [];
  lines.push(`TAREFAS · ${formatDayShort(today)}`);
  if (!dayTasks.length) {
    lines.push("· Nenhuma tarefa para hoje.");
  } else {
    for (const t of dayTasks.slice(0, 12)) lines.push(taskLine(t));
    if (dayTasks.length > 12) lines.push(`· … +${dayTasks.length - 12}`);
  }
  lines.push("");
  lines.push(`ROTINA · ${tomorrowName}`);
  if (!routinesTomorrow.length) {
    lines.push("· Amanhã sem rotina activa.");
  } else {
    for (const r of routinesTomorrow.slice(0, 12)) lines.push(routineLine(r));
    if (routinesTomorrow.length > 12) lines.push(`· … +${routinesTomorrow.length - 12}`);
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
