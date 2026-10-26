/**
 * Backfill area nas tarefas já na BD.
 * Uso: node scripts/backfill-task-areas.mjs [--dry]
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTasksSchema, getTasksSql, listTasks, upsertTask } from "../server/db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dry = process.argv.includes("--dry");

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

/** IDs estáveis → área */
const BY_ID = {
  "seed-pessoal-tcc": "projeto",
  "seed-pessoal-skills": "tecnologia",
  "seed-pessoal-livros": "revisao",
  "seed-pessoal-escuteiros-seccao": "projeto",
  "seed-pessoal-escuteiros-bt": "projeto",
  "seed-rove-01-clients": "negocios",
  "seed-rove-02-netflix": "negocios",
  "seed-rove-03-iptv": "tecnologia",
  "seed-rove-04-fluxo-dinheiro": "financas",
  "seed-rove-05-servicos-adicionais": "negocios",
  "seed-rove-06-pivot-pagamentos": "financas",
  "seed-rove-07-formas-pagamento": "financas",
  "seed-rove-08-catalogo": "negocios",
  "seed-rove-09-redes": "negocios",
  "seed-rove-10-calendario-suporte": "negocios",
  "seed-rove-11-automatizar-atendimento": "tecnologia",
  "seed-rove-12-servidores-antigos": "financas",
  "seed-cw-01-toalhas": "negocios",
  "seed-cw-02-cadeiras": "negocios",
  "seed-cw-03-tvs": "tecnologia",
  "seed-cw-04-recursos": "financas",
  "seed-cw-05-marketing-presencial": "negocios",
  "seed-cw-06-equipamentos": "tecnologia",
  "seed-cw-07-manutencoes": "tecnologia",
  "seed-cw-08-fluxo-diario": "negocios",
  "seed-cw-09-kwik": "financas",
  "seed-cw-10-contrato": "negocios",
  "seed-cw-11-eliandro": "negocios",
  "seed-cw-12-numero-cyber": "negocios",
  "seed-cw-13-dobradicas": "tecnologia",
  "seed-cw-14-fluxo-dinheiro": "financas",
  "seed-cw-15-projeccoes": "financas",
  "seed-cw-16-calendario-eventos": "negocios",
  "seed-cw-17-jogos-pcs": "tecnologia",
  "seed-cw-18-seguranca": "tecnologia",
  "seed-cw-19-limpeza": "negocios",
  "seed-cw-20-cyber-online": "tecnologia",
  "seed-cw-21-pc-operador": "tecnologia",
  "seed-cw-22-precario": "negocios",
};

/** @param {string} text */
function guessArea(text) {
  const s = text.toLowerCase();

  if (
    /\b(js|javascript|typescript|react|node|api|c[oó]digo|dev|git|deploy|server|servidor|debug|bug|css|html|sql|db|neon|vercel|render|tech|tecnolog|pc|cyber|automatizar|iptv|tv|jogo)/.test(
      s,
    )
  ) {
    return "tecnologia";
  }
  if (
    /\b(venda|vendas|cliente|clientes|proposta|outreach|neg[oó]cio|marketing|comercial|lead|cat[aá]logo|redes sociais|pre[cç][aá]rio|contrato|candidatura|est[aá]gio)/.test(
      s,
    )
  ) {
    return "negocios";
  }
  if (
    /\b(finan[cç]|banco|bai|caixa|or[cç]amento|factura|fatura|pagamento|sal[aá]rio|imposto|iva|contabil|fluxo do dinheiro|kwik)/.test(
      s,
    )
  ) {
    return "financas";
  }
  if (/\b(revis[aã]o|weekly review|retrospect|planejar semana|fechar semana|livros)/.test(s)) {
    return "revisao";
  }
  if (/\b(projecto|projeto|2030|entrega|mvp|produto|tcc|logo|escuteiro)/.test(s)) {
    return "projeto";
  }
  return "";
}

/** @param {{ id: string, title: string, note: string, bundle: string, area: string, routineId: string, entityId: string }} t */
function resolveArea(t) {
  if (t.area) return { area: t.area, reason: "already" };

  if (BY_ID[t.id]) return { area: BY_ID[t.id], reason: "id-map" };

  if (
    t.bundle === "js-outubro-2026" ||
    t.bundle === "js-novembro-2026" ||
    t.id.startsWith("seed-js-2026-")
  ) {
    return { area: "tecnologia", reason: "bundle-js" };
  }
  if (t.routineId.includes("tech") || t.id.includes("-tech")) {
    return { area: "tecnologia", reason: "routine-tech" };
  }
  if (t.routineId.includes("biz") || t.id.includes("-biz")) {
    return { area: "negocios", reason: "routine-biz" };
  }
  if (t.routineId.includes("proj") || t.id.includes("-proj")) {
    return { area: "projeto", reason: "routine-proj" };
  }
  if (t.routineId.includes("review") || t.id.includes("-review")) {
    return { area: "revisao", reason: "routine-review" };
  }

  const guessed = guessArea(`${t.title} ${t.note}`);
  if (guessed) return { area: guessed, reason: "guess" };

  // fallback por entidade empresa → negócios (ops do dia-a-dia)
  if (t.entityId === "cw" || t.entityId === "rove" || t.entityId === "picasso" || t.entityId === "ph") {
    return { area: "negocios", reason: "entity-default" };
  }

  return { area: "", reason: "skip" };
}

async function main() {
  const sql = getTasksSql();
  if (!sql) {
    console.error("TASKS_DATABASE_URL em falta.");
    process.exit(1);
  }
  await ensureTasksSchema(sql);
  const tasks = await listTasks(sql);

  const counts = { already: 0, updated: 0, skipped: 0 };
  const before = {};
  const after = {};
  const skipped = [];

  for (const t of tasks) {
    before[t.area || "(vazio)"] = (before[t.area || "(vazio)"] || 0) + 1;
    const { area, reason } = resolveArea(t);

    if (reason === "already") {
      counts.already += 1;
      after[t.area] = (after[t.area] || 0) + 1;
      continue;
    }
    if (!area) {
      counts.skipped += 1;
      skipped.push(t);
      after["(vazio)"] = (after["(vazio)"] || 0) + 1;
      continue;
    }

    console.log(`${dry ? "DRY" : "SET"} ${t.id} → ${area} (${reason}) · ${t.title.slice(0, 50)}`);
    if (!dry) {
      await upsertTask(sql, { ...t, area });
    }
    counts.updated += 1;
    after[area] = (after[area] || 0) + 1;
  }

  console.log("\nAntes:", before);
  console.log("Depois:", after);
  console.log("Contagens:", counts, dry ? "(dry-run)" : "");
  if (skipped.length) {
    console.log(`\nSem área (${skipped.length}):`);
    for (const t of skipped) {
      console.log(`  ${t.id} | ${t.entityId} | ${t.title.slice(0, 70)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
