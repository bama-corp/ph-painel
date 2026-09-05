import { useState } from "react";
import { envelopeOf, envelopesTotal, rulesOk, splitSalary, unallocated } from "../domain/engine";
import { kz, roundKz } from "../domain/money";
import { useStore } from "../domain/store";
import type { BudgetRules } from "../domain/types";
import { Money } from "../ui/Money";
import { PageHeader, Section, TotalRow } from "../ui/Page";

export function Orcamento() {
  const { state, setRules, allocate } = useStore();
  const [draft, setDraft] = useState<BudgetRules>(state.rules);
  const u = unallocated(state);
  const split = splitSalary(state.declared.salary, draft);
  const ok = rulesOk(draft);

  function applyRulesToUnallocated() {
    if (!ok || u <= 0) return;
    const s = splitSalary(u, draft);
    allocate([
      { envelopeId: "operacional", amount: roundKz(s.obrigacoes + s.despesas) },
      { envelopeId: "reserva", amount: s.reserva },
      { envelopeId: "investimento", amount: s.investimento },
      { envelopeId: "lazer", amount: s.lazer },
    ]);
  }

  const flow = [
    { label: "Entrada", pct: null },
    { label: "Obrigações", pct: draft.obrigacoes },
    { label: "Reserva", pct: draft.reserva },
    { label: "Investimento", pct: draft.investimento },
    { label: "Despesas", pct: draft.despesas },
    { label: "Lazer", pct: draft.lazer },
  ];

  return (
    <div className="page">
      <PageHeader title="Orçamento pessoal" mark="pine">
        Cada entrada tem função. Sem regras, o restante gasta-se à toa. Define percentagens — depois o
        salário de {kz(state.declared.salary, 0)} sabe para onde vai.
      </PageHeader>

      <ol className="mt-12 space-y-0 border-y border-ink/12 py-2">
        {flow.map((step, i) => (
          <li key={step.label}>
            {i > 0 && (
              <div className="flex items-center gap-3 py-1.5 pl-1" aria-hidden>
                <span className="sep-line max-w-[1.25rem]" />
                <span className="text-ink/25">↓</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 border-b border-ink/[0.06] py-2.5 last:border-0">
              <span className="flex items-center gap-2.5 font-display text-lg tracking-tight sm:text-xl">
                <span className="mark mark-soft" aria-hidden />
                {step.label}
              </span>
              {step.pct !== null && <span className="num text-base text-ink/55">{step.pct}%</span>}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 grid gap-5 sm:grid-cols-5">
        {(
          [
            ["obrigacoes", "Obrigações"],
            ["reserva", "Reserva"],
            ["investimento", "Investimento"],
            ["despesas", "Despesas"],
            ["lazer", "Lazer"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="field-label">
            {label}
            <input
              type="number"
              min={0}
              max={100}
              className="field num text-base text-ink"
              value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <p className={`mt-3 text-sm ${ok ? "text-pine" : "text-rust"}`}>
        Soma {draft.obrigacoes + draft.reserva + draft.investimento + draft.despesas + draft.lazer}%
        {ok ? " — fechado." : " — tem de ser 100%."}
      </p>
      <button type="button" disabled={!ok} onClick={() => setRules(draft)} className="btn-ghost mt-5">
        Guardar regras
      </button>

      <Section title="Se entrar o salário GSA" hint="Simulação com as regras do rascunho, não move dinheiro.">
        <div>
          <Line k="Obrigações" n={split.obrigacoes} />
          <Line k="Reserva" n={split.reserva} />
          <Line k="Investimento" n={split.investimento} />
          <Line k="Despesas" n={split.despesas} />
          <Line k="Lazer" n={split.lazer} />
          <TotalRow label="Total" mark="pine">
            <Money n={state.declared.salary} />
          </TotalRow>
        </div>
      </Section>

      <Section
        title="Bolsos agora"
        hint={
          <>
            Sem função: <Money n={u} tone={u > 1 ? "out" : "in"} />
          </>
        }
      >
        <div className="space-y-5">
          {state.envelopes.map((e) => (
            <div key={e.id} className="border-b border-ink/[0.07] pb-4 last:border-0">
              <div className="flex justify-between gap-4">
                <span className="font-display text-lg tracking-tight">{e.name}</span>
                <Money n={envelopeOf(state, e.id)} />
              </div>
              <p className="mt-1 text-sm text-ink/50">{e.purpose}</p>
            </div>
          ))}
        </div>
        <TotalRow label="Total bolsos" mark="pine">
          <Money n={envelopesTotal(state)} />
        </TotalRow>
        <button
          type="button"
          disabled={!ok || u <= 0}
          onClick={applyRulesToUnallocated}
          className="btn-solid mt-8"
        >
          Distribuir o dinheiro sem função segundo as regras
        </button>
        <p className="mt-3 text-xs leading-relaxed text-ink/40">
          Obrigações e despesas caem no bolso operacional — o pagamento das dívidas faz-se no Registo,
          à parte.
        </p>
      </Section>
    </div>
  );
}

function Line({ k, n }: { k: string; n: number }) {
  return (
    <div className="ledger-row">
      <span className="text-ink/65">{k}</span>
      <Money n={n} />
    </div>
  );
}
