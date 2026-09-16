import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CUSTOM_BUDGET_METHOD_ID,
  SPLIT_METHODS,
  splitMethodById,
} from "../domain/definicaoRules";
import {
  allocatablePersonal,
  envelopeOf,
  envelopeSpentMes,
  envelopesTotal,
  personalOwnLiquidity,
  plannedIncomeTotal,
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
  const {
    state,
    setRules,
    setBudgetMethod,
    allocate,
    distributeEntry,
    addIncomeSource,
    setIncomeSource,
    removeIncomeSource,
  } = useStore();
  const [draft, setDraft] = useState<BudgetRules>(state.rules);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [entryRaw, setEntryRaw] = useState("");
  const [err, setErr] = useState("");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  useEffect(() => {
    setDraft(state.rules);
  }, [state.rules]);

  const ownLiq = personalOwnLiquidity(state);
  const nosBolsos = envelopesTotal(state);
  const u = allocatablePersonal(state);
  const planned = plannedIncomeTotal(state);
  const split = splitSalary(planned, draft);
  const entryPreview = Number(String(entryRaw).replace(",", ".")) || 0;
  const entrySplit = entryPreview > 0 && rulesOk(state.rules) ? splitSalary(entryPreview, state.rules) : null;
  const ok = rulesOk(draft);
  const sumPct =
    draft.obrigacoes + draft.reserva + draft.investimento + draft.despesas + draft.lazer;
  const sources = state.incomeSources ?? [];
  const methodId = state.budgetMethodId ?? CUSTOM_BUDGET_METHOD_ID;
  const methodLabel =
    methodId === CUSTOM_BUDGET_METHOD_ID
      ? "Personalizado"
      : (splitMethodById(methodId)?.name ?? methodId);

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

  function onAddSource() {
    const n = Number(String(newAmount).replace(",", "."));
    const r = addIncomeSource({ name: newName, amount: n, active: true });
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setNewName("");
    setNewAmount("");
    setErr("");
  }

  const splitByKey: Record<(typeof RULE_KEYS)[number][0], number> = {
    obrigacoes: split.obrigacoes,
    reserva: split.reserva,
    investimento: split.investimento,
    despesas: split.despesas,
    lazer: split.lazer,
  };

  return (
    <div className="page">
      <PageHeader title="Orçamento pessoal" mark="pine">
        Fontes, percentagens dos bolsos e Meter. As regras de funcionamento (como usar cada categoria)
        estão em{" "}
        <Link to="/definicao" className="border-b border-ink/25 hover:border-ink">
          Definição
        </Link>
        . Custódia e empresa não entram nos bolsos.
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

      <Section
        title="Percentagens dos bolsos"
        mark="pine"
        hint={
          <>
            Método activo: <strong className="font-medium text-ink/70">{methodLabel}</strong>
            {" · "}
            <Link to="/definicao" className="border-b border-ink/25 hover:border-ink">
              mudar em Definição
            </Link>
            . Soma 100%. Guarda antes de distribuir.
          </>
        }
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {SPLIT_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={
                methodId === m.id
                  ? "btn-ghost border-ink/25 bg-wash/80 text-ink"
                  : "btn-ghost text-ink/50"
              }
              onClick={() => {
                const r = setBudgetMethod(m.id);
                if (!r.ok) setErr(r.reason);
                else setErr("");
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
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
        title="Fontes de renda"
        mark="pine"
        hint="Planeamento mensal (não move dinheiro). A simulação das regras usa a soma das activas."
      >
        <ul className="space-y-0">
          {sources.map((src) => (
            <li
              key={src.id}
              className="flex flex-wrap items-end gap-3 border-b border-ink/[0.07] py-4 first:pt-0 last:border-0"
            >
              <label className="field-label min-w-[10rem] flex-1">
                Nome
                <input
                  className="field text-sm font-normal normal-case tracking-normal text-ink"
                  value={src.name}
                  onChange={(e) => setIncomeSource(src.id, { name: e.target.value })}
                />
              </label>
              <label className="field-label w-36">
                Valor (Kz)
                <input
                  className="field num text-sm font-normal normal-case tracking-normal text-ink"
                  inputMode="decimal"
                  value={src.amount}
                  onChange={(e) => {
                    const n = Number(String(e.target.value).replace(",", "."));
                    if (Number.isFinite(n) && n >= 0) setIncomeSource(src.id, { amount: n });
                  }}
                />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm text-ink/60">
                <input
                  type="checkbox"
                  checked={src.active}
                  onChange={(e) => setIncomeSource(src.id, { active: e.target.checked })}
                />
                Activa
              </label>
              <button
                type="button"
                className="btn-ghost py-1.5 text-sm"
                onClick={() => {
                  const r = removeIncomeSource(src.id);
                  if (!r.ok) setErr(r.reason);
                }}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="field-label min-w-[10rem] flex-1">
            Nova fonte
            <input
              className="field text-sm font-normal normal-case tracking-normal text-ink"
              placeholder="ex. Freelance"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label className="field-label w-36">
            Valor (Kz)
            <input
              className="field num text-sm font-normal normal-case tracking-normal text-ink"
              inputMode="decimal"
              placeholder="0"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
          </label>
          <button type="button" className="btn-ghost" onClick={onAddSource}>
            Adicionar
          </button>
        </div>

        <div className="mt-6">
          {RULE_KEYS.map(([k, label]) => (
            <Line key={k} k={label} n={splitByKey[k]} />
          ))}
          <TotalRow label="Renda planeada (activas)" mark="pine">
            <Money n={planned} />
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
