/**
 * Smoke test auth (sem rede).
 * Uso: node scripts/smoke-auth.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  authConfigured,
  createSessionToken,
  verifyCredentials,
  verifySessionToken,
} from "../server/auth.mjs";

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

if (!authConfigured()) {
  console.error("AUTH_* em falta no .env");
  process.exit(1);
}

const bad = verifyCredentials("wrong", "nope");
const byEmail = verifyCredentials(process.env.AUTH_EMAIL, process.env.AUTH_PASSWORD);
const byName = verifyCredentials(process.env.AUTH_NAME, process.env.AUTH_PASSWORD);
console.log("bad", bad.ok);
console.log("email", byEmail.ok, byEmail.user?.email);
console.log("name", byName.ok, byName.user?.name);

const token = createSessionToken(byEmail.user);
const ok = verifySessionToken(token);
const badTok = verifySessionToken(token + "x");
console.log("session", ok.ok, ok.user?.name);
console.log("tamper", badTok.ok);
