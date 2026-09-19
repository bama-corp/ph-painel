import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import {
  companyMonthOutlook,
  equity,
  KIND_LABEL,
  liquidityByEntity,
  liquidityOf,
  partiesSum,
  partyOf,
  recurringOf,
  recurringPlanned,
} from "../domain/engine";
import { ENTITY, type EntityTone } from "../domain/labels";
import { formatDatePt, kz, monthLabel } from "../domain/money";
import { useStore } from "../domain/store";
import type { CostNature, EntityId, RoveProduct } from "../domain/types";
import { Money } from "./Money";
import { Section, Stat, TotalRow } from "./Page";
import { Select } from "./Select";

const NATURE_OPTS: { value: CostNature; label: string }[] = [
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
  { value: "investimento", label: "Investimento" },
  { value: "retirada", label: "Retirada" },
];

const PRODUCT_OPTS: { value: RoveProduct | "geral" | ""; label: string }[] = [
  { value: "", label: "— (geral empresa)" },
  { value: "geral", label: "Geral Plural" },
  { value: "netflix", label: "Netflix" },
  { value: "iptv", label: "IPTV" },
];

/** KPIs + lucro esperado (planeado vs registado). */
export function CompanyOutlook({
  entity,
  extra,
}: {
  entity: Exclude<EntityId, "pessoal">;
  extra?: ReactNode;
}) {
  const { state } = useStore();
  const meta = ENTITY[entity];
  const o = companyMonthOutlook(state, entity);
  const tone = meta.tone;
  const caixa = liquidityByEntity(state, entity);

  return (
    <dl className="mt-14 grid gap-10 sm:grid-cols-2">
      <Stat label="Caixa actual" n={caixa} mark={tone} />
      <Stat label={`Receita ${monthLabel(state.month)}`} n={o.receita} mark={tone} />
      <Stat label="Despesas registadas" n={o.desp} mark="soft" />
      <Stat
        label="Lucro registado"
        n={o.lucroRegistado}
        mark={tone}
        note={
          o.porRegistar > 0
            ? `Ainda faltam ~${kz(o.porRegistar)} de custos planeados por registar.`
            : undefined
        }
      />
      <Stat
        label="Custos planeados (recorrentes)"
        n={o.planned}
        mark="soft"
        note="Inventário abaixo — não move caixa até registares no mês."
      />
      <Stat
        label="Lucro esperado"
        n={o.lucroEsperado}
        mark={o.lucroEsperado < o.lucroRegistado - 1 ? "rust" : tone}
        note="Receita − max(registado, planeado). Se o planeado > registado, o lucro «real» ainda vai cair."
      />
      <Stat label="Equity" n={o.equity} mark={tone} note="Caixa + a receber − a pagar + bens." />
      {o.ownerDue > 0 ? (
        <Stat
          label="Conta corrente do proprietário"
          n={o.ownerDue}
          mark={tone}
          note="O dono deve isto à empresa. Reembolso ≠ pró-labore."
        />
      ) : null}
      {extra}
    </dl>
  );
}

/** Contas da empresa + parties a receber/pagar. */
export function CompanyAccounts({ entity }: { entity: Exclude<EntityId, "pessoal"> }) {
  const { state } = useStore();
  const meta = ENTITY[entity];
  const contas = state.accounts.filter((a) => a.entityId === entity);
  const parties = state.parties.filter((p) => p.entityId === entity);
  const receber = partiesSum(state, entity, "receber");
  const pagar = partiesSum(state, entity, "pagar");

  return (
    <>
      <Section title="Contas" mark={meta.tone}>
        <ul>
          {contas.map((a) => (
            <li key={a.id} className="ledger-row">
              <span className="text-ink/65">{a.name}</span>
              <Money n={liquidityOf(state, a.id)} />
            </li>
          ))}
        </ul>
        <TotalRow label="Caixa" mark={meta.tone}>
          <Money n={liquidityByEntity(state, entity)} />
        </TotalRow>
      </Section>

      {parties.length > 0 ? (
        <Section
          title="Parties"
          mark={meta.tone}
          hint="A receber / a pagar desta empresa (não é liquidez pessoal)."
        >
          <ul>
            {parties.map((p) => (
              <li key={p.id} className="ledger-row">
                <span className="text-ink/65">
                  {p.name}{" "}
                  <span className="text-ink/35">
                    ({p.side === "receber" ? "a receber" : "a pagar"})
                  </span>
                </span>
                <Money
                  n={partyOf(state, p.id)}
                  tone={p.side === "receber" ? "in" : "out"}
                />
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <div className="ledger-row">
              <span className="text-ink/65">A receber</span>
              <Money n={receber} tone="in" />
            </div>
            <div className="ledger-row">
              <span className="text-ink/65">A pagar</span>
              <Money n={pagar} tone="out" />
            </div>
          </div>
          <TotalRow label="Equity" mark={meta.tone}>
            <Money n={equity(state, entity)} />
          </TotalRow>
        </Section>
      ) : null}
    </>
  );
}

/** Inventário de custos recorrentes — CRUD por empresa. */
export function CompanyRecurring({
  entity,
  showProduct = false,
}: {
  entity: Exclude<EntityId, "pessoal">;
  showProduct?: boolean;
}) {
  const { state, addRecurring, setRecurring, removeRecurring } = useStore();
  const meta = ENTITY[entity];
  const rows = (state.recurring ?? []).filter((r) => r.entityId === entity);
  const planned = recurringPlanned(state, entity);
  const activeCount = recurringOf(state, entity).length;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [nature, setNature] = useState<CostNature>("fixo");
  const [product, setProduct] = useState<RoveProduct | "geral" | "">("");
  const [err, setErr] = useState("");

  function onAdd() {
    const n = Number(String(amount).replace(",", ".")) || 0;
    const r = addRecurring({
      entityId: entity,
      name,
      amount: n,
      nature,
      product: showProduct && product ? product : undefined,
      active: true,
    });
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setName("");
    setAmount("");
    setErr("");
  }

  return (
    <Section
      title="Custos recorrentes"
      mark={meta.tone as EntityTone}
      hint="Planeamento mensal — inventário do que a empresa deve pagar todo o mês. Só entra no lucro quando registares a despesa."
    >
      <ul className="space-y-0">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-end gap-3 border-b border-ink/[0.07] py-3 first:pt-0 last:border-0"
          >
            <label className="field-label min-w-[9rem] flex-1">
              Nome
              <input
                className="field text-sm font-normal normal-case tracking-normal text-ink"
                value={row.name}
                onChange={(e) => setRecurring(row.id, { name: e.target.value })}
              />
            </label>
            <label className="field-label form-amount">
              Valor (Kz)
              <input
                className="field num text-sm font-normal normal-case tracking-normal text-ink"
                inputMode="decimal"
                value={row.amount}
                onChange={(e) => {
                  const n = Number(String(e.target.value).replace(",", "."));
                  if (Number.isFinite(n) && n >= 0) setRecurring(row.id, { amount: n });
                }}
              />
            </label>
            <label className="field-label form-amount">
              Natureza
              <Select
                value={row.nature}
                onChange={(v) => setRecurring(row.id, { nature: v as CostNature })}
                options={NATURE_OPTS}
              />
            </label>
            {showProduct ? (
              <label className="field-label form-amount">
                Produto
                <Select
                  value={row.product ?? ""}
                  onChange={(v) =>
                    setRecurring(row.id, {
                      product: (v || undefined) as RoveProduct | "geral" | undefined,
                    })
                  }
                  options={PRODUCT_OPTS}
                />
              </label>
            ) : null}
            <label className="flex items-center gap-2 pb-2 text-sm text-ink/60">
              <input
                type="checkbox"
                checked={row.active !== false}
                onChange={(e) => setRecurring(row.id, { active: e.target.checked })}
              />
              Activo
            </label>
            <button
              type="button"
              className="btn-ghost py-1.5 text-sm"
              onClick={() => {
                const r = removeRecurring(row.id);
                if (!r.ok) setErr(r.reason);
                else setErr("");
              }}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="text-sm text-ink/45">
          Ainda sem custos planeados — adiciona o fixo (renda, salários, plataformas…).
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="field-label min-w-[9rem] flex-1">
          Novo custo
          <input
            className="field text-sm font-normal normal-case tracking-normal text-ink"
            placeholder="ex. Renda loja"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field-label form-amount">
          Valor (Kz)
          <input
            className="field num text-sm font-normal normal-case tracking-normal text-ink"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="field-label form-amount">
          Natureza
          <Select value={nature} onChange={setNature} options={NATURE_OPTS} />
        </label>
        {showProduct ? (
          <label className="field-label form-amount">
            Produto
            <Select value={product} onChange={setProduct} options={PRODUCT_OPTS} />
          </label>
        ) : null}
        <button type="button" className="btn-ghost" onClick={onAdd}>
          Adicionar
        </button>
      </div>

      <TotalRow label={`Planeado (${activeCount} activos)`} mark={meta.tone}>
        <Money n={planned} />
      </TotalRow>
      {err ? <p className="mt-3 text-sm text-rust">{err}</p> : null}
    </Section>
  );
}

/** Últimos movimentos desta empresa — com apagar (correcção). */
export function CompanyRecentMoves({
  entity,
  limit = 12,
}: {
  entity: Exclude<EntityId, "pessoal">;
  limit?: number;
}) {
  const { state, removeMovement } = useStore();
  const meta = ENTITY[entity];
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const rows = [...state.movements]
    .filter((m) => m.entityId === entity)
    .reverse()
    .slice(0, limit);

  function onDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      setErr("");
      return;
    }
    const r = removeMovement(id);
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setConfirmId(null);
    setErr("");
  }

  return (
    <Section
      title="Últimos movimentos"
      mark={meta.tone}
      hint={
        <>
          Errou um registo? Apaga aqui (dois cliques: Apagar → Confirmar). Lista completa em{" "}
          <Link to="/movimentos" className="border-b border-ink/25 hover:border-ink">
            Registo
          </Link>
          .
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-ink/45">Ainda sem movimentos nesta empresa.</p>
      ) : (
        <ul className="space-y-0">
          {rows.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink/[0.07] py-3 first:pt-0 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">
                  {KIND_LABEL[m.kind]} · <Money n={m.amount} />
                </p>
                <p className="mt-0.5 text-xs text-ink/40">
                  {formatDatePt(m.at)}
                  {m.category ? ` · ${m.category}` : ""}
                  {m.note ? ` · ${m.note}` : ""}
                </p>
              </div>
              <button
                type="button"
                className={`btn-ghost shrink-0 py-1 text-xs ${
                  confirmId === m.id ? "border-rust/40 text-rust" : "text-ink/40"
                }`}
                onClick={() => onDelete(m.id)}
              >
                {confirmId === m.id ? "Confirmar apagar" : "Apagar"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {err ? <p className="mt-3 text-sm text-rust">{err}</p> : null}
    </Section>
  );
}
