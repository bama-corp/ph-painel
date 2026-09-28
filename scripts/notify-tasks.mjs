/**
 * Digest de tarefas → ntfy / Telegram.
 * Uso: node scripts/notify-tasks.mjs
 *      node scripts/notify-tasks.mjs --test
 *      node scripts/notify-tasks.mjs --dry
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTasksSchema, getTasksSql, listTasks } from "../server/db.mjs";
import {
  buildTasksDigest,
  buildTestNotify,
  notifyChannelsConfigured,
  sendNotify,
} from "../server/notify.mjs";

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

/** @type {{ text: string, title?: string, priority?: string, tags?: string, click?: string, counts?: object }} */
let payload;

if (test) {
  payload = buildTestNotify();
} else {
  if (!process.env.TASKS_DATABASE_URL) {
    console.error("TASKS_DATABASE_URL em falta");
    process.exit(1);
  }
  const sql = getTasksSql();
  await ensureTasksSchema(sql);
  const tasks = await listTasks(sql);
  payload = buildTasksDigest(tasks);
}

console.log(`[${payload.title || "PH"}] priority=${payload.priority || "default"} tags=${payload.tags || ""}`);
console.log(payload.text);
if (payload.counts) console.log("counts", payload.counts);

if (dry) {
  console.log("dry-run — não enviado");
  process.exit(0);
}

const sent = await sendNotify(payload.text, {
  title: payload.title,
  priority: payload.priority,
  tags: payload.tags,
  click: payload.click,
});
if (!sent.ok) {
  console.error(sent.reason);
  process.exit(1);
}
console.log("enviado via", sent.via);
