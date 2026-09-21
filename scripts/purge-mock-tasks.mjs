/**
 * Apaga tarefas demo (id mock-*) da BD de tarefas Neon.
 * Uso: node scripts/purge-mock-tasks.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(resolve(root, ".env"));

const url = process.env.TASKS_DATABASE_URL;
if (!url) {
  console.error("TASKS_DATABASE_URL em falta no .env");
  process.exit(1);
}

const sql = neon(url);
const before = await sql`select count(*)::int as n from ph_tasks where id like 'mock-%'`;
console.log("mocks_antes", before[0]?.n ?? 0);

const deleted = await sql`delete from ph_tasks where id like 'mock-%' returning id`;
console.log("apagados", deleted.length);
if (deleted.length) {
  console.log(deleted.map((r) => r.id).join("\n"));
}

const after = await sql`select count(*)::int as n from ph_tasks`;
console.log("tarefas_restantes", after[0]?.n ?? 0);
