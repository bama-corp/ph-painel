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
    d: "Bruto = o que está nos bancos (pode incluir custódia). Próprio = bruto − custódia. Alocável = próprio ainda sem bolso. Gastável = só operacional + lazer. Património = visão longa (bens, empresas, dívidas). Ter dinheiro no banco não autoriza gastar.",
  },
  {
    t: "Receita ≠ Meter",
    d: "Receita só credita liquidez na conta. Meter / «Distribuir esta entrada» é que mete o dinheiro num bolso. Sem Meter, o dinheiro fica alocável e os bolsos não sobem.",
  },
  {
    t: "Custódia ≠ dívida tua",
    d: "Custódia é dinheiro de terceiros (Lenu, Eduardo…) que está nas tuas contas. Conta no bruto, mas não é teu nem gastável. Devolver sai da conta marcada; não mistures com pagar Tuni ou tirar da PDS.",
  },
  {
    t: "Caixa da empresa ≠ bolso",
    d: "A caixa da PDS/Plural/Picasso's/PH entra no património como participação. Não é bolso pessoal. Para tirar dinheiro usa o tipo certo: pró-labore, empréstimo, distribuição, reembolso ou investimento.",
  },
  {
    t: "Planeado ≠ registado",
    d: "Fontes de renda, custos recorrentes e receita declarada são plano (orçamento / empresas). Só o Registo (ledger) move caixa. Lucro esperado usa o planeado; lucro registado usa só movimentos.",
  },
  {
    t: "Empréstimo ≠ pró-labore ≠ distribuição ≠ reembolso",
    d: "Empréstimo: empresa → ti e sobe a conta corrente (deves à empresa). Pró-labore: remuneração do dono (não sobe C/C como dívida de empréstimo). Distribuição: parte do lucro. Reembolso: tu → empresa a pagar o que devias. Errar o tipo mente equity e C/C.",
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
        d: "Dinheiro de terceiros fisicamente nessa conta (ex. Lenu no ATLANTICO). Está no total/bruto, mas o «teu» = total − custódia. Nunca Meter custódia para bolsos. Para libertar: Devolver / pagamento à party de custódia.",
      },
      {
        t: "Total (por conta)",
        d: "Saldo vivo da conta = teu + custódia nessa conta.",
      },
      {
        t: "Alocável",
        d: "Capital pessoal próprio ainda sem bolso (= liquidez própria − o que já está nos bolsos). É o que podes Meter ou Distribuir. Se alocável sobe e não ages, o Orçamento fica desactualizado face ao banco.",
      },
      {
        t: "Nos bolsos",
        d: "Capital pessoal já atribuído a envelopes (funções).",
      },
      {
        t: "Gastável",
        d: "Só o que está nos bolsos operacional + lazer. Reserva e investimento não entram no dia a dia — mesmo que o banco tenha saldo.",
      },
      {
        t: "Investível / Reservado",
        d: "Saldos dos bolsos investimento e reserva — não gastáveis no quotidiano.",
      },
      {
        t: "Disponível ≠ gastável",
        d: "Ter dinheiro no banco ou património não autoriza gastar. Gastável = bolsos certos com saldo.",
      },
      {
        t: "Caixa (empresa)",
        d: "Liquidez total de uma empresa. Independente do teu bolso pessoal.",
      },
      {
        t: "Por classificar (conta)",
        d: "Conta com saldo ainda sem destino claro — gera alerta no Eu.",
      },
      {
        t: "Ajuste auditado",
        d: "Movimento que corrige o saldo vivo sem alterar o opening (mundo ↔ liquidez). Usa quando o banco real ≠ painel e já há movimentos (opening bloqueado).",
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
        d: "Pessoa ou relação com saldo a receber ou a pagar. Não é conta bancária.",
      },
      {
        t: "A receber",
        d: "Quem te deve (ou à empresa). Cobrança traz dinheiro para a liquidez.",
      },
      {
        t: "A pagar / dívida própria",
        d: "O que tu (ou a empresa) deves. Pagamento sai da liquidez e reduz a party. Diferente de custódia.",
      },
      {
        t: "Próprio (ownership)",
        d: "Relação tua — dívida ou crédito pessoal.",
      },
      {
        t: "Custódia (ownership)",
        d: "Dinheiro de terceiros nas tuas contas. Ownership «custody». Devolver ≠ pagar dívida própria com o teu saldo gastável.",
      },
      {
        t: "Empresa (ownership)",
        d: "Relação empresa ↔ proprietário (ex. conta corrente).",
      },
      {
        t: "Conta corrente do proprietário",
        d: "O que o dono deve à empresa (ex. PDS). Sobe com empréstimo ao proprietário ou despesa pessoal pela empresa. Desce com reembolso. Reembolso ≠ pró-labore.",
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
        d: "Conta de liquidez onde o dinheiro do terceiro está fisicamente marcado (heldInAccount).",
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
        d: "Função do dinheiro pessoal (operacional, reserva, investimento, lazer, projectos). Despesa pessoal exige bolso com saldo. Banco ≠ bolso.",
      },
      {
        t: "Operacional",
        d: "Bolso do dia a dia. Na distribuição automática recebe obrigações + despesas.",
      },
      {
        t: "Reserva",
        d: "Emergência — não se usa no quotidiano. Intocável até crise real.",
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
        d: "Meter Kz de alocável num bolso concreto. É o passo depois da receita. Sem Meter, alocável acumula e os bolsos mentem.",
      },
      {
        t: "Alocação (bolso)",
        d: "Movimento que move capital sem função → envelope. Só via Meter / Distribuir.",
      },
      {
        t: "Fontes de renda",
        d: "Planeamento mensal (ex. Salário GSA). Não move dinheiro — só define a base dos tectos das %.",
      },
      {
        t: "Renda planeada",
        d: "Soma das fontes activas — base dos tectos das percentagens.",
      },
      {
        t: "Percentagens dos bolsos",
        d: "Regras: obrigações, reserva, investimento, despesas, lazer (soma = 100%). Vêm do método (50/30/20, Bolsos PH…) ou personalizado.",
      },
      {
        t: "Obrigações / Reserva / Investimento / Despesas / Lazer (%)",
        d: "Categorias orçamentárias. Obrigações + despesas → operacional na distribuição.",
      },
      {
        t: "Linha orçamentária",
        d: "Inventário concreto (renda, luz…) dentro de uma %. Não move dinheiro — mostra se o tecto chega.",
      },
      {
        t: "Tecto",
        d: "Limite da categoria = % × renda planeada.",
      },
      {
        t: "Distribuir esta entrada",
        d: "Parte um valor de entrada (≤ alocável) pelas regras — não o stock inteiro. Ideal quando acaba de entrar salário/cobrança.",
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
        d: "Contas = onde vive. Bolsos = função. Podes ter 100 mil no BAI e 0 gastável se nada estiver nos bolsos certos.",
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
        d: "Empresa → pessoal. A empresa empresta-te dinheiro: sobe a conta corrente (deves à empresa). Não é pró-labore. Quando devolveres, usa reembolso — não «investimento» nem despesa.",
      },
      {
        t: "Pró-labore",
        d: "Remuneração do dono: empresa → pessoal.\n\nÉ o teu «ordenado» pela empresa — não um empréstimo.\nEntra na liquidez pessoal; depois usa Meter / Distribuir nos bolsos.\nNo lucro do mês da empresa, conta como saída.",
      },
      {
        t: "Como calcular um pró-labore",
        d: "1. Olha a caixa e o lucro da empresa (PDS / Plural / …) — não tires o que a operação precisa.\n2. Define um valor mensal fixo ou % do lucro registado, sustentável sem esvaziar a caixa.\n3. No Registo: movimento «pró-labore», da conta da empresa para a tua (BAI / caixa).\n4. No pessoal: Meter ou «Distribuir esta entrada» para os bolsos.\n5. Não uses pró-labore para devolver dinheiro à empresa (isso é reembolso) nem para custódia.\n\nRegra rápida:\n· Empresa te remunera → pró-labore\n· Tu deves à empresa → reembolso\n· Adiantamento a devolver → empréstimo",
      },
      {
        t: "Distribuição de lucro",
        d: "Empresa → pessoal como partilha de lucro (depois de haver lucro real).\nDiferente de pró-labore (remuneração regular) e de empréstimo (cria dívida na C/C).",
      },
      {
        t: "Reembolso da conta corrente",
        d: "Tu → empresa: pagas o que devias (C/C desce).\nUsa quando tinhas feito empréstimo ao proprietário ou despesa pessoal pela empresa.\nNão é pró-labore.",
      },
      {
        t: "Despesa pessoal paga pela empresa",
        d: "Empresa paga algo teu — aumenta o que deves à empresa (C/C).\nMais tarde reembolsas.\nNão registes como despesa «normal» da empresa se for teu consumo.",
      },
      {
        t: "Como tirar dinheiro da empresa",
        d: "· Remuneração? → pró-labore\n· Adiantamento a devolver? → empréstimo ao proprietário\n· Partilha de lucro? → distribuição\n· Pagar o que devias? → reembolso (pessoal → empresa)\n\nNunca «despesa» sem nome nem transferência solta entre caixas.",
      },
      {
        t: "Pagamento a party",
        d: "Liquidez → party a pagar (atómico).\nPara dívida própria (Tuni) ou libertar custódia (Lenu) com Devolver.",
      },
      {
        t: "Cobrança de party",
        d: "Party a receber → liquidez (atómico).\nEx.: cobraste Ferraz — sobe a conta e desce o a receber.",
      },
      {
        t: "De / Para",
        d: "Extremos do movimento (conta, party, mundo…).\nO tipo + de/para definem se sobe C/C, bolsos, etc.",
      },
      {
        t: "Serviço (PDS)",
        d: "Categoria da receita PADStation: jogos, impressões, cópias, trabalhos, manutenção, outros, por classificar.",
      },
      {
        t: "Natureza (custo)",
        d: "Fixo / variável / investimento / retirada — classificação de custos da empresa.",
      },
      {
        t: "Ledger",
        d: "Livro de movimentos persistido.\nO Assistente só grava depois de confirmares.",
      },
    ],
  },
  {
    id: "como",
    title: "Como fazer",
    hint: "Passos práticos — o Assistente também responde a «como calcular…».",
    terms: [
      {
        t: "Como calcular lucro",
        d: "No painel há dois lucros — não mistures:\n\n· Lucro registado = receitas do mês − (despesas + pró-labore) já no ledger.\n· Lucro esperado = receita − o maior entre despesas registadas e custos planeados (mostra o que ainda falta registar).\n\nPassos:\n1. Abre a empresa (PDS / Plural / Picasso's / PH).\n2. Confirma que as receitas do mês estão no Registo (com serviço/categoria se for PDS).\n3. Regista despesas e pró-labore do mês — senão o lucro registado fica inflacionado.\n4. Compara com custos recorrentes: se o planeado > registado, há «por registar».\n5. Lucro ≠ caixa livre: ainda precisas de liquidez para operar; tirar dinheiro é pró-labore / distribuição / empréstimo — nunca «despesa» solta.\n\nAtalho: pergunta no Assistente «lucro registado» ou «lucro esperado».",
      },
      {
        t: "Como fazer lucro",
        d: "Lucro no painel = resultado dos movimentos, não um botão.\n\n1. Aumenta receita real (regista quando o dinheiro entra — na Plural, cliente ≠ pagamento).\n2. Controla custos: planeados vs registados; corta o que não precisa.\n3. Não tires pró-labore acima do que a caixa aguenta.\n4. Vê lucro registado vs esperado na página da empresa.\n5. No Eu, o fluxo do mês mostra o que realmente moveu.\n\nVer também: «Como calcular lucro».",
      },
      {
        t: "Como registar uma receita pessoal",
        d: "1. Registo → receita, conta (BAI/caixa), valor.\n2. Orçamento → Meter ou «Distribuir esta entrada» pelas %.\n3. Confirma no Eu: alocável baixou e os bolsos subiram.\n\nCustódia e dinheiro de empresa não entram aqui.",
      },
      {
        t: "Como Meter / distribuir",
        d: "1. Se alocável > 0, abre Orçamento.\n2. Meter: valor num bolso concreto.\n3. Ou «Distribuir esta entrada»: parte um valor pelas regras (não o stock inteiro).\n4. Projectos só por Meter manual.\n\nSem isto, o gastável não reflecte a realidade.",
      },
      {
        t: "Como devolver custódia",
        d: "1. Contas → party de custódia (Lenu…).\n2. Devolver — sai da conta onde está (ex. ATLANTICO).\n3. O «teu» nessa conta mantém-se.\n\nOu no Assistente: «Devolvi 30000 do Lenu».",
      },
      {
        t: "Como ler o Eu",
        d: "1. De quem é o dinheiro (próprio vs custódia vs empresas).\n2. Alertas.\n3. Património ≠ gastável.\n4. Fluxo do mês = movimentos reais, não o salário declarado.",
      },
      {
        t: "Como usar o Assistente",
        d: "· Movimentos: frases com valor («Emprestei 2000kz na PDS»).\n· Saldos: «quanto tenho no BAI», «minhas dívidas».\n· Conceitos: «o que é custódia?», «como calcular lucro?».\n· Confirma sempre antes de gravar.",
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
        d: "Próprio + bens + participações + a receber − dívidas próprias − C/C à empresa. Custódia fora do líquido. É riqueza estimada, não dinheiro para gastar amanhã.",
      },
      {
        t: "Dinheiro (no património)",
        d: "Liquidez bruta pessoal (a linha «dinheiro» pode incluir custódia; o líquido usa o próprio).",
      },
      {
        t: "Bens / activos",
        d: "Itens com valor declarado (PS5, TV, equipamentos…). Actualiza quando o valor mudar — afecta património, não a caixa.",
      },
      {
        t: "Participações nas empresas",
        d: "Soma do equity das quatro empresas. É a tua fatia contabilística, não um bolso para gastar.",
      },
      {
        t: "Posição",
        d: "Teu + a receber − dívida própria (visão rápida no Eu).",
      },
      {
        t: "Equity",
        d: "Caixa + a receber − a pagar + bens da entidade. Mede a «saúde» da empresa no painel.",
      },
      {
        t: "Fluxo (mês)",
        d: "Movimentos reais do mês — não o salário declarado. Entradas, despesas, transferências, investimentos, dívidas pagas, interempresa, alocações.",
      },
      {
        t: "Entradas reais",
        d: "Receitas pessoais registadas no mês. Compara com renda planeada no Orçamento.",
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
        d: "Receita − max(despesas registadas, custos planeados). Mostra o buraco «por registar».",
      },
      {
        t: "Custos planeados / recorrentes",
        d: "Inventário mensal do que a empresa deve pagar. Não move caixa até registares no ledger.",
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
        d: "Avisos do sistema (alocável, C/C, atraso Plural, etc.). Trata-os na Decisão ou no Registo.",
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

function foldManual(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Todos os termos do manual (regras, distinções, glossário). */
export function allManualTerms(): ManualTerm[] {
  return [...REGRAS, ...DISTINCOES, ...GLOSSARIO.flatMap((s) => s.terms)];
}

/**
 * Procura definição no Caderno.
 * Ex.: «custódia», «alocável», «pró-labore», «como calcular lucro».
 */
export function findManualDefinition(topic: string): ManualTerm | null {
  const raw = foldManual(topic).replace(/[?!.,;:]+$/g, "").trim();
  const wantsHow = /\bcomo\b/.test(raw) || /\b(calcular|fazer|registar)\b/.test(raw);

  // Palavras de conteúdo (ignora ruído: como, calcular, um, e, …)
  const stop = new Set([
    "a",
    "o",
    "as",
    "os",
    "um",
    "uma",
    "uns",
    "umas",
    "e",
    "de",
    "do",
    "da",
    "em",
    "no",
    "na",
    "como",
    "calcular",
    "fazer",
    "registar",
    "meter",
    "definir",
    "usar",
    "ler",
    "tirar",
    "que",
    "significa",
    "explica",
  ]);
  const qWords = raw.match(/[a-z0-9]+/g)?.filter((w) => w.length >= 3 && !stop.has(w)) ?? [];
  if (!qWords.length) return null;

  let best: { term: ManualTerm; score: number } | null = null;
  for (const term of allManualTerms()) {
    const title = foldManual(term.t);
    const titleWords = title.match(/[a-z0-9]+/g) ?? [];
    const titleCompact = title.replace(/[\s\-]+/g, "");
    let score = 0;

    for (const w of qWords) {
      if (titleWords.includes(w)) score += 50;
      else if (titleWords.some((tw) => tw.startsWith(w) || w.startsWith(tw))) score += 20;
      else if (title.includes(w)) score += 15;
    }
    // Todas as palavras-chave do pedido estão no título
    if (qWords.every((w) => title.includes(w))) score += 40;
    // Compact match: prolabore ↔ pró-labore
    const qCompact = qWords.join("");
    if (qCompact.length >= 4 && titleCompact.includes(qCompact)) score += 30;

    if (wantsHow && title.startsWith("como ")) score += 35;
    if (!wantsHow && title.startsWith("como ")) score -= 20;

    if (score > 0 && (!best || score > best.score)) best = { term, score };
  }
  // Exigir overlap real (pelo menos uma palavra forte)
  return best && best.score >= 50 ? best.term : null;
}
