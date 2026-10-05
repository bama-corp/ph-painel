/**
 * Rotina semanal PH — áreas alinhadas ao calendário de foco.
 *
 * Seg/Ter/Qui · Tecnologia 2h
 * Qua · Negócios + vendas 2h
 * Sex · Projeto 2h
 * Sáb · Projeto + negócio 3–4h
 * Dom · Revisão 30–60 min
 *
 * Uso: node scripts/seed-rotina-semanal.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTasksSchema, getTasksSql, upsertRoutine } from "../server/db.mjs";

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

/** @type {Array<{
 *   id: string,
 *   weekday: number,
 *   title: string,
 *   note: string,
 *   area: string,
 *   timeboxMin: number,
 *   dayBlock: string,
 *   sortOrder: number,
 * }>} */
const WEEK = [
  {
    id: "seed-rotina-seg-tech",
    weekday: 0,
    title: "Bloco Tecnologia",
    note: "2h · estudar / construir / escrever código sem copiar",
    area: "tecnologia",
    timeboxMin: 120,
    dayBlock: "noite",
    sortOrder: 0,
  },
  {
    id: "seed-rotina-ter-tech",
    weekday: 1,
    title: "Bloco Tecnologia",
    note: "2h · continuar o plano técnico da semana",
    area: "tecnologia",
    timeboxMin: 120,
    dayBlock: "noite",
    sortOrder: 0,
  },
  {
    id: "seed-rotina-qua-biz",
    weekday: 2,
    title: "Bloco Negócios + vendas",
    note: "2h · outreach, propostas, follow-up, clientes",
    area: "negocios",
    timeboxMin: 120,
    dayBlock: "noite",
    sortOrder: 0,
  },
  {
    id: "seed-rotina-qui-tech",
    weekday: 3,
    title: "Bloco Tecnologia",
    note: "2h · fechar o ciclo técnico da semana",
    area: "tecnologia",
    timeboxMin: 120,
    dayBlock: "noite",
    sortOrder: 0,
  },
  {
    id: "seed-rotina-sex-proj",
    weekday: 4,
    title: "Bloco Projeto",
    note: "2h · avançar o projecto principal (entrega concreta)",
    area: "projeto",
    timeboxMin: 120,
    dayBlock: "noite",
    sortOrder: 0,
  },
  {
    id: "seed-rotina-sab-proj",
    weekday: 5,
    title: "Bloco Projeto",
    note: "Sábado · bloco longo de construção",
    area: "projeto",
    timeboxMin: 120,
    dayBlock: "manha",
    sortOrder: 0,
  },
  {
    id: "seed-rotina-sab-biz",
    weekday: 5,
    title: "Bloco Negócio",
    note: "Sábado · vendas / posicionamento / conteúdo",
    area: "negocios",
    timeboxMin: 90,
    dayBlock: "tarde",
    sortOrder: 1,
  },
  {
    id: "seed-rotina-dom-review",
    weekday: 6,
    title: "Revisão semanal",
    note: "30–60 min · o que avançou, o que fica, foco da próxima semana",
    area: "revisao",
    timeboxMin: 45,
    dayBlock: "manha",
    sortOrder: 0,
  },
];

async function main() {
  const sql = getTasksSql();
  if (!sql) {
    console.error("TASKS_DATABASE_URL em falta.");
    process.exit(1);
  }
  await ensureTasksSchema(sql);

  let n = 0;
  for (const row of WEEK) {
    await upsertRoutine(sql, {
      id: row.id,
      entityId: "pessoal",
      title: row.title,
      note: row.note,
      weekday: row.weekday,
      timeboxMin: row.timeboxMin,
      dayBlock: row.dayBlock,
      focusToday: false,
      active: true,
      sortOrder: row.sortOrder,
      lastSpawnYmd: "",
      area: row.area,
    });
    n += 1;
    console.log(`✓ ${row.id} · ${row.title} (${row.area})`);
  }
  console.log(`\n${n} rotinas upserted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
