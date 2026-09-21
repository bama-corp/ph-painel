import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const text = readFileSync(".env", "utf8");
const env = {};
for (const line of text.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  env[k] = v;
}

const url = env.TASKS_DATABASE_URL;
if (!url) {
  console.log("MISSING TASKS_DATABASE_URL");
  process.exit(1);
}

const host = new URL(url).hostname;
console.log("HOST", host);
console.log("POOLED", host.includes("-pooler"));

const sql = neon(url);
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
const rows = await sql`select count(*)::int as n from ph_tasks`;
console.log("CONNECT_OK", rows[0]);
