import type { Weekday } from "./routines";
import { WEEKDAYS, isoWeekday, todayYmd } from "./routines";

export type PostPlatform = "linkedin" | "instagram" | "whatsapp" | "github" | "youtube";

export type PostSlotItem = {
  platform: PostPlatform;
  /** O que publicar nesta rede neste dia */
  format: string;
  optional?: boolean;
};

export type PostDayPlan = {
  weekday: Weekday;
  /** HH:mm — hora de Luanda (UTC+1) */
  time: string;
  theme: string;
  slots: PostSlotItem[];
};

export type ContentPillar = {
  id: string;
  pct: number;
  title: string;
  themes: string;
  example: string;
};

export type PlatformMeta = {
  id: PostPlatform;
  label: string;
  priority: "alta" | "media" | "baixa";
  objective: string;
  frequency: string;
};

export const POST_PLATFORM_LABEL: Record<PostPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  github: "GitHub",
  youtube: "YouTube Shorts",
};

export const POST_PLATFORMS: PlatformMeta[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    priority: "alta",
    objective: "Emprego, recrutadores e networking profissional.",
    frequency: "3–4 publicações / semana",
  },
  {
    id: "instagram",
    label: "Instagram",
    priority: "alta",
    objective: "Portefólio visual e identidade pessoal.",
    frequency: "2 feed/Reels + Stories 4–6 dias",
  },
  {
    id: "whatsapp",
    label: "Estados WhatsApp",
    priority: "alta",
    objective: "Confiança, recomendações e contactos directos.",
    frequency: "1–3 Estados / dia (quando relevante)",
  },
  {
    id: "github",
    label: "GitHub",
    priority: "media",
    objective: "Prova técnica — projectos e README claros.",
    frequency: "1 melhoria documentada / semana",
  },
  {
    id: "youtube",
    label: "YouTube Shorts",
    priority: "baixa",
    objective: "Conteúdo técnico pesquisável (reaproveitar Reels).",
    frequency: "1 vídeo / semana",
  },
];

/** Calendário semanal de publicações — marca pessoal. */
export const WEEKLY_POST_PLAN: PostDayPlan[] = [
  {
    weekday: 0,
    time: "08:00",
    theme: "Posicionamento profissional",
    slots: [
      {
        platform: "linkedin",
        format: "Percurso em tecnologia e problemas que queres resolver",
      },
      {
        platform: "instagram",
        format: "Story com os objectivos profissionais da semana",
      },
      {
        platform: "whatsapp",
        format: "Foco, trabalho e aprendizagem da semana",
      },
    ],
  },
  {
    weekday: 1,
    time: "12:30",
    theme: "Conhecimento técnico",
    slots: [
      {
        platform: "linkedin",
        format: "Dica de programação, APIs, SQL, arquitectura ou boas práticas",
      },
      {
        platform: "instagram",
        format: "Carrossel com 3–5 dicas técnicas",
      },
      {
        platform: "whatsapp",
        format: "Partilha visual de uma das dicas",
      },
    ],
  },
  {
    weekday: 2,
    time: "18:30",
    theme: "Projecto em destaque",
    slots: [
      {
        platform: "linkedin",
        format: "Projecto, funcionalidade ou problema resolvido",
      },
      {
        platform: "instagram",
        format: "Reel de 20–45 s a demonstrar interface ou aplicação",
      },
      {
        platform: "whatsapp",
        format: "Vídeo curto do projecto com uma frase explicativa",
      },
    ],
  },
  {
    weekday: 3,
    time: "12:30",
    theme: "IA e inovação",
    slots: [
      {
        platform: "linkedin",
        format: "Opinião fundamentada sobre IA aplicada ao desenvolvimento",
      },
      {
        platform: "instagram",
        format: "Stories com ferramenta, experiência ou sondagem sobre IA",
      },
      {
        platform: "whatsapp",
        format: "Dica útil de uma ferramenta tecnológica",
      },
    ],
  },
  {
    weekday: 4,
    time: "08:00",
    theme: "Carreira e networking",
    slots: [
      {
        platform: "linkedin",
        format: "Aprendizagem da semana ou reflexão profissional",
      },
      {
        platform: "instagram",
        format: "Story com progresso e aprendizagem",
      },
      {
        platform: "whatsapp",
        format: "Actualização profissional ou disponibilidade para projectos",
      },
    ],
  },
  {
    weekday: 5,
    time: "11:00",
    theme: "Bastidores e criatividade",
    slots: [
      {
        platform: "linkedin",
        format: "Lição de um projecto ou do lado empresarial da tecnologia",
        optional: true,
      },
      {
        platform: "instagram",
        format: "Reel ou Story de bastidores, design, protótipo ou estudo",
      },
      {
        platform: "whatsapp",
        format: "Resultado concreto da semana",
      },
    ],
  },
  {
    weekday: 6,
    time: "18:00",
    theme: "Revisão e preparação",
    slots: [
      {
        platform: "linkedin",
        format: "Descanso de publicações ou reflexão relevante",
        optional: true,
      },
      {
        platform: "instagram",
        format: "Pergunta à audiência e preparação da semana",
      },
      {
        platform: "whatsapp",
        format: "Aprendizagem ou objectivo da próxima semana",
      },
    ],
  },
];

export const CONTENT_PILLARS: ContentPillar[] = [
  {
    id: "software",
    pct: 40,
    title: "Desenvolvimento de software",
    themes: "APIs, bases de dados, dashboards, aplicações, Git, arquitectura.",
    example: "3 decisões que tomei ao estruturar uma API para uma aplicação empresarial.",
  },
  {
    id: "ia",
    pct: 20,
    title: "IA e inovação",
    themes: "Experimentação com IA, automação, ferramentas e provas de conceito.",
    example: "Como usaria IA para reduzir uma tarefa manual numa empresa.",
  },
  {
    id: "uiux",
    pct: 15,
    title: "UI/UX e design tecnológico",
    themes: "Interfaces, protótipos, identidade visual e experiência do utilizador.",
    example: "Antes e depois: como tornaria este dashboard mais fácil de utilizar.",
  },
  {
    id: "negocio",
    pct: 15,
    title: "Tecnologia e negócios",
    themes: "Produtos digitais, clientes, empreendedorismo e transformação em Angola.",
    example: "Uma boa aplicação não resolve um problema se ninguém conseguir utilizá-la.",
  },
  {
    id: "percurso",
    pct: 10,
    title: "Percurso e aprendizagem",
    themes: "Evolução profissional, ISPTEC, desafios reais e objectivos.",
    example: "O que estou a aprender enquanto termino a licenciatura e trabalho em tecnologia.",
  },
];

/** Modelos concretos dos primeiros sete dias (reutilizáveis por weekday). */
export type DayTemplate = {
  weekday: Weekday;
  platform: PostPlatform;
  title: string;
  body: string;
  checklist?: string[];
};

export const DAY_TEMPLATES: DayTemplate[] = [
  {
    weekday: 0,
    platform: "linkedin",
    title: "Posicionamento profissional",
    body: `A tecnologia, para mim, vai muito além de escrever código.

É sobre compreender problemas, desenhar soluções e transformar ideias em ferramentas que criam valor para pessoas e empresas.

Tenho desenvolvido a minha experiência na intersecção entre desenvolvimento de software, interfaces digitais e tecnologia aplicada aos negócios, enquanto concluo a minha formação em Engenharia Informática no ISPTEC.

O meu foco é continuar a evoluir como profissional, explorar novas soluções com inteligência artificial e participar em projectos tecnológicos cada vez mais desafiantes.

Acredito que os melhores profissionais não param de aprender e que os melhores produtos começam por compreender bem o problema.

É esse o caminho que estou a construir.

#Tecnologia #DesenvolvimentoDeSoftware #Angola`,
  },
  {
    weekday: 1,
    platform: "instagram",
    title: "Carrossel: 5 práticas que tornam um projecto mais organizado",
    body: "Capa com título forte → pastas e módulos → Git correcto → separação de responsabilidades → documentação e erros → pergunta final à audiência.",
    checklist: [
      "Capa com um título forte",
      "Organização clara de pastas e módulos",
      "Utilização correcta do Git",
      "Separação de responsabilidades",
      "Documentação e tratamento de erros",
      "Último slide: pergunta à audiência",
    ],
  },
  {
    weekday: 2,
    platform: "instagram",
    title: "Demonstrar trabalho (Reel + WhatsApp)",
    body: "Gravar o ecrã a mostrar uma funcionalidade real. Legendas: problema → solução → tecnologia.\n\nTexto WhatsApp sugerido:\n«A trabalhar em soluções digitais que simplificam processos e melhoram a experiência dos utilizadores.»",
  },
  {
    weekday: 3,
    platform: "linkedin",
    title: "IA aplicada aos negócios",
    body: "Reflexão curta sobre uma tarefa empresarial que poderia ser automatizada com IA. Preferir uma pequena experiência própria em vez de repetir notícias.",
  },
  {
    weekday: 4,
    platform: "linkedin",
    title: "Aprendizagem da semana",
    body: "Partilhar um erro, dificuldade ou descoberta técnica e explicar o que foi aprendido. Experiência concreta > motivação genérica.",
  },
  {
    weekday: 5,
    platform: "instagram",
    title: "Reel de bastidores",
    body: "Ambiente de trabalho, protótipo, detalhe de interface ou demo curta. Mensagem clara nos primeiros segundos.",
  },
  {
    weekday: 6,
    platform: "instagram",
    title: "Preparar a semana seguinte",
    body: "Dia de revisão — não é obrigatório publicar.",
    checklist: [
      "Escolher três ideias de publicação",
      "Preparar os textos",
      "Reunir capturas de ecrã",
      "Gravar um vídeo curto",
      "Ver quais publicações geraram mais interacções",
    ],
  },
];

export const POSITIONING =
  "Profissional de tecnologia que transforma problemas em soluções digitais, unindo desenvolvimento de software, experiência do utilizador e inteligência artificial.";

export const POSTING_STORAGE_KEY = "ph-postagem-done-v1";

export function planForWeekday(weekday: Weekday): PostDayPlan {
  return WEEKLY_POST_PLAN.find((p) => p.weekday === weekday)!;
}

export function templateForWeekday(weekday: Weekday): DayTemplate | undefined {
  return DAY_TEMPLATES.find((t) => t.weekday === weekday);
}

/** Segunda-feira (ISO) da semana que contém `ymd` (YYYY-MM-DD). */
export function mondayOfWeek(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = isoWeekday(dt);
  dt.setDate(dt.getDate() - wd);
  return todayYmd(dt);
}

export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayYmd(dt);
}

export function weekDatesFromMonday(monday: string): { weekday: Weekday; ymd: string }[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    ymd: addDaysYmd(monday, weekday),
  }));
}

export function doneKey(ymd: string, platform: PostPlatform): string {
  return `${ymd}:${platform}`;
}

export function loadPostingDone(): Set<string> {
  try {
    const raw = localStorage.getItem(POSTING_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function savePostingDone(set: Set<string>) {
  localStorage.setItem(POSTING_STORAGE_KEY, JSON.stringify([...set]));
}

export function togglePostingDone(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  savePostingDone(next);
  return next;
}
