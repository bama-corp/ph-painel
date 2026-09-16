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
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
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
