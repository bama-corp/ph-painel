import { useEffect, useState } from "react";
import {
  allocatablePersonal,
  envelopeOf,
  envelopeSpentMes,
  envelopesTotal,
  personalOwnLiquidity,
  rulesOk,
  splitSalary,
} from "../domain/engine";
import { kz, monthLabel, roundKz } from "../domain/money";
import { useStore } from "../domain/store";
import type { BudgetRules } from "../domain/types";
import { Money } from "../ui/Money";
import { Mark, PageHeader, Section, TotalRow } from "../ui/Page";

const RULE_KEYS = [
  ["obrigacoes", "Obrigações"],
  ["reserva", "Reserva"],
  ["investimento", "Investimento"],
  ["despesas", "Despesas"],
  ["lazer", "Lazer"],
] as const;

export function Orcamento() {
  const { state, setRules, allocate, distributeEntry } = useStore();
  const [draft, setDraft] = useState<BudgetRules>(state.rules);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [entryRaw, setEntryRaw] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setDraft(state.rules);
  }, [state.rules]);

  const ownLiq = personalOwnLiquidity(state);
  const nosBolsos = envelopesTotal(state);
  const u = allocatablePersonal(state);
  const split = splitSalary(state.declared.salary, draft);
  const entryPreview = Number(String(entryRaw).replace(",", ".")) || 0;
  const entrySplit = entryPreview > 0 && rulesOk(state.rules) ? splitSalary(entryPreview, state.rules) : null;
  const ok = rulesOk(draft);
  const sumPct =
    draft.obrigacoes + draft.reserva + draft.investimento + draft.despesas + draft.lazer;

  function onDistributeEntry() {
    const n = Number(String(entryRaw).replace(",", "."));
    const r = distributeEntry(n);
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setEntryRaw("");
    setErr("");
  }

  function meterBolso(envelopeId: string) {
    const raw = amounts[envelopeId] ?? "";
    const n = Number(String(raw).replace(",", "."));
    if (!n || n <= 0) {
      setErr("Indica um valor positivo para meter no bolso.");
      return;
    }
    const r = allocate([{ envelopeId, amount: roundKz(n) }]);
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setAmounts((a) => ({ ...a, [envelopeId]: "" }));
    setErr("");
  }

  const splitByKey: Record<(typeof RULE_KEYS)[number][0], number> = {
    obrigacoes: split.obrigacoes,
    reserva: split.reserva,
    investimento: split.investimento,
    despesas: split.despesas,
    lazer: split.lazer,
  };

  const flow: { label: string; pct: number | null }[] = [
    { label: "Entrada", pct: null },
    ...RULE_KEYS.map(([k, label]) => ({ label, pct: draft[k] as number })),
  ];

  return (
    <div className="page">
      <PageHeader title="Orçamento pessoal" mark="pine">
        Cada entrada própria tem função. Custódia e empresa não entram nos bolsos. Meter só sobre
        capital pessoal alocável.
      </PageHeader>

      <dl className="mt-12 grid gap-8 border-y border-ink/12 py-8 sm:grid-cols-3">
        <Status k="Liquidez própria" n={ownLiq} mark="pine" note="Exclui custódia (Lenu, Eduardo, …)." />
        <Status k="Nos bolsos" n={nosBolsos} mark="soft" />
        <Status
          k="Alocável"
          n={u}
          mark={u > 1 ? "rust" : "pine"}
          note={u > 1 ? "Próprio sem bolso — Meter ou distribuir uma entrada." : "Tudo com função."}
        />
      </dl>

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
              {step.pct !== null && <span className="num text-base font-semibold text-ink/55">{step.pct}%</span>}
            </div>
          </li>
        ))}
      </ol>

      <Section title="Regras" mark="pine" hint="Soma tem de ser 100%. Guarda antes de distribuir uma entrada.">
        <div className="grid gap-5 sm:grid-cols-5">
          {RULE_KEYS.map(([k, label]) => (
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
              <span className="mt-1.5 block font-normal normal-case tracking-normal">
                <Money n={splitByKey[k]} tone="mute" />
              </span>
            </label>
          ))}
        </div>
        <p className={`mt-4 text-sm ${ok ? "text-pine" : "text-rust"}`}>
          Soma {sumPct}%{ok ? " — fechado." : " — tem de ser 100%."}
        </p>
        <button type="button" disabled={!ok} onClick={() => setRules(draft)} className="btn-ghost mt-5">
          Guardar regras
        </button>
      </Section>

      <Section
        title="Se entrar o salário GSA"
        mark="pine"
        hint="Simulação com as regras do rascunho, não move dinheiro."
      >
        <div>
          {RULE_KEYS.map(([k, label]) => (
            <Line key={k} k={label} n={splitByKey[k]} />
          ))}
          <TotalRow label="Total" mark="pine">
            <Money n={state.declared.salary} />
          </TotalRow>
        </div>
      </Section>

      <Section
        title="Distribuir esta entrada"
        mark="pine"
        hint="Usa as regras já guardadas (não o rascunho). Não distribui o stock inteiro."
      >
        <label className="field-label max-w-xs">
          Valor da entrada (Kz)
          <input
            className="field num text-base text-ink"
            inputMode="decimal"
            placeholder="ex. 300000"
            value={entryRaw}
            onChange={(e) => setEntryRaw(e.target.value)}
          />
        </label>
        {entrySplit ? (
          <div className="mt-4">
            {RULE_KEYS.map(([k, label]) => (
              <Line key={k} k={label} n={entrySplit[k]} />
            ))}
          </div>
        ) : null}
        <button
          type="button"
          disabled={!rulesOk(state.rules) || entryPreview <= 0 || u <= 0}
          onClick={onDistributeEntry}
          className="btn-solid mt-6"
        >
          Distribuir esta entrada
        </button>
        <p className="mt-3 text-xs leading-relaxed text-ink/40">
          Obrigações + despesas → operacional. Projectos só por Meter manual. Máximo = alocável (
          {kz(u)}).
        </p>
      </Section>

      <Section
        title="Bolsos agora"
        mark="pine"
        hint={
          <>
            {monthLabel(state.month)} · alocável:{" "}
            <Money n={u} tone={u > 1 ? "out" : "in"} />
          </>
        }
      >
        <ul className="space-y-0">
          {state.envelopes.map((e) => {
            const saldo = envelopeOf(state, e.id);
            const gasto = envelopeSpentMes(state, e.id);
            return (
              <li
                key={e.id}
                className="border-b border-ink/[0.07] py-5 first:pt-0 last:border-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold tracking-tight">{e.name}</p>
                    <p className="mt-1 max-w-md text-sm text-ink/50">{e.purpose}</p>
                  </div>
                  <Money n={saldo} />
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <p className="text-sm text-ink/45">
                    Gasto {monthLabel(state.month).toLowerCase()}:{" "}
                    <Money n={gasto} tone={gasto > 0 ? "out" : "mute"} />
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="field-label m-0">
                      Valor
                      <input
                        className="field num m-0 w-28 py-1 text-sm"
                        inputMode="decimal"
                        placeholder="0"
                        value={amounts[e.id] ?? ""}
                        onChange={(ev) =>
                          setAmounts((a) => ({ ...a, [e.id]: ev.target.value }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-ghost py-1.5 text-sm"
                      disabled={u <= 0}
                      onClick={() => meterBolso(e.id)}
                    >
                      Meter
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <TotalRow label="Total bolsos" mark="pine">
          <Money n={nosBolsos} />
        </TotalRow>

        {err ? <p className="mt-4 text-sm text-rust">{err}</p> : null}
      </Section>
    </div>
  );
}

function Status({
  k,
  n,
  mark,
  note,
}: {
  k: string;
  n: number;
  mark: "pine" | "soft" | "rust";
  note?: string;
}) {
  return (
    <div>
      <dt className="eyebrow flex items-center gap-2">
        <Mark tone={mark} />
        {k}
      </dt>
      <dd className="mt-2">
        <Money n={n} />
      </dd>
      {note ? <p className="mt-1.5 text-xs leading-relaxed text-ink/45">{note}</p> : null}
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
