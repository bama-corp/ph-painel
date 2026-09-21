/**
 * Núcleo partilhado: ler/escrever snapshot no Neon.
 * Usado pela API local e pelas funções Vercel.
 */
import { neon } from "@neondatabase/serverless";

export function getSql(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL em falta.");
  }
  return neon(databaseUrl);
}

/** BD Neon das Tarefas — projecto/branch separado do financeiro. */
export function getTasksSql(databaseUrl = process.env.TASKS_DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error(
      "TASKS_DATABASE_URL em falta. Cria um projecto Neon para Tarefas e mete a URL pooled no .env.",
    );
  }
  return neon(databaseUrl);
}

export async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS ph_snapshots (
      id TEXT PRIMARY KEY DEFAULT 'default',
      schema_version INTEGER NOT NULL DEFAULT 4,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

export async function ensureTasksSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS ph_tasks (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      title TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      quadrant TEXT NOT NULL DEFAULT '',
      focus_today BOOLEAN NOT NULL DEFAULT false,
      at TEXT NOT NULL,
      due TEXT NOT NULL DEFAULT '',
      timebox_min INTEGER NOT NULL DEFAULT 0,
      day_block TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE ph_tasks ADD COLUMN IF NOT EXISTS timebox_min INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE ph_tasks ADD COLUMN IF NOT EXISTS day_block TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE ph_tasks ADD COLUMN IF NOT EXISTS routine_id TEXT NOT NULL DEFAULT ''`;
  await sql`CREATE INDEX IF NOT EXISTS ph_tasks_entity_idx ON ph_tasks (entity_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS ph_routines (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      title TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      weekday SMALLINT NOT NULL,
      timebox_min INTEGER NOT NULL DEFAULT 0,
      day_block TEXT NOT NULL DEFAULT '',
      focus_today BOOLEAN NOT NULL DEFAULT false,
      active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      last_spawn_ymd TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS ph_routines_entity_idx ON ph_routines (entity_id)`;
  await sql`CREATE INDEX IF NOT EXISTS ph_routines_weekday_idx ON ph_routines (weekday)`;
}

const TASK_ENTITIES = new Set(["pessoal", "cw", "rove", "picasso", "ph"]);
const TASK_QUADRANTS = new Set(["", "fazer", "agendar", "delegar", "eliminar"]);
const TASK_DAY_BLOCKS = new Set(["", "manha", "tarde", "noite"]);

/** @returns {{ ok: true, task: object } | { ok: false, error: string }} */
export function validateTaskInput(raw, { requireId = true } = {}) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Tarefa inválida." };
  const id = String(raw.id ?? "").trim();
  if (requireId && !id) return { ok: false, error: "id obrigatório." };
  const title = String(raw.title ?? "").trim();
  if (!title) return { ok: false, error: "title obrigatório." };
  const entityId = String(raw.entityId ?? raw.entity_id ?? "").trim();
  if (!TASK_ENTITIES.has(entityId)) return { ok: false, error: "entityId inválido." };
  let status = String(raw.status ?? "inbox");
  if (status === "aberta" || status === "a_fazer") status = "para_fazer";
  if (status === "em_curso") status = "executar";
  if (
    !["inbox", "para_fazer", "planejar", "executar", "revisar", "ajustar", "feita"].includes(status)
  ) {
    return { ok: false, error: "status inválido." };
  }
  const quadrant = String(raw.quadrant ?? "");
  if (!TASK_QUADRANTS.has(quadrant)) return { ok: false, error: "quadrant inválido." };
  const dayBlock = String(raw.dayBlock ?? raw.day_block ?? "");
  if (!TASK_DAY_BLOCKS.has(dayBlock)) return { ok: false, error: "dayBlock inválido." };
  let timeboxMin = Number(raw.timeboxMin ?? raw.timebox_min ?? 0);
  if (!Number.isFinite(timeboxMin) || timeboxMin < 0) timeboxMin = 0;
  timeboxMin = Math.min(480, Math.round(timeboxMin));
  const routineId = String(raw.routineId ?? raw.routine_id ?? "").trim();
  return {
    ok: true,
    task: {
      id: id || undefined,
      entityId,
      title,
      note: String(raw.note ?? ""),
      status,
      quadrant,
      focusToday: Boolean(raw.focusToday ?? raw.focus_today),
      at: String(raw.at || new Date().toISOString().slice(0, 10)),
      due: String(raw.due ?? ""),
      timeboxMin,
      dayBlock,
      routineId,
    },
  };
}

export async function listTasks(sql) {
  const rows = await sql`
    SELECT id, entity_id, title, note, status, quadrant, focus_today, at, due,
           timebox_min, day_block, routine_id, updated_at
    FROM ph_tasks
    ORDER BY at DESC, id DESC
  `;
  return rows.map(rowToTask);
}

function rowToTask(row) {
  return {
    id: row.id,
    entityId: row.entity_id,
    title: row.title,
    note: row.note ?? "",
    status: row.status,
    quadrant: row.quadrant ?? "",
    focusToday: Boolean(row.focus_today),
    at: row.at,
    due: row.due ?? "",
    timeboxMin: Number(row.timebox_min ?? 0),
    dayBlock: row.day_block ?? "",
    routineId: row.routine_id ?? "",
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at ?? ""),
  };
}

export async function upsertTask(sql, raw) {
  const v = validateTaskInput(raw, { requireId: true });
  if (!v.ok) throw new Error(v.error);
  const t = v.task;
  const rows = await sql`
    INSERT INTO ph_tasks (
      id, entity_id, title, note, status, quadrant, focus_today, at, due,
      timebox_min, day_block, routine_id, updated_at
    ) VALUES (
      ${t.id},
      ${t.entityId},
      ${t.title},
      ${t.note},
      ${t.status},
      ${t.quadrant},
      ${t.focusToday},
      ${t.at},
      ${t.due},
      ${t.timeboxMin},
      ${t.dayBlock},
      ${t.routineId},
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      entity_id = EXCLUDED.entity_id,
      title = EXCLUDED.title,
      note = EXCLUDED.note,
      status = EXCLUDED.status,
      quadrant = EXCLUDED.quadrant,
      focus_today = EXCLUDED.focus_today,
      at = EXCLUDED.at,
      due = EXCLUDED.due,
      timebox_min = EXCLUDED.timebox_min,
      day_block = EXCLUDED.day_block,
      routine_id = EXCLUDED.routine_id,
      updated_at = now()
    RETURNING id, entity_id, title, note, status, quadrant, focus_today, at, due,
              timebox_min, day_block, routine_id, updated_at
  `;
  return rowToTask(rows[0]);
}

/** Upsert em lote — sem DELETE total. */
export async function upsertTasksBatch(sql, tasks) {
  if (!Array.isArray(tasks)) throw new Error("tasks deve ser um array.");
  const saved = [];
  for (const raw of tasks) {
    const v = validateTaskInput(raw, { requireId: true });
    if (!v.ok) throw new Error(v.error);
    saved.push(await upsertTask(sql, v.task));
  }
  return saved;
}

export async function deleteTask(sql, id) {
  const tid = String(id || "").trim();
  if (!tid) throw new Error("id obrigatório.");
  const rows = await sql`
    DELETE FROM ph_tasks WHERE id = ${tid}
    RETURNING id
  `;
  return { deleted: rows.length > 0, id: tid };
}

/** @deprecated Preferir upsertTasksBatch — sem wipe. */
export async function replaceAllTasks(sql, tasks) {
  return upsertTasksBatch(sql, tasks);
}

export async function getSnapshot(sql, id = "default") {
  const rows = await sql`
    SELECT id, schema_version, payload, updated_at
    FROM ph_snapshots
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function putSnapshot(sql, payload, schemaVersion, id = "default") {
  const rows = await sql`
    INSERT INTO ph_snapshots (id, schema_version, payload, updated_at)
    VALUES (${id}, ${schemaVersion}, ${JSON.stringify(payload)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET
      schema_version = EXCLUDED.schema_version,
      payload = EXCLUDED.payload,
      updated_at = now()
    RETURNING id, schema_version, updated_at
  `;
  return rows[0];
}

export function corsHeaders(origin) {
  const allow = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : ["http://localhost:5173", "http://127.0.0.1:5173"];
  const ok =
    !origin ||
    allow.includes(origin) ||
    allow.includes("*") ||
    /^https:\/\/.*\.vercel\.app$/.test(origin ?? "");
  return {
    "Access-Control-Allow-Origin": ok ? origin || allow[0] : allow[0],
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function authorize(req) {
  const key = process.env.PH_API_KEY;
  if (!key) return { ok: true }; // local sem chave = aberto
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = String(header).replace(/^Bearer\s+/i, "").trim();
  if (token && token === key) return { ok: true };
  return { ok: false, status: 401, error: "Não autorizado." };
}

/** 0=segunda … 6=domingo */
/** @returns {{ ok: true, routine: object } | { ok: false, error: string }} */
export function validateRoutineInput(raw, { requireId = true } = {}) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Rotina inválida." };
  const id = String(raw.id ?? "").trim();
  if (requireId && !id) return { ok: false, error: "id obrigatório." };
  const title = String(raw.title ?? "").trim();
  if (!title) return { ok: false, error: "title obrigatório." };
  const entityId = String(raw.entityId ?? raw.entity_id ?? "").trim();
  if (!TASK_ENTITIES.has(entityId)) return { ok: false, error: "entityId inválido." };
  let weekday = Number(raw.weekday);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { ok: false, error: "weekday inválido (0–6)." };
  }
  const dayBlock = String(raw.dayBlock ?? raw.day_block ?? "");
  if (!TASK_DAY_BLOCKS.has(dayBlock)) return { ok: false, error: "dayBlock inválido." };
  let timeboxMin = Number(raw.timeboxMin ?? raw.timebox_min ?? 0);
  if (!Number.isFinite(timeboxMin) || timeboxMin < 0) timeboxMin = 0;
  timeboxMin = Math.min(480, Math.round(timeboxMin));
  let sortOrder = Number(raw.sortOrder ?? raw.sort_order ?? 0);
  if (!Number.isFinite(sortOrder)) sortOrder = 0;
  return {
    ok: true,
    routine: {
      id: id || undefined,
      entityId,
      title,
      note: String(raw.note ?? ""),
      weekday,
      timeboxMin,
      dayBlock,
      focusToday: Boolean(raw.focusToday ?? raw.focus_today),
      active: raw.active === undefined ? true : Boolean(raw.active),
      sortOrder: Math.round(sortOrder),
      lastSpawnYmd: String(raw.lastSpawnYmd ?? raw.last_spawn_ymd ?? ""),
    },
  };
}

function rowToRoutine(row) {
  return {
    id: row.id,
    entityId: row.entity_id,
    title: row.title,
    note: row.note ?? "",
    weekday: Number(row.weekday),
    timeboxMin: Number(row.timebox_min ?? 0),
    dayBlock: row.day_block ?? "",
    focusToday: Boolean(row.focus_today),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order ?? 0),
    lastSpawnYmd: row.last_spawn_ymd ?? "",
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at ?? ""),
  };
}

export async function listRoutines(sql) {
  const rows = await sql`
    SELECT id, entity_id, title, note, weekday, timebox_min, day_block,
           focus_today, active, sort_order, last_spawn_ymd, updated_at
    FROM ph_routines
    ORDER BY weekday ASC, sort_order ASC, title ASC, id ASC
  `;
  return rows.map(rowToRoutine);
}

export async function upsertRoutine(sql, raw) {
  const v = validateRoutineInput(raw, { requireId: true });
  if (!v.ok) throw new Error(v.error);
  const r = v.routine;
  const rows = await sql`
    INSERT INTO ph_routines (
      id, entity_id, title, note, weekday, timebox_min, day_block,
      focus_today, active, sort_order, last_spawn_ymd, updated_at
    ) VALUES (
      ${r.id},
      ${r.entityId},
      ${r.title},
      ${r.note},
      ${r.weekday},
      ${r.timeboxMin},
      ${r.dayBlock},
      ${r.focusToday},
      ${r.active},
      ${r.sortOrder},
      ${r.lastSpawnYmd},
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      entity_id = EXCLUDED.entity_id,
      title = EXCLUDED.title,
      note = EXCLUDED.note,
      weekday = EXCLUDED.weekday,
      timebox_min = EXCLUDED.timebox_min,
      day_block = EXCLUDED.day_block,
      focus_today = EXCLUDED.focus_today,
      active = EXCLUDED.active,
      sort_order = EXCLUDED.sort_order,
      last_spawn_ymd = EXCLUDED.last_spawn_ymd,
      updated_at = now()
    RETURNING id, entity_id, title, note, weekday, timebox_min, day_block,
              focus_today, active, sort_order, last_spawn_ymd, updated_at
  `;
  return rowToRoutine(rows[0]);
}

export async function upsertRoutinesBatch(sql, routines) {
  if (!Array.isArray(routines)) throw new Error("routines deve ser um array.");
  const saved = [];
  for (const raw of routines) {
    const v = validateRoutineInput(raw, { requireId: true });
    if (!v.ok) throw new Error(v.error);
    saved.push(await upsertRoutine(sql, v.routine));
  }
  return saved;
}

export async function deleteRoutine(sql, id) {
  const rid = String(id || "").trim();
  if (!rid) throw new Error("id obrigatório.");
  const rows = await sql`
    DELETE FROM ph_routines WHERE id = ${rid}
    RETURNING id
  `;
  return { deleted: rows.length > 0, id: rid };
}
