import fs from "node:fs";

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = parseEnv(fs.readFileSync(".env", "utf8"));
const report = [];

function checkPg(name) {
  const v = env[name] || "";
  if (!v) {
    report.push({ name, ok: false, msg: "vazio" });
    return;
  }
  try {
    const u = new URL(v);
    report.push({
      name,
      ok: true,
      host: u.hostname,
      db: u.pathname.replace(/^\//, "") || "(default)",
      sslmode: u.searchParams.get("sslmode"),
      pooled: u.hostname.includes("-pooler"),
      neon: /\.neon\.tech$/i.test(u.hostname),
      hasUser: Boolean(u.username),
      hasPass: Boolean(u.password),
    });
  } catch (e) {
    report.push({ name, ok: false, msg: String(e.message) });
  }
}

checkPg("DATABASE_URL");
checkPg("DIRECT_URL");

const pluralUrl = env.VITE_PLURAL_API_URL || "";
report.push({
  name: "VITE_PLURAL_API_URL",
  ok: Boolean(pluralUrl),
  value: pluralUrl || "(vazio)",
});
report.push({
  name: "VITE_PLURAL_API_KEY",
  ok: Boolean(env.VITE_PLURAL_API_KEY),
  len: (env.VITE_PLURAL_API_KEY || "").length,
});
report.push({
  name: "DATABASE_eq_DIRECT",
  same: env.DATABASE_URL === env.DIRECT_URL,
});

console.log(JSON.stringify(report, null, 2));

const url = env.DATABASE_URL;
if (!url) {
  console.log("CONNECT: skip");
  process.exit(0);
}

try {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  const rows = await sql`select 1 as ok, current_database() as db`;
  console.log("CONNECT_OK", JSON.stringify(rows[0]));
} catch (e) {
  if (String(e.message).includes("Cannot find package") || e.code === "ERR_MODULE_NOT_FOUND") {
    console.log("CONNECT: package @neondatabase/serverless not installed — installing briefly…");
  } else {
    console.log("CONNECT_FAIL", e.message);
  }
}
