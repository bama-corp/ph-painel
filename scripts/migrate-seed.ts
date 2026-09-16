/**
 * Cria schema e grava seed no Neon se ainda não existir.
 * Uso: npx tsx scripts/migrate-seed.ts [--force]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSchema, getSql, getSnapshot, putSnapshot } from "../server/db.mjs";
import { seedState } from "../src/domain/seed";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(path: string) {
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

const force = process.argv.includes("--force");
const sql = getSql();
await ensureSchema(sql);
const existing = await getSnapshot(sql);

if (existing && !force) {
  console.log(
    `Já existe snapshot na BD (updated_at=${existing.updated_at}). Usa --force para sobrescrever com seed.`,
  );
  process.exit(0);
}

const seed = seedState();
const saved = await putSnapshot(sql, seed, seed.schemaVersion);
console.log("Seed gravado:", saved);
