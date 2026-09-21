/**
 * Digest de tarefas → Telegram / ntfy.
 * Uso: node scripts/notify-tasks.mjs
 *      node scripts/notify-tasks.mjs --test
 *      node scripts/notify-tasks.mjs --dry
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTasksSchema, getTasksSql, listTasks } from "../server/db.mjs";
import { buildTasksDigest, notifyChannelsConfigured, sendNotify } from "../server/notify.mjs";

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

const dry = process.argv.includes("--dry");
const test = process.argv.includes("--test");
const channels = notifyChannelsConfigured();

if (!channels.any) {
  console.error("Configura NTFY_TOPIC no .env (ou TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)");
  process.exit(1);
}

let text;
let counts;

if (test) {
  text = `PH · teste ${new Date().toISOString().slice(0, 19)}Z\nSe leste isto no telemóvel, está ok.`;
  counts = null;
} else {
  if (!process.env.TASKS_DATABASE_URL) {
    console.error("TASKS_DATABASE_URL em falta");
    process.exit(1);
  }
  const sql = getTasksSql();
  await ensureTasksSchema(sql);
  const tasks = await listTasks(sql);
  const digest = buildTasksDigest(tasks);
  text = digest.text;
  counts = digest.counts;
}

console.log(text);
if (counts) console.log("counts", counts);

if (dry) {
  console.log("dry-run — não enviado");
  process.exit(0);
}

const sent = await sendNotify(text);
if (!sent.ok) {
  console.error(sent.reason);
  process.exit(1);
}
console.log("enviado via", sent.via);
