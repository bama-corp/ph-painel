import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  DISTINCOES,
  GLOSSARIO,
  MENUS,
  REGRAS,
  RITMO,
  type ManualSection,
} from "../domain/cadernoManual";
import { formatDatePt, todayIso } from "../domain/money";
import { useStore } from "../domain/store";
import { Mark, PageHeader, Section, Sep } from "../ui/Page";

type Vista = "fundamentos" | "glossario" | "mapa" | "notas";

const VISTAS: { id: Vista; label: string }[] = [
  { id: "fundamentos", label: "Fundamentos" },
  { id: "glossario", label: "Glossário" },
  { id: "mapa", label: "Mapa" },
  { id: "notas", label: "Notas" },
];

function filterSection(section: ManualSection, q: string): ManualSection | null {
  if (!q) return section;
  const terms = section.terms.filter(
    (t) => t.t.toLowerCase().includes(q) || t.d.toLowerCase().includes(q),
  );
  if (terms.length === 0) return null;
  return { ...section, terms };
}

function CompactTerms({ terms }: { terms: { t: string; d: string }[] }) {
  return (
    <ul>
      {terms.map((r) => (
        <li key={r.t} className="ledger-row !items-start flex-col gap-1.5 py-3.5 sm:flex-row sm:gap-6">
          <p className="shrink-0 font-display text-[0.95rem] font-semibold leading-snug tracking-tight sm:w-48">
            {r.t}
          </p>
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/60">{r.d}</p>
        </li>
      ))}
    </ul>
  );
}

export function Caderno() {
  const { state, addNote, setNote, removeNote, downloadJson, importJson } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const [showBackup, setShowBackup] = useState(false);
  const [vista, setVista] = useState<Vista>("fundamentos");
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState(GLOSSARIO[0]?.id ?? "mapa");

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const glossarioFiltrado = GLOSSARIO.map((s) => filterSection(s, q)).filter(
    (s): s is ManualSection => s !== null,
  );
  const activeTopic =
    glossarioFiltrado.find((s) => s.id === topicId) ?? glossarioFiltrado[0] ?? null;

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
      addNote({ at: todayIso(), title: t || "Sem título", body: b });
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
        Manual do painel — regras, glossário e as tuas notas.
      </PageHeader>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Secções do caderno">
          {VISTAS.map((v) => {
            const on = vista === v.id;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setVista(v.id)}
                className={`px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.14em] transition-colors ${
                  on
                    ? "border-b-2 border-ink text-ink"
                    : "border-b-2 border-transparent text-ink/40 hover:text-ink/70"
                }`}
              >
                {v.label}
                {v.id === "notas" && state.notes.length > 0 ? (
                  <span className="ml-1.5 num text-ink/35">{state.notes.length}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <span className="sep-line hidden min-w-[2rem] flex-1 sm:block" />
        <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => downloadJson()}>
          Exportar
        </button>
        <label className="btn-ghost !px-3 !py-1.5 cursor-pointer text-xs">
          Importar
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
        <button
          type="button"
          className="text-[0.68rem] uppercase tracking-[0.14em] text-ink/35 hover:text-ink/60"
          onClick={() => setShowBackup((x) => !x)}
        >
          {showBackup ? "Ocultar backup" : "Backup"}
        </button>
        {importMsg ? <span className="text-xs text-pine">{importMsg}</span> : null}
      </div>

      {showBackup ? (
        <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink/45">
          schema v{state.schemaVersion} · snapshot {formatDatePt(state.asOf)}. Os dados vivem no
          localStorage deste domínio (localhost ≠ vercel.app). Em produção: F12 →{" "}
          <code className="text-ink/60">copy(localStorage.getItem(&quot;ph-painel-v3&quot;))</code> →
          ficheiro .json → Importar.
        </p>
      ) : null}

      {vista === "fundamentos" ? (
        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-x-14">
          <section>
            <div className="section-head">
              <Mark />
              <h2 className="section-title text-xl">Seis regras</h2>
            </div>
            <p className="mt-2 text-sm text-ink/45">Se só te lembrares disto, o painel já funciona.</p>
            <ol className="mt-5">
              {REGRAS.map((r, i) => (
                <li key={r.t} className="border-b border-ink/[0.07] py-3.5 first:pt-0">
                  <p className="eyebrow">
                    {String(i + 1).padStart(2, "0")} · {r.t}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/65">{r.d}</p>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <div className="section-head">
              <Mark tone="pine" />
              <h2 className="section-title text-xl">Distinções</h2>
            </div>
            <p className="mt-2 text-sm text-ink/45">
              Confundir estes pares é a forma mais rápida de mentir aos números.
            </p>
            <div className="mt-5">
              <CompactTerms terms={DISTINCOES} />
            </div>
          </section>
        </div>
      ) : null}

      {vista === "glossario" ? (
        <Section
          title="Glossário"
          mark="soft"
          hint="Uma área de cada vez. Procura para cruzar todas."
          className="!mt-10"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="field-label block max-w-sm flex-1">
              Procurar
              <input
                className="field"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="custódia, Meter, MRR…"
                autoComplete="off"
              />
            </label>
            {!searching && activeTopic ? (
              <p className="text-xs text-ink/40">{activeTopic.terms.length} termos nesta área</p>
            ) : null}
            {searching ? (
              <p className="text-xs text-ink/40">
                {glossarioFiltrado.reduce((n, s) => n + s.terms.length, 0)} resultados
              </p>
            ) : null}
          </div>

          {glossarioFiltrado.length === 0 ? (
            <p className="mt-8 text-sm text-ink/45">Nenhum termo bate com «{query.trim()}».</p>
          ) : searching ? (
            <div className="mt-6">
              <CompactTerms terms={glossarioFiltrado.flatMap((s) => s.terms)} />
            </div>
          ) : (
            <>
              <div
                className="mt-6 flex flex-wrap gap-x-1 gap-y-1 border-b border-ink/10 pb-px"
                role="tablist"
                aria-label="Áreas do glossário"
              >
                {glossarioFiltrado.map((sec) => {
                  const on = activeTopic?.id === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTopicId(sec.id)}
                      className={`px-2.5 py-2 text-[0.68rem] uppercase tracking-[0.12em] transition-colors ${
                        on
                          ? "border-b-2 border-ink text-ink"
                          : "border-b-2 border-transparent text-ink/40 hover:text-ink/70"
                      }`}
                    >
                      {sec.title}
                    </button>
                  );
                })}
              </div>

              {activeTopic ? (
                <div className="mt-6">
                  {activeTopic.hint ? (
                    <p className="mb-4 max-w-xl text-sm text-ink/45">{activeTopic.hint}</p>
                  ) : null}
                  <CompactTerms terms={activeTopic.terms} />
                </div>
              ) : null}
            </>
          )}
        </Section>
      ) : null}

      {vista === "mapa" ? (
        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-x-14">
          <section>
            <div className="section-head">
              <Mark tone="pine" />
              <h2 className="section-title text-xl">Ritmo</h2>
            </div>
            <p className="mt-2 text-sm text-ink/45">Gatilhos, não disciplina infinita.</p>
            <div className="mt-5">
              <CompactTerms terms={RITMO} />
            </div>
          </section>
          <section>
            <div className="section-head">
              <Mark tone="soft" />
              <h2 className="section-title text-xl">Onde fazer</h2>
            </div>
            <p className="mt-2 text-sm text-ink/45">Cada página tem um trabalho.</p>
            <ul className="mt-5">
              {MENUS.map((m) => (
                <li key={m.to} className="ledger-row !items-start py-2.5">
                  <Link
                    to={m.to}
                    className="shrink-0 border-b border-ink/25 pb-px font-display text-[0.95rem] tracking-tight hover:border-ink"
                  >
                    {m.label}
                  </Link>
                  <span className="max-w-[16rem] text-right text-sm leading-snug text-ink/55">{m.d}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm leading-relaxed text-ink/50">
              O <span className="text-ink/70">Assistente</span> é o botão flutuante no canto — propõe;
              tu confirmas no ledger.
            </p>
          </section>
        </div>
      ) : null}

      {vista === "notas" ? (
        <>
          <Sep />
          <Section
            title="As tuas notas"
            mark="ink"
            hint="Lembretes e decisões a meio. O manual não se apaga."
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
                  <li key={n.id} className="border-b border-ink/10 py-6 first:pt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p className="eyebrow flex items-center gap-2">
                        <Mark tone="soft" />
                        {formatDatePt(n.at)}
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
                      <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-ink/65">
                        {n.body}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
