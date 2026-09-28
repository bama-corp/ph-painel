/**
 * Seed do backlog Plural / PDS / Eu na BD Neon de tarefas.
 * IDs estáveis — reexecutar actualiza, não duplica.
 *
 * Uso: node scripts/seed-backlog-tasks.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureTasksSchema, getTasksSql, upsertTask } from "../server/db.mjs";

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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @param {string} taskId @param {string[]} titles */
function subs(taskId, titles) {
  return titles.map((title, i) => ({
    id: `${taskId}-s${String(i + 1).padStart(2, "0")}`,
    title,
    done: false,
  }));
}

const at = todayYmd();

/** @type {Array<{ id: string, entityId: string, title: string, note?: string, due?: string, subtasks?: { id: string, title: string, done: boolean }[] }>} */
const BACKLOG = [
  // ── Plural (rove) ──────────────────────────────────────────────
  { id: "seed-rove-01-clients", entityId: "rove", title: "Organizar clients no Painel" },
  { id: "seed-rove-02-netflix", entityId: "rove", title: "Postar sala Netflix" },
  { id: "seed-rove-03-iptv", entityId: "rove", title: "Comprar novo painel IPTV" },
  { id: "seed-rove-04-fluxo-dinheiro", entityId: "rove", title: "Criar fluxo do dinheiro" },
  {
    id: "seed-rove-05-servicos-adicionais",
    entityId: "rove",
    title: "Serviços adicionais nas duas vertentes",
  },
  {
    id: "seed-rove-06-pivot-pagamentos",
    entityId: "rove",
    title: "Pivotar para pagamentos de serviços",
  },
  { id: "seed-rove-07-formas-pagamento", entityId: "rove", title: "Ter formas de pagamentos" },
  {
    id: "seed-rove-08-catalogo",
    entityId: "rove",
    title: "Criar um escopo dos serviços no catálogo",
  },
  {
    id: "seed-rove-09-redes",
    entityId: "rove",
    title: "Organizar Redes Sociais",
    subtasks: subs("seed-rove-09-redes", ["WhatsApp", "Instagram", "TikTok", "Facebook"]),
  },
  {
    id: "seed-rove-10-calendario-suporte",
    entityId: "rove",
    title: "Calendário de suporte",
    note: "Perguntas se está tudo bem?",
  },
  {
    id: "seed-rove-11-automatizar-atendimento",
    entityId: "rove",
    title: "Automatizar o atendimento todo",
  },
  {
    id: "seed-rove-12-servidores-antigos",
    entityId: "rove",
    title: "Pagar servidores antigos por enquanto",
  },

  // ── PDS (cw) ───────────────────────────────────────────────────
  { id: "seed-cw-01-toalhas", entityId: "cw", title: "Trocar toalha das mesas" },
  { id: "seed-cw-02-cadeiras", entityId: "cw", title: "Cadeiras estragadas" },
  { id: "seed-cw-03-tvs", entityId: "cw", title: "Resolver as TVs" },
  {
    id: "seed-cw-04-recursos",
    entityId: "cw",
    title: "Uso dos recursos",
    subtasks: subs("seed-cw-04-recursos", ["Novos Serviços"]),
  },
  {
    id: "seed-cw-05-marketing-presencial",
    entityId: "cw",
    title: "Marketing presencial",
    subtasks: subs("seed-cw-05-marketing-presencial", ["Panfleto na Porta"]),
  },
  {
    id: "seed-cw-06-equipamentos",
    entityId: "cw",
    title: "Equipamentos estragados",
    subtasks: subs("seed-cw-06-equipamentos", ["TVs — arranjar 2", "Impressoras — arranjar 1"]),
  },
  {
    id: "seed-cw-07-manutencoes",
    entityId: "cw",
    title: "Manutenções",
    subtasks: subs("seed-cw-07-manutencoes", [
      "PS3 — todas",
      "PCs — todos os 3",
      "PCs · 1 portátil",
      "PCs · 2 desktops",
    ]),
  },
  {
    id: "seed-cw-08-fluxo-diario",
    entityId: "cw",
    title: "Criar fluxo diário",
    note: "Desenhar o fluxo; depois passar para a aba Rotina.",
    subtasks: subs("seed-cw-08-fluxo-diario", [
      "Arrumar Cyber",
      "Reunião matinal",
      "Estado no meio-dia",
      "Relatório final",
      "Desarrumar Cyber",
    ]),
  },
  { id: "seed-cw-09-kwik", entityId: "cw", title: "Implementar pagamentos KWIK" },
  { id: "seed-cw-10-contrato", entityId: "cw", title: "Formalizar contrato" },
  { id: "seed-cw-11-eliandro", entityId: "cw", title: "Papel do Eliandro dentro da PDS" },
  {
    id: "seed-cw-12-numero-cyber",
    entityId: "cw",
    title: "Número do Cyber",
    subtasks: subs("seed-cw-12-numero-cyber", ["Nº de telemóvel", "WhatsApp Business"]),
  },
  { id: "seed-cw-13-dobradicas", entityId: "cw", title: "Arranjar dobradiças do PC" },
  {
    id: "seed-cw-14-fluxo-dinheiro",
    entityId: "cw",
    title: "Criar fluxo do dinheiro",
    note: "Onde vai depois de entrar?",
  },
  { id: "seed-cw-15-projeccoes", entityId: "cw", title: "Projecções de crescimento" },
  { id: "seed-cw-16-calendario-eventos", entityId: "cw", title: "Calendário de eventos" },
  { id: "seed-cw-17-jogos-pcs", entityId: "cw", title: "Actualizar jogos das PCs" },
  {
    id: "seed-cw-18-seguranca",
    entityId: "cw",
    title: "Melhorar segurança da estrutura do Cyber",
  },
  { id: "seed-cw-19-limpeza", entityId: "cw", title: "Calendário de limpeza e arrumações" },
  {
    id: "seed-cw-20-cyber-online",
    entityId: "cw",
    title: "Cyber online",
    note: "Serviços do Cyber de forma online",
  },
  {
    id: "seed-cw-21-pc-operador",
    entityId: "cw",
    title: "Equipar o PC do operador",
    note: "Modelos de documentos e etc.",
  },
  { id: "seed-cw-22-precario", entityId: "cw", title: "Fazer preçário" },

  // ── Pessoal (Eu) ───────────────────────────────────────────────
  {
    id: "seed-pessoal-tcc",
    entityId: "pessoal",
    title: "TCC · ISPTEC",
    note: [
      "Temas em cima da mesa:",
      "· Sistema Inteligente de Reconhecimento de Gestos",
      "· Reconstrução 3D de Imóveis",
    ].join("\n"),
    subtasks: subs("seed-pessoal-tcc", [
      "Determinar o tema",
      "Determinar mais 3 variantes do tema",
      "Aplicar o que o Prof. Bongo orientou",
      "Bongo · Problema",
      "Bongo · Metodologia",
      "Bongo · Objectivo",
      "Bongo · Cronograma",
      "Bongo · Arquitectura do sistema",
      "Bongo · Plano de avaliação experimental",
      "Pedir matéria aos outros colegas",
    ]),
  },
  {
    id: "seed-pessoal-contactos",
    entityId: "pessoal",
    title: "Contactos das empresas",
    note: [
      "PDS: 944 960 548",
      "Plural: 933 623 143",
      "Picasso's: 944 961 183",
      "Picasso's (alt): 959 417 610",
    ].join("\n"),
  },
  {
    id: "seed-pessoal-livros",
    entityId: "pessoal",
    title: "Livros — até ao fim do ano",
    due: "2026-12-23",
    note: "Prazo: 23 de Dezembro",
    subtasks: subs("seed-pessoal-livros", [
      "O Homem Mais Rico da Babilónia",
      "48 Leis do Poder",
      "Manga — Blue Lock",
    ]),
  },
  {
    id: "seed-pessoal-skills",
    entityId: "pessoal",
    title: "Treinar skills",
    note: "Fazer o documento.",
  },
  {
    id: "seed-pessoal-escuteiros-bt",
    entityId: "pessoal",
    title: "Escuteiros · BT",
    subtasks: subs("seed-pessoal-escuteiros-bt", [
      "Meter a hierarquia a funcionar",
      "Tirar dependência de mim",
      "Criar um programa de actividades",
    ]),
  },
  {
    id: "seed-pessoal-escuteiros-seccao",
    entityId: "pessoal",
    title: "Escuteiros · Secção",
    subtasks: subs("seed-pessoal-escuteiros-seccao", [
      "Programa de formação e actividades",
      "Dedicar-me mais na minha patrulha",
      "Patrulha · Formação escutista",
      "Patrulha · Catequese",
    ]),
  },
];

if (!process.env.TASKS_DATABASE_URL) {
  console.error("TASKS_DATABASE_URL em falta no .env");
  process.exit(1);
}

const sql = getTasksSql();
await ensureTasksSchema(sql);

let ok = 0;
const byEntity = { rove: 0, cw: 0, pessoal: 0 };
let withSubs = 0;

for (const item of BACKLOG) {
  const subtasks = item.subtasks ?? [];
  if (subtasks.length) withSubs += 1;
  await upsertTask(sql, {
    id: item.id,
    entityId: item.entityId,
    title: item.title,
    note: item.note ?? "",
    status: "inbox",
    quadrant: "",
    focusToday: false,
    at,
    due: item.due ?? "",
    timeboxMin: 0,
    dayBlock: "",
    routineId: "",
    subtasks,
  });
  ok += 1;
  byEntity[item.entityId] = (byEntity[item.entityId] ?? 0) + 1;
}

const total = await sql`SELECT count(*)::int AS n FROM ph_tasks`;
const seedCount = await sql`SELECT count(*)::int AS n FROM ph_tasks WHERE id LIKE 'seed-%'`;

console.log("seed_ok", ok);
console.log("com_subtarefas", withSubs);
console.log("por_entidade", byEntity);
console.log("seed_na_bd", seedCount[0]?.n ?? 0);
console.log("tarefas_totais", total[0]?.n ?? 0);
