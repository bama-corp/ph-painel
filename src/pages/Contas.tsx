import { useState, type FormEvent } from "react";
import {
  canEditAccountOpening,
  canEditPartyOpening,
  custodyLiquidity,
  liquidityByEntity,
  liquidityOf,
  partiesSum,
  partyOf,
} from "../domain/engine";
import { useStore } from "../domain/store";
import type { OwnershipClass, Party } from "../domain/types";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { Mark, PageHeader, Section, TotalRow } from "../ui/Page";
import { Select } from "../ui/Select";

const OWN_LABEL: Record<OwnershipClass, string> = {
  own: "próprio",
  custody: "custódia",
  company: "empresa",
};

export function Contas() {
  const { state, setParty, setAccountOpening, payParty, collectParty, addParty, removeParty } = useStore();
  const receber = state.parties.filter((p) => p.entityId === "pessoal" && p.side === "receber");
  const pagar = state.parties.filter((p) => p.entityId === "pessoal" && p.side === "pagar");
  const liq = liquidityByEntity(state, "pessoal");
  const sumReceber = partiesSum(state, "pessoal", "receber");
  const sumPagarOwn = partiesSum(state, "pessoal", "pagar", "own");
  const custodia = custodyLiquidity(state);
  const personalAccounts = state.accounts.filter((a) => a.entityId === "pessoal");
  const [accountId, setAccountId] = useState(personalAccounts[0]?.id ?? "bai");

  return (
    <div className="page">
      <PageHeader title="Contas pessoais" mark="pine">
        Saldo vivo = opening + movimentos. Podes adicionar quem te deve e a quem deves. Custódia
        (terceiros) não entra no orçamento.
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity="pessoal" />
      </div>

      <Section title="Liquidez" mark="pine" hint={`Custódia embutida nos bancos: ${custodia.toLocaleString("pt-PT")} Kz.`}>
        <ul>
          {personalAccounts.map((a) => {
            const editable = canEditAccountOpening(state, a.id);
            return (
              <li
                key={a.id}
                className="grid grid-cols-[minmax(0,1.4fr)_9.5rem_minmax(7.5rem,1fr)] items-baseline gap-x-6 border-b border-ink/[0.07] py-2.5"
              >
                <span className="truncate text-sm text-ink/70">{a.name}</span>
                <label className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink/30">
                    opening
                  </span>
                  <input
                    className="field num m-0 min-w-0 flex-1 py-1 text-right text-sm disabled:opacity-40"
                    defaultValue={a.opening}
                    disabled={!editable}
                    title={editable ? "Opening editável" : "Bloqueado — usa ajuste auditado"}
                    onBlur={(e) =>
                      setAccountOpening(a.id, Number(String(e.target.value).replace(",", ".")) || 0)
                    }
                  />
                </label>
                <span className="text-right">
                  <Money n={liquidityOf(state, a.id)} />
                </span>
              </li>
            );
          })}
        </ul>
        <TotalRow label="Total" mark="pine">
          <Money n={liq} />
        </TotalRow>
      </Section>

      <div className="mt-8 max-w-xs">
        <label className="field-label">
          Conta para pagar / receber
          <Select
            value={accountId}
            onChange={setAccountId}
            options={personalAccounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        </label>
      </div>

      <div className="mt-14 grid gap-14 md:grid-cols-2 md:items-stretch md:gap-16">
        <div className="flex flex-col">
          <div className="section-head">
            <Mark tone="pine" />
            <h2 className="section-title">A receber</h2>
            <span className="sep-line ml-2 hidden flex-1 sm:block" />
          </div>
          <AddPartyForm
            side="receber"
            onAdd={(draft) => addParty(draft)}
          />
          <ul className="mt-4 flex-1 space-y-0">
            {receber.map((p) => (
              <PartyRow
                key={p.id}
                party={p}
                value={partyOf(state, p.id)}
                canEditOpening={canEditPartyOpening(state, p.id)}
                onSetOpening={(n) => setParty(p.id, { opening: n, unknown: n === 0 ? p.unknown : false })}
                onAction={(amount) => collectParty({ partyId: p.id, accountId, amount })}
                actionLabel="Receber"
                onRemove={() => removeParty(p.id)}
              />
            ))}
          </ul>
          <TotalRow label="Total" mark="pine" className="mt-auto">
            <Money n={sumReceber} tone="in" />
          </TotalRow>
        </div>
        <div className="flex flex-col">
          <div className="section-head">
            <Mark tone="rust" />
            <h2 className="section-title">A pagar</h2>
            <span className="sep-line ml-2 hidden flex-1 sm:block" />
          </div>
          <AddPartyForm
            side="pagar"
            onAdd={(draft) => addParty(draft)}
            allowCustody
          />
          <ul className="mt-4 flex-1 space-y-0">
            {pagar.map((p) => (
              <PartyRow
                key={p.id}
                party={p}
                value={partyOf(state, p.id)}
                canEditOpening={canEditPartyOpening(state, p.id)}
                onSetOpening={(n) => setParty(p.id, { opening: n, unknown: n === 0 ? p.unknown : false })}
                onAction={(amount) => payParty({ partyId: p.id, accountId, amount })}
                actionLabel="Pagar"
                onRemove={() => removeParty(p.id)}
              />
            ))}
          </ul>
          <TotalRow label="Dívida própria" mark="rust" className="mt-auto">
            <Money n={sumPagarOwn} tone="out" />
          </TotalRow>
          <p className="mt-2 text-xs text-ink/45">
            Custódia (terceiros): <Money n={custodia} tone="mute" />
          </p>
        </div>
      </div>
    </div>
  );
}

function AddPartyForm({
  side,
  onAdd,
  allowCustody = false,
}: {
  side: "receber" | "pagar";
  onAdd: (p: Omit<Party, "id">) => { ok: boolean; reason?: string };
  allowCustody?: boolean;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [ownership, setOwnership] = useState<OwnershipClass>("own");
  const [err, setErr] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const opening = Number(String(amount).replace(",", ".")) || 0;
    const r = onAdd({
      entityId: "pessoal",
      name,
      side,
      opening,
      ownership: allowCustody ? ownership : "own",
      unknown: opening === 0,
    });
    if (!r.ok) {
      setErr(r.reason ?? "Não foi possível adicionar.");
      return;
    }
    setName("");
    setAmount("");
    setOwnership("own");
    setErr("");
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 border border-ink/10 bg-wash/40 p-3">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink/40">
        {side === "receber" ? "Nova pessoa que te deve" : "Nova dívida / terceiros"}
      </p>
      <label className="field-label m-0">
        Nome
        <input
          className="field m-0 text-sm font-normal normal-case tracking-normal text-ink"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={side === "receber" ? "ex. João" : "ex. Tuni / Lenu"}
          required
        />
      </label>
      <div className={`grid gap-3 ${allowCustody ? "grid-cols-2" : ""}`}>
        <label className="field-label m-0">
          Valor (Kz)
          <input
            className="field num m-0 text-sm"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </label>
        {allowCustody ? (
          <label className="field-label m-0">
            Tipo
            <Select
              value={ownership}
              onChange={setOwnership}
              options={[
                { value: "own", label: "Dívida própria" },
                { value: "custody", label: "Custódia (terceiros)" },
              ]}
            />
          </label>
        ) : null}
      </div>
      {err ? <p className="text-xs text-rust">{err}</p> : null}
      <button type="submit" className="btn-ghost py-1.5 text-sm">
        Adicionar
      </button>
    </form>
  );
}

function PartyRow({
  party,
  value,
  canEditOpening,
  onSetOpening,
  onAction,
  actionLabel,
  onRemove,
}: {
  party: Party;
  value: number;
  canEditOpening: boolean;
  onSetOpening: (n: number) => void;
  onAction: (amount: number) => { ok: boolean; reason?: string };
  actionLabel: string;
  onRemove: () => { ok: boolean; reason?: string };
}) {
  const [payRaw, setPayRaw] = useState("");
  const [err, setErr] = useState("");

  function runPay() {
    const n = Number(String(payRaw).replace(",", "."));
    if (!n || n <= 0) {
      setErr("Valor inválido.");
      return;
    }
    const r = onAction(n);
    if (!r.ok) {
      setErr(r.reason ?? "Falhou.");
      return;
    }
    setPayRaw("");
    setErr("");
  }

  function runRemove() {
    const r = onRemove();
    if (!r.ok) setErr(r.reason ?? "Não removeu.");
    else setErr("");
  }

  return (
    <li className="border-b border-ink/[0.07] py-3">
      <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-baseline gap-x-4">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink/80">
            {party.name}
            <span className="ml-2 text-[0.65rem] uppercase tracking-[0.12em] text-ink/35">
              {OWN_LABEL[party.ownership]}
            </span>
            {party.unknown && value === 0 ? (
              <span className="ml-2 text-[0.68rem] uppercase tracking-[0.12em] text-copper">
                por confirmar
              </span>
            ) : null}
          </p>
        </div>
        <div className="text-right">
          <Money n={value} />
          {canEditOpening ? (
            <input
              className="field num m-0 mt-1 w-full py-1 text-right text-sm"
              defaultValue={party.opening || ""}
              placeholder="opening"
              onBlur={(e) => onSetOpening(Number(String(e.target.value).replace(",", ".")) || 0)}
            />
          ) : null}
        </div>
      </div>
      {value > 0 ? (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <input
            className="field num m-0 w-28 py-1 text-sm"
            inputMode="decimal"
            placeholder="Valor"
            value={payRaw}
            onChange={(e) => setPayRaw(e.target.value)}
          />
          <button type="button" className="btn-ghost py-1 text-sm" onClick={runPay}>
            {actionLabel}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <button type="button" className="text-xs text-ink/40 hover:text-rust" onClick={runRemove}>
            Remover
          </button>
        </div>
      )}
      {err ? <p className="mt-1 text-xs text-rust">{err}</p> : null}
    </li>
  );
}
