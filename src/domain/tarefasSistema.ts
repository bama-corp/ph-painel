/** Conteúdo do Sistema PH — síntese prática (não enciclopédia). */

export type MetodoLinha = {
  id: string;
  nome: string;
  como: string;
  uso: string;
  /** Onde usar no painel */
  onde: string;
};

export const METODOS: MetodoLinha[] = [
  {
    id: "gtd",
    nome: "GTD",
    como: "Capturar → esclarecer → organizar → rever → executar.",
    uso: "Ideias e compromissos espalhados.",
    onde: "Revisão do dia e revisão semanal",
  },
  {
    id: "2min",
    nome: "Regra dos 2 min",
    como: "Se leva ≤2 minutos, faz já.",
    uso: "Não acumular micro-pendências.",
    onde: "Bloco «Fazer já» na Revisão",
  },
  {
    id: "8020",
    nome: "80/20",
    como: "Poucas tarefas geram a maior parte do resultado.",
    uso: "Decidir onde investir esforço.",
    onde: "Até 3 «Hoje», ordenadas por impacto",
  },
  {
    id: "timeblock",
    nome: "Time blocking",
    como: "Reserva manhã, tarde ou noite — com faixa de horas.",
    uso: "Proteger foco quando a agenda é interrompida.",
    onde: "Vista Dia",
  },
  {
    id: "eisenhower",
    nome: "Eisenhower",
    como: "Urgente × importante → fazer, agendar, delegar ou eliminar.",
    uso: "Quando tudo parece urgente.",
    onde: "Vista Matriz e cores no Kanban",
  },
  {
    id: "kanban",
    nome: "Kanban",
    como: "Quadro: para fazer → planejar → executar → revisar → ajustar → feito.",
    uso: "Ver o fluxo; arrastar cartões entre colunas.",
    onde: "Vista Kanban (máx. 3 em Executar)",
  },
  {
    id: "timebox",
    nome: "Timeboxing",
    como: "Tempo máximo para a tarefa — no fim paras, prolongas ou marcas feita.",
    uso: "Evitar perfeccionismo em trabalhos longos.",
    onde: "Duração na tarefa e timer de foco",
  },
  {
    id: "pomodoro",
    nome: "Pomodoro",
    como: "25 min foco + 5 pausa; após 4 ciclos, pausa maior.",
    uso: "Começar o difícil ou cortar distrações.",
    onde: "Foco e relógio flutuante",
  },
];

export const COMO_ESCOLHER: { quando: string; metodo: string }[] = [
  { quando: "Tudo parece urgente", metodo: "Eisenhower" },
  { quando: "Muitas ideias e compromissos", metodo: "GTD (caixa de entrada)" },
  { quando: "Procrastinação / falta de foco", metodo: "Pomodoro" },
  { quando: "Agenda cheia de interrupções", metodo: "Time blocking (vista Dia)" },
  { quando: "Projecto com várias etapas", metodo: "Kanban" },
  { quando: "Precisas de resultado, não de volume", metodo: "80/20 + Eisenhower" },
];

export const SISTEMA_PASSOS: string[] = [
  "Abre Revisão: faz já o que for ≤2 min; o resto esclarece.",
  "Marca até 3 «Hoje» (as de maior impacto).",
  "Na vista Dia, encaixa manhã / tarde / noite.",
  "No Calendário, confirma ou arrasta os prazos.",
  "Na Matriz, coloca no quadrante Eisenhower.",
  "Define um timebox e usa o Pomodoro no foco.",
  "Segue no Kanban — sem sobrecarregar Executar.",
];

export const COMBO_PH =
  "No PH: GTD + 2 min na Revisão, 80/20 no «Hoje», Dia para blocos, Calendário para prazos, Eisenhower na Matriz, timebox + Pomodoro no foco, Kanban no quadro.";
