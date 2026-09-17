import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CUSTOM_BUDGET_METHOD_ID,
  SPLIT_METHODS,
  splitMethodById,
} from "../domain/definicaoRules";
import {
  allocatablePersonal,
  budgetBucketGap,
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
import type { AppState, BudgetBucket, BudgetRules } from "../domain/types";
import { Money } from "../ui/Money";
import { Mark, PageHeader, Section, TotalRow } from "../ui/Page";

const RULE_KEYS = [
  ["obrigacoes", "Obrigações"],
  ["reserva", "Reserva"],
  ["investimento", "Investimento"],
  ["despesas", "Despesas"],
  ["lazer", "Lazer"],
] as const;

const BUCKET_HINTS: Record<BudgetBucket, string> = {
  obrigacoes: "ex. renda, condomínio, luz, água, internet, escola, seguros, dívida fixa",
  despesas: "ex. alimentação, transporte, farmácia, casa",
  lazer: "ex. saída, streaming, hobbies",
  reserva: "ex. meta emergência (parcela mensal)",
  investimento: "ex. aporte empresas, bolsa, formação",
};

type ErrZone = "sources" | "rules" | "lines" | "entry" | "bolsos" | "";

function rulesEqual(a: BudgetRules, b: BudgetRules) {
  return (
    a.obrigacoes === b.obrigacoes &&
    a.reserva === b.reserva &&
    a.investimento === b.investimento &&
    a.despesas === b.despesas &&
    a.lazer === b.lazer
  );
}

function pickOpenBucket(state: AppState, rules: BudgetRules): BudgetBucket {
  for (const [bucket] of RULE_KEYS) {
    const g = budgetBucketGap(state, bucket, rules);
    if (g.hasLines && g.gap > 1) return bucket;
  }
  const empty = RULE_KEYS.find(([b]) => !budgetBucketGap(state, b, rules).hasLines);
  return empty?.[0] ?? "obrigacoes";
}

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
    addBudgetLine,
    setBudgetLine,
    removeBudgetLine,
  } = useStore();
  const [draft, setDraft] = useState<BudgetRules>(state.rules);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [entryRaw, setEntryRaw] = useState("");
  const [err, setErr] = useState("");
  const [errZone, setErrZone] = useState<ErrZone>("");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [lineDrafts, setLineDrafts] = useState<Record<BudgetBucket, { name: string; amount: string }>>(
    () => emptyLineDrafts(),
  );
  const [openBucket, setOpenBucket] = useState<BudgetBucket>(() =>
    pickOpenBucket(state, state.rules),
  );

  useEffect(() => {
    setDraft(state.rules);
  }, [state.rules]);

  useEffect(() => {
    setOpenBucket(pickOpenBucket(state, state.rules));
    // não resetar ao editar linhas — só ao mudar método
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.budgetMethodId]);

  const ownLiq = personalOwnLiquidity(state);
  const nosBolsos = envelopesTotal(state);
  const u = allocatablePersonal(state);
  const planned = plannedIncomeTotal(state);
  const draftDirty = !rulesEqual(draft, state.rules);
  /** Tecto do inventário: rascunho se válido, senão regras guardadas. */
  const ceilingRules = rulesOk(draft) ? draft : state.rules;
  const split = splitSalary(planned, ceilingRules);
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

  const bucketSummaries = useMemo(
    () =>
      RULE_KEYS.map(([bucket, label]) => ({
        bucket,
        label,
        gap: budgetBucketGap(state, bucket, ceilingRules),
        lines: (state.budgetLines ?? []).filter((l) => l.bucket === bucket),
      })),
    [state, ceilingRules],
  );

  function showErr(zone: ErrZone, reason: string) {
    setErrZone(zone);
    setErr(reason);
  }

  function clearErr() {
    setErr("");
    setErrZone("");
  }

  function onDistributeEntry() {
    const n = Number(String(entryRaw).replace(",", "."));
    const r = distributeEntry(n);
    if (!r.ok) {
      showErr("entry", r.reason);
      return;
    }
    setEntryRaw("");
    clearErr();
  }

  function meterBolso(envelopeId: string) {
    const raw = amounts[envelopeId] ?? "";
    const n = Number(String(raw).replace(",", "."));
    if (!n || n <= 0) {
      showErr("bolsos", "Indica um valor positivo para meter no bolso.");
      return;
    }
    const r = allocate([{ envelopeId, amount: roundKz(n) }]);
    if (!r.ok) {
      showErr("bolsos", r.reason);
      return;
    }
    setAmounts((a) => ({ ...a, [envelopeId]: "" }));
    clearErr();
  }

  function onAddSource() {
    const n = Number(String(newAmount).replace(",", "."));
    const r = addIncomeSource({ name: newName, amount: n, active: true });
    if (!r.ok) {
      showErr("sources", r.reason);
      return;
    }
    setNewName("");
    setNewAmount("");
    clearErr();
  }

  function onAddLine(bucket: BudgetBucket) {
    const d = lineDrafts[bucket];
    const n = Number(String(d.amount).replace(",", ".")) || 0;
    const r = addBudgetLine({ bucket, name: d.name, amount: n, active: true });
    if (!r.ok) {
      showErr("lines", r.reason);
      return;
    }
    setLineDrafts((prev) => ({ ...prev, [bucket]: { name: "", amount: "" } }));
    clearErr();
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
        Fontes → percentagens → inventário → distribuir → bolsos. Regras de funcionamento em{" "}
        <Link to="/definicao" className="border-b border-ink/25 hover:border-ink">
          Definição
        </Link>
        . Custódia e empresa fora.
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

      {/* 1 — Fontes */}
      <Section
        title="Fontes de renda"
        mark="pine"
        hint="Planeamento mensal (não move dinheiro). Os tectos das % usam a soma das activas."
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
                  if (!r.ok) showErr("sources", r.reason);
                  else clearErr();
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

        <TotalRow label="Renda planeada (activas)" mark="pine" className="mt-6">
          <Money n={planned} />
        </TotalRow>
        <ZoneErr show={errZone === "sources"} msg={err} />
      </Section>

      {/* 2 — Percentagens */}
      <Section
        title="Percentagens dos bolsos"
        mark="pine"
        hint={
          <>
            Método: <strong className="font-medium text-ink/70">{methodLabel}</strong>
            {" · "}
            <Link to="/definicao" className="border-b border-ink/25 hover:border-ink">
              ver métodos
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
                if (!r.ok) showErr("rules", r.reason);
                else clearErr();
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
          {draftDirty && ok ? (
            <span className="text-ink/45"> · rascunho — guarda para activar na distribuição</span>
          ) : null}
        </p>
        <button
          type="button"
          disabled={!ok || !draftDirty}
          onClick={() => {
            setRules(draft);
            clearErr();
          }}
          className="btn-ghost mt-5"
        >
          Guardar regras
        </button>
        <ZoneErr show={errZone === "rules"} msg={err} />
      </Section>

      {/* 3 — Inventário (acordeão) */}
      <Section
        title="O que entra em cada %"
        mark="pine"
        hint={
          draftDirty && ok
            ? "Tecto usa o rascunho das %. Guarda as regras para fixar. Uma categoria aberta de cada vez."
            : "Inventário do tecto — não move dinheiro. Uma categoria aberta de cada vez."
        }
      >
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {bucketSummaries.map(({ bucket, label, gap, lines }) => {
            const open = openBucket === bucket;
            const draftLine = lineDrafts[bucket];
            return (
              <div key={bucket}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-4 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenBucket(bucket)}
                >
                  <span className="num w-4 shrink-0 text-xs text-ink/35">{open ? "−" : "+"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-ink">{label}</span>
                    <span className="ml-2 text-xs text-ink/40">
                      {ceilingRules[bucket]}% · tecto {kz(gap.ceiling)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      !gap.hasLines ? "text-ink/40" : gap.gap > 1 ? "text-rust" : "text-pine"
                    }`}
                  >
                    {gap.hasLines
                      ? gap.gap > 1
                        ? `+${kz(gap.gap)}`
                        : gap.gap < -1
                          ? `−${kz(-gap.gap)}`
                          : "ok"
                      : "vazio"}
                  </span>
                </button>

                <CeilingBar planned={gap.planned} ceiling={gap.ceiling} hasLines={gap.hasLines} />

                {open ? (
                  <div className="pb-5 pl-7">
                    <p className="mb-3 text-xs text-ink/40">{BUCKET_HINTS[bucket]}</p>
                    <ul className="space-y-0">
                      {lines.map((line) => (
                        <li
                          key={line.id}
                          className="flex flex-wrap items-end gap-3 border-b border-ink/[0.07] py-3 first:pt-0 last:border-0"
                        >
                          <label className="field-label min-w-[10rem] flex-1">
                            Nome
                            <input
                              className="field text-sm font-normal normal-case tracking-normal text-ink"
                              value={line.name}
                              onChange={(e) => setBudgetLine(line.id, { name: e.target.value })}
                            />
                          </label>
                          <label className="field-label w-36">
                            Valor (Kz)
                            <input
                              className="field num text-sm font-normal normal-case tracking-normal text-ink"
                              inputMode="decimal"
                              value={line.amount}
                              onChange={(e) => {
                                const n = Number(String(e.target.value).replace(",", "."));
                                if (Number.isFinite(n) && n >= 0) setBudgetLine(line.id, { amount: n });
                              }}
                            />
                          </label>
                          <label className="flex items-center gap-2 pb-2 text-sm text-ink/60">
                            <input
                              type="checkbox"
                              checked={line.active}
                              onChange={(e) => setBudgetLine(line.id, { active: e.target.checked })}
                            />
                            Activa
                          </label>
                          <button
                            type="button"
                            className="btn-ghost py-1.5 text-sm"
                            onClick={() => {
                              const r = removeBudgetLine(line.id);
                              if (!r.ok) showErr("lines", r.reason);
                              else clearErr();
                            }}
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <label className="field-label min-w-[10rem] flex-1">
                        Nova linha
                        <input
                          className="field text-sm font-normal normal-case tracking-normal text-ink"
                          placeholder={bucket === "obrigacoes" ? "ex. Renda" : "ex. …"}
                          value={draftLine.name}
                          onChange={(e) =>
                            setLineDrafts((prev) => ({
                              ...prev,
                              [bucket]: { ...prev[bucket], name: e.target.value },
                            }))
                          }
                        />
                      </label>
                      <label className="field-label w-36">
                        Valor (Kz)
                        <input
                          className="field num text-sm font-normal normal-case tracking-normal text-ink"
                          inputMode="decimal"
                          placeholder="0"
                          value={draftLine.amount}
                          onChange={(e) =>
                            setLineDrafts((prev) => ({
                              ...prev,
                              [bucket]: { ...prev[bucket], amount: e.target.value },
                            }))
                          }
                        />
                      </label>
                      <button type="button" className="btn-ghost" onClick={() => onAddLine(bucket)}>
                        Adicionar
                      </button>
                    </div>
                    <ZoneErr show={errZone === "lines"} msg={err} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {/* clique na linha do header já abre; permitir trocar categoria */}
        <div className="mt-3 flex flex-wrap gap-2">
          {RULE_KEYS.map(([bucket, label]) => (
            <button
              key={bucket}
              type="button"
              className={
                openBucket === bucket
                  ? "btn-ghost border-ink/20 bg-wash/60 py-1 text-xs text-ink"
                  : "btn-ghost py-1 text-xs text-ink/45"
              }
              onClick={() => setOpenBucket(bucket)}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* 4 — Distribuir */}
      <Section
        title="Distribuir esta entrada"
        mark="pine"
        hint="Usa as regras já guardadas (não o rascunho). Não distribui o stock inteiro."
      >
        {draftDirty ? (
          <p className="mb-4 text-sm text-rust">
            Há % em rascunho — guarda as regras acima, senão a distribuição usa o método antigo.
          </p>
        ) : null}
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
        <ZoneErr show={errZone === "entry"} msg={err} />
      </Section>

      {/* 5 — Bolsos */}
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
                className="flex flex-wrap items-end gap-4 border-b border-ink/[0.07] py-5 first:pt-0 last:border-0"
              >
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-medium text-ink">{e.name}</p>
                  <p className="mt-0.5 text-xs text-ink/45">{e.purpose}</p>
                  <p className="mt-2 text-sm text-ink/70">
                    Saldo <Money n={saldo} />
                    {gasto > 0 ? (
                      <>
                        {" "}
                        · gasto mês <Money n={gasto} tone="out" />
                      </>
                    ) : null}
                  </p>
                </div>
                <label className="field-label w-36">
                  Meter (Kz)
                  <input
                    className="field num text-sm font-normal normal-case tracking-normal text-ink"
                    inputMode="decimal"
                    value={amounts[e.id] ?? ""}
                    onChange={(ev) => setAmounts((a) => ({ ...a, [e.id]: ev.target.value }))}
                  />
                </label>
                <button type="button" className="btn-ghost" onClick={() => meterBolso(e.id)}>
                  Meter
                </button>
              </li>
            );
          })}
        </ul>

        <TotalRow label="Total bolsos" mark="pine">
          <Money n={nosBolsos} />
        </TotalRow>
        <ZoneErr show={errZone === "bolsos"} msg={err} />
      </Section>
    </div>
  );
}

function emptyLineDrafts(): Record<BudgetBucket, { name: string; amount: string }> {
  return {
    obrigacoes: { name: "", amount: "" },
    reserva: { name: "", amount: "" },
    investimento: { name: "", amount: "" },
    despesas: { name: "", amount: "" },
    lazer: { name: "", amount: "" },
  };
}

function ZoneErr({ show, msg }: { show: boolean; msg: string }) {
  if (!show || !msg) return null;
  return <p className="mt-3 text-sm text-rust">{msg}</p>;
}

/** Barra linhas vs tecto — overflow em rust. */
function CeilingBar({
  planned,
  ceiling,
  hasLines,
}: {
  planned: number;
  ceiling: number;
  hasLines: boolean;
}) {
  if (!hasLines || ceiling <= 0) {
    return <div className="mb-1 h-1 w-full bg-ink/[0.06]" aria-hidden />;
  }
  const pct = Math.min(100, (planned / ceiling) * 100);
  const over = planned > ceiling + 1;
  return (
    <div className="mb-1 h-1 w-full bg-ink/[0.06]" title={`${kz(planned)} / ${kz(ceiling)}`} aria-hidden>
      <div
        className={`h-full transition-[width] duration-300 ${over ? "bg-rust/70" : "bg-pine/55"}`}
        style={{ width: `${over ? 100 : pct}%` }}
      />
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
