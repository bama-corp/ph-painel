import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ACCUMULATION_METHODS,
  CHECKLIST_STORAGE_KEY,
  CUSTOM_BUDGET_METHOD_ID,
  DEFINICAO_CHECKLIST,
  DEFINICAO_SECTIONS,
  SPLIT_METHODS,
  splitMethodById,
} from "../domain/definicaoRules";
import { useStore } from "../domain/store";
import { Mark, PageHeader, Section, Sep } from "../ui/Page";

type Tab = "regras" | "metodos" | "checklist";

function loadChecklist(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function Definicao() {
  const { state, setBudgetMethod } = useStore();
  const [tab, setTab] = useState<Tab>("regras");
  const [sectionId, setSectionId] = useState(DEFINICAO_SECTIONS[0]?.id ?? "entrada");
  const [checks, setChecks] = useState<Record<string, boolean>>(loadChecklist);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checks));
  }, [checks]);

  const section = DEFINICAO_SECTIONS.find((s) => s.id === sectionId) ?? DEFINICAO_SECTIONS[0];
  const done = DEFINICAO_CHECKLIST.filter((c) => checks[c.id]).length;
  const activeId = state.budgetMethodId ?? CUSTOM_BUDGET_METHOD_ID;
  const activeMethod = splitMethodById(activeId);

  function onSelectMethod(id: string) {
    const r = setBudgetMethod(id);
    if (!r.ok) {
      setMsg(r.reason);
      return;
    }
    setMsg(`Método «${splitMethodById(id)?.name}» aplicado às percentagens do Orçamento.`);
  }

  return (
    <div className="page">
      <PageHeader title="Definição" mark="pine">
        Regras de funcionamento e métodos de divisão. Escolher um método actualiza as percentagens dos
        bolsos no{" "}
        <Link to="/orcamento" className="border-b border-ink/25 hover:border-ink">
          Orçamento
        </Link>{" "}
        (Distribuir entrada / simulação).
      </PageHeader>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-b border-ink/12 pb-3 text-sm">
        {(
          [
            ["regras", "Regras"],
            ["metodos", "Métodos"],
            ["checklist", "Checklist"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "border-b-2 border-ink pb-2 font-medium text-ink"
                : "pb-2 text-ink/45 hover:text-ink"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "regras" && section && (
        <>
          <div className="mt-8 flex flex-wrap gap-2">
            {DEFINICAO_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSectionId(s.id)}
                className={
                  sectionId === s.id
                    ? "btn-ghost border-ink/25 bg-wash/80 text-ink"
                    : "btn-ghost text-ink/50"
                }
              >
                {s.title}
              </button>
            ))}
          </div>

          <Section title={section.title} mark="pine" hint={section.lede} className="mt-10">
            <ul className="space-y-0">
              {section.rules.map((r) => (
                <li key={r.id} className="border-b border-ink/[0.07] py-5 first:pt-0 last:border-0">
                  <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
                    <Mark tone="soft" />
                    {r.title}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">{r.body}</p>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {tab === "metodos" && (
        <>
          <Section
            title="Divisão orçamentária"
            mark="pine"
            hint={
              activeId === CUSTOM_BUDGET_METHOD_ID
                ? "Activo: personalizado (editaste % no Orçamento). Escolhe um método para repor o mapa."
                : `Activo: ${activeMethod?.name ?? activeId}. Ao seleccionar, as % do Orçamento mudam já.`
            }
            className="mt-10"
          >
            <ul className="space-y-0">
              {SPLIT_METHODS.map((m) => {
                const selected = activeId === m.id;
                return (
                  <li
                    key={m.id}
                    className="border-b border-ink/[0.07] py-5 first:pt-0 last:border-0"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p className="font-display text-lg font-semibold tracking-tight">
                        {m.name}
                        {selected ? (
                          <span className="ml-2 text-sm font-normal text-pine">· activo</span>
                        ) : null}
                      </p>
                      <button
                        type="button"
                        className={selected ? "btn-ghost text-ink/40" : "btn-solid"}
                        disabled={selected}
                        onClick={() => onSelectMethod(m.id)}
                      >
                        {selected ? "Em uso" : "Usar este"}
                      </button>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm text-ink/60 sm:grid-cols-3">
                      <div>
                        <dt className="eyebrow text-ink/40">Necessidades</dt>
                        <dd className="mt-1">{m.needs}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow text-ink/40">Lazer / estilo</dt>
                        <dd className="mt-1">{m.wants}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow text-ink/40">Futuro</dt>
                        <dd className="mt-1">{m.future}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs text-ink/40">
                      Obrigações {m.rules.obrigacoes}% · despesas {m.rules.despesas}% · reserva{" "}
                      {m.rules.reserva}% · investimento {m.rules.investimento}% · lazer {m.rules.lazer}%
                    </p>
                  </li>
                );
              })}
            </ul>
            {msg ? <p className="mt-4 text-sm text-pine">{msg}</p> : null}
          </Section>

          <Sep />

          <Section title="Acumulação" mark="pine" hint="Como construir o hábito de guardar.">
            <ul className="space-y-0">
              {ACCUMULATION_METHODS.map((r) => (
                <li key={r.id} className="border-b border-ink/[0.07] py-5 first:pt-0 last:border-0">
                  <p className="font-display text-lg font-semibold tracking-tight">{r.title}</p>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">{r.body}</p>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {tab === "checklist" && (
        <Section
          title="Implementação"
          mark="pine"
          hint={`Começa com 3–5 itens. Consistência > perfeição. ${done}/${DEFINICAO_CHECKLIST.length} feitos.`}
          className="mt-10"
        >
          <ul className="space-y-0">
            {DEFINICAO_CHECKLIST.map((c) => (
              <li key={c.id} className="border-b border-ink/[0.07] py-3.5 last:border-0">
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink/75">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(checks[c.id])}
                    onChange={(e) =>
                      setChecks((prev) => ({ ...prev, [c.id]: e.target.checked }))
                    }
                  />
                  <span className={checks[c.id] ? "text-ink/40 line-through" : ""}>{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-relaxed text-ink/40">
            O checklist fica neste browser. Os bolsos e o dinheiro continuam no Orçamento e no Registo.
          </p>
        </Section>
      )}
    </div>
  );
}
