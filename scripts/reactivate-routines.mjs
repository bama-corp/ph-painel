/**
 * Reactiva rotinas seed que foram pausadas por engano.
 * Uso: node scripts/reactivate-routines.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTasksSchema, getTasksSql, listRoutines, upsertRoutine } from "../server/db.mjs";

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

async function main() {
  const sql = getTasksSql();
  if (!sql) {
    console.error("TASKS_DATABASE_URL em falta.");
    process.exit(1);
  }
  await ensureTasksSchema(sql);
  const routines = await listRoutines(sql);
  let n = 0;
  for (const r of routines) {
    console.log(`${r.active ? "ON " : "OFF"} ${r.id} · ${r.title}`);
    if (!r.active) {
      await upsertRoutine(sql, { ...r, active: true });
      console.log(`  → reactivada`);
      n += 1;
    }
  }
  console.log(n === 0 ? "\nNenhuma pausada." : `\n${n} reactivada(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
