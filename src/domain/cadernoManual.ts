/** Manual / glossário do Caderno — só termos que existem no painel. */

export type ManualTerm = {
  t: string;
  d: string;
};

export type ManualSection = {
  id: string;
  title: string;
  hint?: string;
  terms: ManualTerm[];
};

export const REGRAS: ManualTerm[] = [
  {
    t: "Caixas separadas",
    d: "Pessoal, PDS, Plural, Picasso's e PH não se misturam. Dinheiro da empresa não é teu para gastar.",
  },
  {
    t: "Banco ≠ bolso",
    d: "Contas mostram onde o dinheiro vive. Orçamento dá percentagens e Meter. Definição explica as regras de cada categoria.",
  },
  {
    t: "Toda entrada pessoal tem função",
    d: "Salário, cobranças, o que for próprio. Entra → «Distribuir esta entrada» ou Meter → bolsos. Custódia e empresa fora.",
  },
  {
    t: "Terceiros não são teus",
    d: "Lenu, Eduardo (GTA), etc. são custódia. Estão na liquidez bruta, mas nunca em alocável / gastável / bolsos.",
  },
  {
    t: "Cliente ≠ pagamento",
    d: "Na Plural (e em geral): só conta receita quando o dinheiro entra na caixa — não quando existe um cliente.",
  },
  {
    t: "Tipo certo de movimento",
    d: "Tirar da empresa: investimento, empréstimo, pró-labore, distribuição ou reembolso. Nunca «despesa pessoal» sem nome.",
  },
];

export const DISTINCOES: ManualTerm[] = [
  {
    t: "Bruto ≠ próprio ≠ alocável ≠ gastável ≠ património",
    d: "Estar no banco não autoriza gastar. Só o que está nos bolsos operacional + lazer é gastável no dia a dia.",
  },
  {
    t: "Receita ≠ Meter",
    d: "Receita só credita liquidez. Meter / Distribuir é que mete o dinheiro num bolso.",
  },
  {
    t: "Custódia ≠ dívida tua",
    d: "Custódia é dinheiro de terceiros nas tuas contas. Devolver não é pagar uma dívida própria com o teu saldo.",
  },
  {
    t: "Caixa da empresa ≠ bolso",
    d: "A caixa da empresa entra no património como participação. Não é dinheiro para gastar no pessoal.",
  },
  {
    t: "Planeado ≠ registado",
    d: "Fontes de renda, custos recorrentes e receita declarada são plano. Só o Registo move o ledger.",
  },
  {
    t: "Empréstimo ≠ pró-labore ≠ distribuição ≠ reembolso",
    d: "Cada saída da empresa para ti tem um tipo. Errar o tipo mentirá a conta corrente e o equity.",
  },
];

export const RITMO: ManualTerm[] = [
  {
    t: "Quando entra dinheiro pessoal",
    d: "Registo (receita) → Orçamento (Meter ou partir a entrada pelas regras) → Decisão se houver dúvida.",
  },
  {
    t: "Quando gastas",
    d: "Registo com bolso obrigatório. Se o bolso não chega, não inventas — ajustas ou adias.",
  },
  {
    t: "Uma vez por semana",
    d: "Eu: alertas. Contas: saldos e a receber/pagar. Empresas: caixas ainda tuas? Caderno: o que ficou pendente.",
  },
  {
    t: "Fim do mês",
    d: "Orçamento: gasto por bolso. Registo: tudo classificado. Decisão: o que fazer no mês seguinte.",
  },
];

export const MENUS: { to: string; label: string; d: string }[] = [
  { to: "/", label: "Eu", d: "Visão geral. De quem é o dinheiro, alertas, património e fluxo." },
  { to: "/definicao", label: "Definição", d: "Regras de vida financeira e métodos de divisão das %." },
  { to: "/orcamento", label: "Orçamento", d: "Fontes, % dos bolsos, inventário (renda, luz…) e Meter." },
  { to: "/contas", label: "Contas", d: "Bancos, teu vs custódia, a receber, a pagar, Devolver." },
  { to: "/pds", label: "PDS", d: "Caixa PADStation, categorias de serviço, custos e equity." },
  { to: "/plural", label: "Plural", d: "MRR, clientes, custos por produto e margem." },
  { to: "/picasso", label: "Picasso's", d: "Caixa, custos planeados e equity." },
  { to: "/ph", label: "PH", d: "Caixa, custos planeados e equity." },
  { to: "/movimentos", label: "Registo", d: "Ledger — tudo o que aconteceu." },
  { to: "/decisao", label: "Decisão", d: "O que fazer agora com o dinheiro." },
  { to: "/caderno", label: "Caderno", d: "Este manual + as tuas notas." },
];

export const GLOSSARIO: ManualSection[] = [
  {
    id: "mapa",
    title: "Mapa do painel",
    hint: "Onde cada ideia vive.",
    terms: [
      {
        t: "Painel / PH",
        d: "Consolida pessoal e quatro empresas sem misturar caixas. Um mês activo de cada vez.",
      },
      {
        t: "Eu",
        d: "Página inicial: de quem é o dinheiro, alertas, património e fluxo do mês.",
      },
      {
        t: "Cinco caixas",
        d: "Pessoal + PDS + Plural + Picasso's + PH. Cada uma tem o seu ledger.",
      },
      {
        t: "Entidade",
        d: "Caixa a que um movimento, conta ou party pertence (pessoal ou uma empresa).",
      },
      {
        t: "Pessoal",
        d: "Vida privada: bancos, bolsos, dívidas próprias e custódia de terceiros.",
      },
      {
        t: "PDS (PADStation)",
        d: "Empresa independente. A caixa dela não é tua para gastar.",
      },
      {
        t: "Plural",
        d: "Empresa de subscrições (Netflix / IPTV). Cliente ≠ pagamento.",
      },
      {
        t: "Picasso's / PH",
        d: "Empresas independentes. Mesma regra: caixa ≠ gasto pessoal.",
      },
      {
        t: "Definição",
        d: "Regras de funcionamento e métodos (50/30/20, Bolsos PH, etc.).",
      },
      {
        t: "Orçamento",
        d: "Planeamento: fontes, percentagens, linhas (renda, luz…) e Meter.",
      },
      {
        t: "Contas",
        d: "Onde o dinheiro vive (liquidez) e parties a receber / pagar / custódia.",
      },
      {
        t: "Registo",
        d: "Ledger do que aconteceu. Sem isto, o resto mente.",
      },
      {
        t: "Decisão",
        d: "Fila do que fazer agora — perguntas e respostas do sistema.",
      },
      {
        t: "Assistente",
        d: "Chat no canto: propõe movimentos a partir de frases do dia; tu confirmas antes de gravar.",
      },
      {
        t: "Caderno",
        d: "Manual de aprendizagem + notas tuas. Export / import JSON.",
      },
      {
        t: "Mês",
        d: "Período activo do painel (filtro de receitas, despesas e fluxo).",
      },
      {
        t: "Repor seed",
        d: "Volta ao snapshot inicial e actualiza a BD. Apaga os dados deste browser — exporta antes se precisares.",
      },
      {
        t: "Neon · sync",
        d: "Estado da sincronização com a base remota (a gravar, offline, erro).",
      },
      {
        t: "Kz",
        d: "Moeda do painel (kwanza).",
      },
    ],
  },
  {
    id: "liquidez",
    title: "Contas e liquidez",
    hint: "Onde o dinheiro vive — não para que serve.",
    terms: [
      {
        t: "Liquidez",
        d: "Dinheiro nas contas (banco, caixa, cofre, stand) = opening + movimentos.",
      },
      {
        t: "Conta de liquidez",
        d: "Sítio físico onde o dinheiro está (ex. BAI, Caixa PDS, ATLANTICO).",
      },
      {
        t: "Banco / Caixa / Cofre / Stand",
        d: "Tipos de conta de liquidez.",
      },
      {
        t: "Opening",
        d: "Saldo inicial da conta ou party. Editável só enquanto não houver movimentos no ledger.",
      },
      {
        t: "Liquidez bruta",
        d: "Soma das contas pessoais, incluindo custódia misturada nos bancos.",
      },
      {
        t: "Teu (próprio)",
        d: "Fatia tua numa conta ou no total = bruto − custódia marcada nessa conta.",
      },
      {
        t: "Custódia (na conta)",
        d: "Dinheiro de terceiros que está fisicamente nessa conta. Não é teu nem gastável.",
      },
      {
        t: "Total (por conta)",
        d: "Saldo vivo da conta = teu + custódia nessa conta.",
      },
      {
        t: "Alocável",
        d: "Capital pessoal próprio ainda sem bolso (= liquidez própria − o que já está nos bolsos).",
      },
      {
        t: "Nos bolsos",
        d: "Capital pessoal já atribuído a envelopes (funções).",
      },
      {
        t: "Gastável",
        d: "Só o que está nos bolsos operacional + lazer. Reserva e investimento não entram.",
      },
      {
        t: "Investível / Reservado",
        d: "Saldos dos bolsos investimento e reserva — não gastáveis no quotidiano.",
      },
      {
        t: "Disponível ≠ gastável",
        d: "Ter dinheiro no banco ou património não autoriza gastar.",
      },
      {
        t: "Caixa (empresa)",
        d: "Liquidez total de uma empresa.",
      },
      {
        t: "Por classificar (conta)",
        d: "Conta com saldo ainda sem destino claro — gera alerta no Eu.",
      },
      {
        t: "Ajuste auditado",
        d: "Movimento que corrige o saldo vivo sem alterar o opening (mundo ↔ liquidez).",
      },
      {
        t: "Mundo",
        d: "Extremo «fora do sistema»: entrada/saída do mundo ou ajuste.",
      },
    ],
  },
  {
    id: "parties",
    title: "Parties, dívidas e ownership",
    hint: "Pessoas e relações — não são contas bancárias.",
    terms: [
      {
        t: "Party",
        d: "Pessoa ou relação com saldo a receber ou a pagar.",
      },
      {
        t: "A receber",
        d: "Quem te deve (ou à empresa). Cobrança traz dinheiro para a liquidez.",
      },
      {
        t: "A pagar / dívida própria",
        d: "O que tu (ou a empresa) deves. Pagamento sai da liquidez e reduz a party.",
      },
      {
        t: "Próprio (ownership)",
        d: "Relação tua — dívida ou crédito pessoal.",
      },
      {
        t: "Custódia (ownership)",
        d: "Dinheiro de terceiros nas tuas contas. Devolver ≠ pagar dívida própria.",
      },
      {
        t: "Empresa (ownership)",
        d: "Relação empresa ↔ proprietário (ex. conta corrente).",
      },
      {
        t: "Conta corrente do proprietário",
        d: "O que o dono deve à empresa (ex. PDS). Reembolso ≠ pró-labore.",
      },
      {
        t: "Devolver",
        d: "Liberta custódia: sai da conta marcada; o «teu» nessa conta mantém-se.",
      },
      {
        t: "Pagar",
        d: "Pagamento atómico a party a pagar (dívida própria).",
      },
      {
        t: "Cobrar",
        d: "Cobrança atómica: party a receber → liquidez.",
      },
      {
        t: "Conta da custódia",
        d: "Conta de liquidez onde o dinheiro do terceiro está fisicamente marcado.",
      },
      {
        t: "Unknown",
        d: "Party a pagar sem valor definido — alerta: nomes sem montante.",
      },
    ],
  },
  {
    id: "bolsos",
    title: "Bolsos e orçamento",
    hint: "Para que serve o dinheiro — não onde vive.",
    terms: [
      {
        t: "Bolso / envelope",
        d: "Função do dinheiro pessoal. Despesa pessoal exige bolso com saldo.",
      },
      {
        t: "Operacional",
        d: "Bolso do dia a dia. Na distribuição automática recebe obrigações + despesas.",
      },
      {
        t: "Reserva",
        d: "Emergência — não se usa no quotidiano.",
      },
      {
        t: "Investimento (bolso)",
        d: "Construção de património. De onde sai o investimento do proprietário nas empresas.",
      },
      {
        t: "Lazer",
        d: "Gastável «sem culpa» até ao saldo deste bolso.",
      },
      {
        t: "Projectos",
        d: "Dinheiro pessoal metido num projecto. Só por Meter manual — não entra na distribuição automática.",
      },
      {
        t: "Meter",
        d: "Meter Kz de alocável num bolso concreto.",
      },
      {
        t: "Alocação (bolso)",
        d: "Movimento que move capital sem função → envelope. Só via Meter / Distribuir.",
      },
      {
        t: "Fontes de renda",
        d: "Planeamento mensal (ex. Salário GSA). Não move dinheiro.",
      },
      {
        t: "Renda planeada",
        d: "Soma das fontes activas — base dos tectos das percentagens.",
      },
      {
        t: "Percentagens dos bolsos",
        d: "Regras: obrigações, reserva, investimento, despesas, lazer (soma = 100%).",
      },
      {
        t: "Obrigações / Reserva / Investimento / Despesas / Lazer (%)",
        d: "Categorias orçamentárias. Obrigações + despesas → operacional na distribuição.",
      },
      {
        t: "Linha orçamentária",
        d: "Inventário concreto (renda, luz…) dentro de uma %. Não move dinheiro.",
      },
      {
        t: "Tecto",
        d: "Limite da categoria = % × renda planeada.",
      },
      {
        t: "Distribuir esta entrada",
        d: "Parte um valor de entrada (≤ alocável) pelas regras — não o stock inteiro.",
      },
      {
        t: "Método de divisão",
        d: "Preset das %: 50/30/20, 60/20/20, Bolsos PH, personalizado…",
      },
      {
        t: "Necessidades / Lazer·estilo / Futuro",
        d: "Linguagem dos métodos na Definição — agrupa as cinco categorias.",
      },
      {
        t: "Banco ≠ bolso",
        d: "Contas = onde vive. Bolsos = função.",
      },
    ],
  },
  {
    id: "movimentos",
    title: "Movimentos (tipos)",
    hint: "O tipo certo evita mentir à conta corrente e ao equity.",
    terms: [
      {
        t: "Movimento / registo",
        d: "Facto no ledger: valor, data, de/para, entidade, tipo.",
      },
      {
        t: "Receita",
        d: "Entrada na liquidez da entidade. Não aloca a bolsos.",
      },
      {
        t: "Despesa",
        d: "Saída. No pessoal exige bolso com saldo suficiente.",
      },
      {
        t: "Transferência",
        d: "Entre duas contas de liquidez da mesma entidade.",
      },
      {
        t: "Transferência interempresarial",
        d: "Entre contas de entidades diferentes.",
      },
      {
        t: "Investimento do proprietário",
        d: "Pessoal → empresa. Sai do bolso investimento.",
      },
      {
        t: "Empréstimo ao proprietário",
        d: "Empresa → pessoal. Sobe a conta corrente (deves à empresa).",
      },
      {
        t: "Pró-labore",
        d: "Retirada como remuneração do dono (empresa → pessoal).",
      },
      {
        t: "Distribuição de lucro",
        d: "Empresa → pessoal como distribuição de lucro.",
      },
      {
        t: "Reembolso da conta corrente",
        d: "Devolver o que deves à empresa (reduz C/C).",
      },
      {
        t: "Despesa pessoal paga pela empresa",
        d: "Empresa paga algo teu — aumenta o que deves à empresa.",
      },
      {
        t: "Pagamento a party",
        d: "Liquidez → party a pagar (atómico).",
      },
      {
        t: "Cobrança de party",
        d: "Party a receber → liquidez (atómico).",
      },
      {
        t: "De / Para",
        d: "Extremos do movimento (conta, party, mundo…).",
      },
      {
        t: "Serviço (PDS)",
        d: "Categoria da receita: jogos, impressões, cópias, trabalhos, manutenção, outros, por classificar.",
      },
      {
        t: "Natureza (custo)",
        d: "Fixo / variável / investimento / retirada — classificação de custos.",
      },
      {
        t: "Ledger",
        d: "Livro de movimentos persistido. O Assistente grava aqui depois de confirmares.",
      },
    ],
  },
  {
    id: "patrimonio",
    title: "Património, fluxo e métricas",
    hint: "O que o Eu resume.",
    terms: [
      {
        t: "Património líquido",
        d: "Próprio + bens + participações + a receber − dívidas próprias − C/C à empresa. Custódia fora.",
      },
      {
        t: "Dinheiro (no património)",
        d: "Liquidez bruta pessoal (a linha «dinheiro» pode incluir custódia; o líquido usa o próprio).",
      },
      {
        t: "Bens / activos",
        d: "Itens com valor declarado (PS5, TV, equipamentos…).",
      },
      {
        t: "Participações nas empresas",
        d: "Soma do equity das quatro empresas.",
      },
      {
        t: "Posição",
        d: "Teu + a receber − dívida própria (visão rápida).",
      },
      {
        t: "Equity",
        d: "Caixa + a receber − a pagar + bens da entidade.",
      },
      {
        t: "Fluxo (mês)",
        d: "Movimentos reais do mês — não o salário declarado.",
      },
      {
        t: "Entradas reais",
        d: "Receitas pessoais registadas no mês.",
      },
      {
        t: "Receita mês / Lucro mês",
        d: "Receitas − (despesas + pró-labore) no mês, por entidade.",
      },
      {
        t: "Lucro registado",
        d: "Lucro só com movimentos já no ledger.",
      },
      {
        t: "Lucro esperado",
        d: "Receita − max(despesas registadas, custos planeados).",
      },
      {
        t: "Custos planeados / recorrentes",
        d: "Inventário mensal do que a empresa deve pagar. Não move caixa até registares.",
      },
      {
        t: "Por registar",
        d: "Diferença planeado > registado ainda em falta.",
      },
      {
        t: "Receita / lucro declarados",
        d: "Valores de referência. Não substituem o ledger.",
      },
      {
        t: "Salário declarado",
        d: "Espelho da renda planeada — referência, não entradas reais.",
      },
      {
        t: "Alertas",
        d: "Avisos do sistema (alocável, C/C, atraso Plural, etc.).",
      },
    ],
  },
  {
    id: "empresas",
    title: "Empresas",
    hint: "Caixa independente — tipo certo para tirar dinheiro.",
    terms: [
      {
        t: "Empresa independente",
        d: "A caixa dela não é tua. Tirar dinheiro exige o tipo certo de movimento.",
      },
      {
        t: "Custos recorrentes",
        d: "Lista planeada (activo/inactivo, natureza, opcionalmente produto).",
      },
      {
        t: "Custos registados no mês",
        d: "Despesas/retiradas já no ledger, agregadas por natureza.",
      },
      {
        t: "De onde vem a receita (PDS)",
        d: "Breakdown por serviço / categoria.",
      },
      {
        t: "Por classificar (serviço)",
        d: "Receita ainda sem categoria de serviço.",
      },
      {
        t: "Activo (checkbox)",
        d: "Linha de custo, fonte ou orçamento que entra no planeamento.",
      },
    ],
  },
  {
    id: "plural",
    title: "Plural (clientes e MRR)",
    hint: "Recorrência. Cliente não é pagamento.",
    terms: [
      {
        t: "Cliente",
        d: "Assinante Netflix/IPTV. Ter cliente não é receita até pagar.",
      },
      {
        t: "Plano / produto",
        d: "Netflix ou IPTV (ou «Geral Plural» em custos).",
      },
      {
        t: "Preço",
        d: "Mensalidade do cliente.",
      },
      {
        t: "Vencimento",
        d: "Quando deve pagar (dia / próxima data).",
      },
      {
        t: "Ativo",
        d: "Cliente em dia.",
      },
      {
        t: "Vence em breve",
        d: "Vence em ≤ 3 dias.",
      },
      {
        t: "Em atraso",
        d: "Passou a data de pagamento.",
      },
      {
        t: "Suspenso / Cancelado / Potencial",
        d: "Fora da faturação activa, ou prospecto.",
      },
      {
        t: "MRR",
        d: "Soma dos preços dos clientes activos / atraso / suspenso (exclui potencial e cancelado).",
      },
      {
        t: "Margem por cliente",
        d: "Receita média − custo partilhado por cliente.",
      },
      {
        t: "Cliente ≠ pagamento",
        d: "Só conta quando o dinheiro entra na caixa.",
      },
    ],
  },
  {
    id: "definicao",
    title: "Definição (regras de vida)",
    hint: "Hábitos descritos na página Definição — não são tipos de movimento.",
    terms: [
      {
        t: "Entrada",
        d: "Registo imediato, renda líquida, diversificação, aumento proporcional.",
      },
      {
        t: "Obrigações (regras)",
        d: "Regra dos 50%, tecto de moradia, quitação prioritária, revisão trimestral.",
      },
      {
        t: "Reserva (regras)",
        d: "3–6 meses, intocabilidade, liquidez da reserva, reposição imediata.",
      },
      {
        t: "Investimento (regras)",
        d: "Regra dos 20%, automático, consistência, alinhamento, diversificação.",
      },
      {
        t: "Despesas (regras)",
        d: "Registo diário, categorização, regra das 24 horas, limite e revisão semanal.",
      },
      {
        t: "Lazer (regras)",
        d: "Regra dos 30%, orçamento de diversão, lazer planeado, equilíbrio.",
      },
      {
        t: "Complementares",
        d: "Diagnóstico, metas SMART, reunião de orçamento, fundo longo prazo, educação, progresso, ajuste.",
      },
      {
        t: "Metas SMART",
        d: "Específicas, mensuráveis, atingíveis, relevantes, com tempo — regista-as nas notas do Caderno.",
      },
      {
        t: "Acumulação",
        d: "Progressivo / fixo / arredondamento — hábitos de guardar (não são movimentos).",
      },
    ],
  },
];
