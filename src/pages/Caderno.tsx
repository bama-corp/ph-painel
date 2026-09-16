import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../domain/store";
import { Mark, PageHeader, Section, Sep } from "../ui/Page";

const REGRAS = [
  {
    t: "Caixas separadas",
    d: "Pessoal, PDS, Plural, Picasso's e PH não se misturam. Dinheiro da empresa não é teu para gastar.",
  },
  {
    t: "Banco ≠ bolso",
    d: "Contas mostram onde o dinheiro vive. Orçamento define o que ele pode fazer (operacional, reserva, investimento, lazer, projectos).",
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

const RITMO = [
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

const MENUS = [
  { to: "/", label: "Eu", d: "Visão geral. De quem é o dinheiro." },
  { to: "/orcamento", label: "Orçamento", d: "Regras e bolsos. Dá função." },
  { to: "/contas", label: "Contas", d: "Bancos, a receber, a pagar." },
  { to: "/pds", label: "PDS", d: "Caixa e operação PADStation." },
  { to: "/plural", label: "Plural", d: "Recorrência e clientes." },
  { to: "/picasso", label: "Picasso's", d: "Caixa da empresa." },
  { to: "/ph", label: "PH", d: "Caixa da empresa PH." },
  { to: "/movimentos", label: "Registo", d: "Tudo o que aconteceu." },
  { to: "/decisao", label: "Decisão", d: "O que fazer agora." },
];

export function Caderno() {
  const { state, addNote, setNote, removeNote, downloadJson, importJson } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState("");

  function onImportFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const r = importJson(text);
      if (!r.ok) {
        setImportMsg(r.reason);
        return;
      }
      setImportMsg(`Importado: ${file.name}`);
    };
    reader.readAsText(file);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    if (!t && !b) return;
    if (editing) {
      setNote(editing, { title: t || "Sem título", body: b });
      setEditing(null);
    } else {
      addNote({ at: state.asOf, title: t || "Sem título", body: b });
    }
    setTitle("");
    setBody("");
  }

  function startEdit(id: string) {
    const n = state.notes.find((x) => x.id === id);
    if (!n) return;
    setEditing(id);
    setTitle(n.title);
    setBody(n.body);
  }

  function cancelEdit() {
    setEditing(null);
    setTitle("");
    setBody("");
  }

  return (
    <div className="page">
      <PageHeader title="Caderno">
        O mínimo de finanças para usares o PH bem — e as tuas notas por baixo.
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" onClick={() => downloadJson()}>
          Exportar JSON
        </button>
        <label className="btn-ghost cursor-pointer">
          Importar JSON
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              onImportFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
        <span className="self-center text-xs text-ink/40">
          schema v{state.schemaVersion} · snapshot {state.asOf}
        </span>
        {importMsg ? <span className="text-xs text-pine">{importMsg}</span> : null}
      </div>
      <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink/45">
        Os dados vivem no localStorage deste domínio (localhost ≠ vercel.app). Para trazer o que
        editaste na Vercel: no site de produção abre a consola (F12) e corre{" "}
        <code className="text-ink/60">copy(localStorage.getItem(&quot;ph-painel-v3&quot;))</code>,
        cola num ficheiro .json e importa aqui — ou usa Exportar JSON se a produção já tiver o botão.
      </p>

      <Section
        title="Seis regras"
        mark="ink"
        hint="Se só te lembrares disto, o painel já funciona."
      >
        <ol className="space-y-0">
          {REGRAS.map((r, i) => (
            <li key={r.t} className="border-b border-ink/10 py-5 first:pt-0">
              <p className="eyebrow flex items-center gap-2">
                <Mark />
                {String(i + 1).padStart(2, "0")} · {r.t}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/65">{r.d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Ritmo" mark="pine" hint="Não precisas de disciplina infinita — precisas de gatilhos.">
        <ul className="space-y-0">
          {RITMO.map((r) => (
            <li key={r.t} className="border-b border-ink/[0.07] py-5 first:pt-0">
              <p className="font-display text-lg font-semibold tracking-tight">{r.t}</p>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink/60">{r.d}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Onde fazer cada coisa" mark="soft">
        <ul>
          {MENUS.map((m) => (
            <li key={m.to} className="ledger-row !items-start py-3">
              <Link
                to={m.to}
                className="shrink-0 border-b border-ink/25 pb-px font-display text-base tracking-tight hover:border-ink"
              >
                {m.label}
              </Link>
              <span className="max-w-sm text-right text-sm text-ink/55">{m.d}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Sep />

      <Section
        title="As tuas notas"
        mark="ink"
        hint="Lembretes, conversas, decisões a meio. O guia acima não se apaga."
        className="mt-0"
      >
        <form onSubmit={submit} className="panel max-w-2xl space-y-4">
          <p className="eyebrow flex items-center gap-2">
            <Mark tone="soft" />
            {editing ? "Editar nota" : "Nova nota"}
          </p>
          <label className="field-label block">
            Título
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Falar com Tuni sobre saldo"
            />
          </label>
          <label className="field-label block">
            Texto
            <textarea
              className="field min-h-[8rem] resize-y"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="O que precisas de lembrar ou decidir…"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-solid">
              {editing ? "Guardar" : "Adicionar"}
            </button>
            {editing ? (
              <button type="button" className="btn-ghost" onClick={cancelEdit}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        {state.notes.length === 0 ? (
          <p className="mt-10 text-sm text-ink/45">Ainda sem notas tuas.</p>
        ) : (
          <ul className="mt-10 space-y-0">
            {state.notes.map((n) => (
              <li key={n.id} className="border-b border-ink/10 py-8 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="eyebrow flex items-center gap-2">
                    <Mark tone="soft" />
                    {n.at}
                  </p>
                  <div className="flex gap-4 text-[0.72rem] uppercase tracking-[0.14em] text-ink/40">
                    <button type="button" className="hover:text-ink" onClick={() => startEdit(n.id)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="hover:text-rust"
                      onClick={() => {
                        if (editing === n.id) cancelEdit();
                        removeNote(n.id);
                      }}
                    >
                      Apagar
                    </button>
                  </div>
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">{n.title}</h2>
                {n.body ? (
                  <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-ink/65">
                    {n.body}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
