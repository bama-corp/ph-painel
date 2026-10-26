/**
 * JavaScript operacional (Projeto 2030).
 * IDs estáveis de Outubro (`seed-js-2026-2026-10-…`).
 * A execução fica em Novembro: este script move as datas sem apagar progresso.
 * O dia 31 cabe em 30 de Novembro.
 *
 * Uso: npm run seed:js-outubro
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTasksSchema, getTasksSql, upsertTask } from "../server/db.mjs";
import { shiftOctoberTechTask } from "../src/domain/octoberShift.ts";

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

function todayYmd() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** @param {string} taskId @param {string[]} titles */
function subs(taskId, titles) {
  return titles.map((title, i) => ({
    id: `${taskId}-s${String(i + 1).padStart(2, "0")}`,
    title,
    done: false,
  }));
}

/**
 * @param {{
 *   day: string,
 *   title: string,
 *   note?: string,
 *   subtasks: string[],
 *   timeboxMin?: number,
 *   status?: string,
 *   quadrant?: string,
 * }} p
 */
function dayTask(p) {
  const id = `seed-js-2026-${p.day}`;
  return {
    id,
    entityId: "pessoal",
    bundle: "js-outubro-2026",
    area: "tecnologia",
    title: p.title,
    note: p.note ?? "Projeto 2030 · Outubro JS · 2h · entender → escrever sem copiar → construir",
    due: p.day,
    status: p.status ?? "para_fazer",
    quadrant: p.quadrant ?? "agendar",
    timeboxMin: p.timeboxMin ?? 120,
    dayBlock: "noite",
    subtasks: subs(id, p.subtasks),
  };
}

function milestone(id, title, due, note, titles) {
  return {
    id: `seed-js-2026-${id}`,
    entityId: "pessoal",
    bundle: "js-outubro-2026",
    area: "tecnologia",
    title,
    note,
    due,
    status: "planejar",
    quadrant: "agendar",
    timeboxMin: 90,
    dayBlock: "tarde",
    subtasks: subs(`seed-js-2026-${id}`, titles),
  };
}

const at = todayYmd();

/** @type {ReturnType<typeof dayTask>[]} */
const DAYS = [
  dayTask({
    day: "2026-10-01",
    title: "1 OUT — Setup + JS básico",
    subtasks: [
      "VS Code + Node.js",
      "Pastas projeto-2030 + javascript-outubro",
      "Repo Git + GitHub",
      "let / const / variáveis / comentários",
      "Prática: 10 variáveis + template literals + 5 exercícios",
      "Entrega: 1º commit",
    ],
  }),
  dayTask({
    day: "2026-10-02",
    title: "2 OUT — Tipos + operadores",
    subtasks: [
      "String, Number, Boolean, null, undefined, typeof",
      "Math + comparação (=== !==) + && || !",
      "Prática: calculadora, idade, saldo, Kz→USD, aprovação",
      "Entrega: 5 exercícios + commit",
    ],
  }),
  dayTask({
    day: "2026-10-03",
    title: "3 OUT — Condicionais",
    subtasks: [
      "if / else / else if / switch / ternário",
      "Prática: classificação, login, saldo, desconto, aprovação",
      "Desafio: sistema de classificação financeira",
      "Testar + corrigir + commit",
    ],
  }),
  dayTask({
    day: "2026-10-04",
    title: "4 OUT — Loops",
    subtasks: [
      "for / while / do…while / break / continue",
      "Prática: 1–100, pares/ímpares, soma, maior, tabuada",
      "Desafio: relatório de vendas (total, média, max, min)",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-05",
    title: "5 OUT — Funções",
    subtasks: [
      "Parâmetros, return, declaration / expression / arrow",
      "Prática: soma, desconto, salário, lucro, maioridade…",
      "Desafio: financialUtils.js (≥10 funções)",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-06",
    title: "6 OUT — Projecto: Calculadora financeira",
    timeboxMin: 150,
    subtasks: [
      "Salário + despesas → total, saldo, % gasto",
      "Classificar situação + relatório",
      "Organizar + testar + bugs",
      "README + commit + push",
    ],
  }),
  dayTask({
    day: "2026-10-07",
    title: "7 OUT — Revisão S1 (sem conteúdo novo)",
    timeboxMin: 90,
    subtasks: [
      "Rever: variáveis, tipos, operadores, if, loops, funções",
      "Refazer Calculadora financeira sem olhar o código",
      "Se falhar: repetir só os pontos fracos",
    ],
  }),
  dayTask({
    day: "2026-10-08",
    title: "8 OUT — Arrays",
    subtasks: [
      "Criar, index, length, push/pop/shift/unshift",
      "includes / slice / splice",
      "Listas: clientes, produtos, despesas, vendas + operações",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-09",
    title: "9 OUT — map + filter",
    subtasks: [
      "Estudar map() e filter()",
      "Exercício expenses: nomes, >15000, +10%, relatório",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-10",
    title: "10 OUT — find / some / every",
    subtasks: [
      "find, findIndex, some, every",
      "Procurar cliente/produto; checar despesas e pagamentos",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-11",
    title: "11 OUT — reduce",
    subtasks: [
      "reduce: acumulador + valor inicial",
      "Total vendas/despesas/receitas, lucro, média, por categoria",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-12",
    title: "12 OUT — Objects",
    subtasks: [
      "Properties, methods, nested, arrays de objects",
      "CRUD de propriedades",
      "Prática: object company (employees + finances)",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-13",
    title: "13 OUT — Destructuring + spread",
    subtasks: [
      "Object/array destructuring, spread, rest",
      "Default params, optional chaining, ??",
      "10 exercícios destructuring + 10 spread/rest",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-14",
    title: "14 OUT — Projecto: Finance Dashboard v1",
    timeboxMin: 150,
    subtasks: [
      "Dados: receitas, despesas, categorias, contas, transações",
      "Totais, saldo, max/min, por categoria, média",
      "Código limpo + README + push",
    ],
  }),
  dayTask({
    day: "2026-10-15",
    title: "15 OUT — ES6+ (refactor)",
    subtasks: [
      "Arrow, templates, destructuring, spread/rest, ??, ?.",
      "Refatorar projectos antigos com ES6+",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-16",
    title: "16 OUT — Modules",
    subtasks: [
      "export / import (named + default)",
      "Estrutura src/ (main, finance, calculations, validation, utils)",
      "Separar calculadora em módulos + testar",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-17",
    title: "17 OUT — Promises",
    subtasks: [
      "Pending / fulfilled / rejected",
      "then / catch / finally",
      "Criar promises manuais (ok, erro, loading)",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-18",
    title: "18 OUT — Async/Await",
    subtasks: [
      "async / await / try / catch / finally",
      "Converter exercícios .then → async/await",
      "Explicar em voz alta: Promise vs async/await (sem docs)",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-19",
    title: "19 OUT — Error handling",
    subtasks: [
      "try/catch, throw, Error",
      "validateAmount + erros de validação/API",
      "Erros personalizados + tratamento",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-20",
    title: "20 OUT — Clean code",
    subtasks: [
      "Nomes, funções pequenas, SRP, sem duplicação",
      "Refactor de um projecto antigo («outra pessoa entende?»)",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-21",
    title: "21 OUT — Revisão S3 (desafio sem tutorial)",
    timeboxMin: 150,
    subtasks: [
      "App pequena: arrays + objects + functions + modules",
      "Promises + async/await + error handling",
      "Sem tutorial · commit",
    ],
  }),
  dayTask({
    day: "2026-10-22",
    title: "22 OUT — HTTP (conceitos)",
    subtasks: [
      "Client, server, request, response",
      "URL, headers, body, JSON",
      "Notas próprias + commit (se houver código demo)",
    ],
  }),
  dayTask({
    day: "2026-10-23",
    title: "23 OUT — Métodos HTTP",
    subtasks: [
      "GET / POST / PUT / PATCH / DELETE",
      "Quando usar cada um (exemplos financeiros/CRM)",
      "Commit notas ou cheatsheet",
    ],
  }),
  dayTask({
    day: "2026-10-24",
    title: "24 OUT — Status codes",
    subtasks: [
      "2xx: 200, 201, 204",
      "4xx: 400, 401, 403, 404",
      "5xx: 500, 502, 503 — interpretar, não decorar todos",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-25",
    title: "25 OUT — Fetch",
    subtasks: [
      "GET/POST, headers, JSON, response.json(), response.ok",
      "Tratamento de erros",
      "Consumir 1 API pública",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-26",
    title: "26 OUT — API → interface",
    timeboxMin: 150,
    subtasks: [
      "Pipeline: API → fetch → async → dados → UI",
      "Loading, error, empty, dados",
      "Pesquisa + filtro",
      "Commit",
    ],
  }),
  dayTask({
    day: "2026-10-27",
    title: "27 OUT — API Challenge (sem tutorial)",
    timeboxMin: 150,
    subtasks: [
      "GET + mostrar + pesquisar + filtrar",
      "Loading + erros + async/await + modules",
      "Código organizado + commit",
    ],
  }),
  dayTask({
    day: "2026-10-28",
    title: "28 OUT — Refactor API app",
    subtasks: [
      "Nomes, funções, organização, erros, loading, UI",
      "README + commit + push",
    ],
  }),
  dayTask({
    day: "2026-10-29",
    title: "29 OUT — Projecto final (começar do zero)",
    timeboxMin: 180,
    status: "executar",
    quadrant: "fazer",
    note: "Sem tutorial passo a passo. Expense tracker / CRM / dashboard / tarefas / vendas — à escolha.",
    subtasks: [
      "Escolher ideia e estrutura de pastas",
      "JS moderno + arrays/objects/functions/modules",
      "Promises + async/await + erros + fetch/API",
      "Clean code · 1ª versão a correr",
    ],
  }),
  dayTask({
    day: "2026-10-30",
    title: "30 OUT — Finalizar projecto + reflexão",
    timeboxMin: 150,
    status: "executar",
    quadrant: "fazer",
    subtasks: [
      "Bugs + UI + testes + README",
      "GitHub (+ deploy se possível)",
      "Reflexão escrita: aprendi / não domino / dificuldade / consigo sozinho / Novembro",
    ],
  }),
  dayTask({
    day: "2026-10-31",
    title: "31 OUT — Auditoria do mês (sem conteúdo novo)",
    timeboxMin: 60,
    status: "revisar",
    quadrant: "agendar",
    subtasks: [
      "Checklist JS: arrays, objects, map/filter/reduce, funções, modules, promises, async, erros, HTTP, API",
      "Projecto: completo? GitHub? README? Explico o código?",
      "Negócio: ≥5 conversas? Problema real para Novembro?",
      "Disciplina: rotina, horas, falhas, o que mudar",
    ],
  }),
];

const MILESTONES = [
  milestone(
    "meta-mes",
    "OUT 2026 — Meta: app JS + API no GitHub",
    "2026-10-31",
    "Não «estudei JS» — «aprendi JS e construí algo». Projeto 2030.",
    [
      "JS moderno + async + HTTP",
      "≥1 app completa no GitHub",
      "README executável por outra pessoa",
      "≥5 conversas com potenciais utilizadores",
      "Rotina sustentável (2h × 6 dias)",
    ],
  ),
  milestone(
    "marco-s1",
    "Marco S1 — Calculadora financeira",
    "2026-10-06",
    "Semana 1: fundamentos → projecto pequeno.",
    ["Código no GitHub", "README", "Sei refazer sem copiar (dia 7)"],
  ),
  milestone(
    "marco-s2",
    "Marco S2 — Finance Dashboard v1",
    "2026-10-14",
    "Semana 2: arrays + objects + aggregations.",
    ["Estrutura de dados completa", "Totais / categorias / média", "Push + README"],
  ),
  milestone(
    "marco-s3",
    "Marco S3 — App com modules + async",
    "2026-10-21",
    "Semana 3: ES6, modules, promises, clean code.",
    ["Modules a funcionar", "Async/await explicável", "Desafio dia 21 sem tutorial"],
  ),
  milestone(
    "marco-s4",
    "Marco S4 — Consumir API de ponta a ponta",
    "2026-10-28",
    "Semana 4: HTTP + fetch + UI states.",
    ["GET real", "Loading/error/empty", "Pesquisa + filtro", "Código limpo no GitHub"],
  ),
  milestone(
    "marco-final",
    "Marco final — Projecto Outubro publicado",
    "2026-10-30",
    "App do zero com JS moderno + API.",
    ["Repo público/organizado", "README", "Consigo explicar o código"],
  ),
];

const ALL = [...DAYS, ...MILESTONES];

if (!process.env.TASKS_DATABASE_URL) {
  console.error("TASKS_DATABASE_URL em falta no .env");
  process.exit(1);
}

function subtasksOf(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter((s) => s && typeof s === "object")
    .map((s) => ({
      id: String(s.id ?? ""),
      title: String(s.title ?? ""),
      done: Boolean(s.done),
    }))
    .filter((s) => s.title);
}

const sql = getTasksSql();
await ensureTasksSchema(sql);

const rows = await sql`
  SELECT id, title, note, due, bundle, area, subtasks
  FROM ph_tasks
  WHERE bundle IN ('js-outubro-2026', 'js-novembro-2026')
     OR id LIKE 'seed-js-2026-%'
`;

const existing = new Set();
let moved = 0;
for (const row of rows) {
  existing.add(row.id);
  const current = {
    id: row.id,
    title: row.title,
    note: row.note ?? "",
    due: row.due ?? "",
    bundle: row.bundle ?? "",
    area: row.area ?? "",
    subtasks: subtasksOf(row.subtasks),
  };
  const shifted = shiftOctoberTechTask(current);
  if (shifted === current) continue;
  const subtasksJson = JSON.stringify(shifted.subtasks);
  await sql`
    UPDATE ph_tasks SET
      title = ${shifted.title},
      note = ${shifted.note},
      due = ${shifted.due},
      bundle = ${shifted.bundle},
      area = ${shifted.area || "tecnologia"},
      subtasks = ${subtasksJson}::jsonb,
      updated_at = now()
    WHERE id = ${shifted.id}
  `;
  moved += 1;
}

let inserted = 0;
for (const item of ALL) {
  if (existing.has(item.id)) continue;
  const shifted = shiftOctoberTechTask({
    id: item.id,
    title: item.title,
    note: item.note ?? "",
    due: item.due ?? "",
    bundle: item.bundle ?? "js-outubro-2026",
    area: item.area ?? "tecnologia",
    subtasks: item.subtasks ?? [],
  });
  await upsertTask(sql, {
    id: item.id,
    entityId: item.entityId,
    title: shifted.title,
    note: shifted.note,
    status: item.status ?? "para_fazer",
    quadrant: item.quadrant ?? "agendar",
    focusToday: false,
    at,
    due: shifted.due,
    timeboxMin: item.timeboxMin ?? 120,
    dayBlock: item.dayBlock ?? "noite",
    routineId: "",
    bundle: shifted.bundle,
    area: shifted.area || "tecnologia",
    subtasks: shifted.subtasks,
  });
  inserted += 1;
}

const seeded = await sql`
  SELECT count(*)::int AS n
  FROM ph_tasks
  WHERE bundle = 'js-novembro-2026' OR id LIKE 'seed-js-2026-%'
`;
const stillOctober = await sql`
  SELECT count(*)::int AS n
  FROM ph_tasks
  WHERE (bundle IN ('js-outubro-2026', 'js-novembro-2026') OR id LIKE 'seed-js-2026-%')
    AND due LIKE '2026-10-%'
`;
console.log("moved", moved);
console.log("inserted", inserted);
console.log("dias", DAYS.length);
console.log("marcos", MILESTONES.length);
console.log("seed_js_na_bd", seeded[0]?.n ?? 0);
console.log("ainda_em_outubro", stillOctober[0]?.n ?? 0);
console.log("Abrir Tarefas → Pessoal · calendário Novembro 2026.");
