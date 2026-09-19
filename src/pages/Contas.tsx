import { useState, type FormEvent } from "react";
import {
  canEditAccountOpening,
  canEditPartyOpening,
  custodyInAccount,
  custodyLiquidity,
  liquidityByEntity,
  liquidityOf,
  ownLiquidityOf,
  partiesSum,
  partyOf,
  personalOwnLiquidity,
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
  const dividaPropria = state.parties.filter(
    (p) => p.entityId === "pessoal" && p.side === "pagar" && p.ownership !== "custody",
  );
  const custodiaParties = state.parties.filter(
    (p) => p.entityId === "pessoal" && p.side === "pagar" && p.ownership === "custody",
  );
  const liq = liquidityByEntity(state, "pessoal");
  const teuTotal = personalOwnLiquidity(state);
  const sumReceber = partiesSum(state, "pessoal", "receber");
  const sumPagarOwn = partiesSum(state, "pessoal", "pagar", "own");
  const custodia = custodyLiquidity(state);
  const personalAccounts = state.accounts.filter((a) => a.entityId === "pessoal");
  const [accountId, setAccountId] = useState(personalAccounts[0]?.id ?? "bai");
  const cashNaConta = liquidityOf(state, accountId);
  const teuNaConta = ownLiquidityOf(state, accountId);
  const custodiaNaConta = custodyInAccount(state, accountId);

  return (
    <div className="page">
      <PageHeader title="Contas pessoais" mark="pine">
        O saldo do banco mistura o teu dinheiro com custódia. Em cada conta vês separado: total ·
        custódia · teu. Devolver custódia só reduz a fatia de terceiros — o «teu» mantém-se.
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity="pessoal" />
      </div>

      <Section
        title="Liquidez"
        mark="pine"
        hint={`Bruto ${liq.toLocaleString("pt-PT")} Kz · custódia ${custodia.toLocaleString("pt-PT")} Kz (não é teu).`}
      >
        <div className="mb-2 grid grid-cols-[minmax(0,1.2fr)_minmax(5.5rem,0.7fr)_minmax(5.5rem,0.7fr)_minmax(5.5rem,0.7fr)] gap-x-3 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink/30">
          <span>Conta</span>
          <span className="text-right">Total</span>
          <span className="text-right">Custódia</span>
          <span className="text-right">Teu</span>
        </div>
        <ul>
          {personalAccounts.map((a) => {
            const editable = canEditAccountOpening(state, a.id);
            const total = liquidityOf(state, a.id);
            const cust = custodyInAccount(state, a.id);
            const own = ownLiquidityOf(state, a.id);
            const over = cust > total + 0.001;
            return (
              <li key={a.id} className="border-b border-ink/[0.07] py-2.5">
                <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(5.5rem,0.7fr)_minmax(5.5rem,0.7fr)_minmax(5.5rem,0.7fr)] items-baseline gap-x-3">
                  <span className="truncate text-sm text-ink/70">{a.name}</span>
                  <span className="text-right">
                    <Money n={total} />
                  </span>
                  <span className="text-right">
                    <Money n={cust} tone="mute" />
                  </span>
                  <span className="text-right">
                    <Money n={own} tone={own > 0 ? "plain" : "mute"} />
                  </span>
                </div>
                {editable ? (
                  <label className="mt-1.5 flex max-w-xs items-baseline gap-2">
                    <span className="shrink-0 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink/30">
                      opening
                    </span>
                    <input
                      className="field num m-0 min-w-0 flex-1 py-1 text-right text-sm"
                      defaultValue={a.opening}
                      onBlur={(e) =>
                        setAccountOpening(a.id, Number(String(e.target.value).replace(",", ".")) || 0)
                      }
                    />
                  </label>
                ) : null}
                {over ? (
                  <p className="mt-1 text-[0.7rem] text-rust">
                    Custódia atribuída a esta conta &gt; saldo — diz onde está cada um em baixo.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <TotalRow label="Teu (próprio)" mark="pine">
          <Money n={teuTotal} />
        </TotalRow>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/45">
          <span>
            Custódia: <Money n={custodia} tone="mute" />
          </span>
          <span>
            Bruto nos bancos: <Money n={liq} tone="mute" />
          </span>
        </p>
      </Section>

      <div className="mt-8 max-w-sm">
        <label className="field-label">
          Conta de caixa (pagar / receber)
          <Select
            value={accountId}
            onChange={setAccountId}
            options={personalAccounts.map((a) => ({
              value: a.id,
              label: `${a.name} · teu ${ownLiquidityOf(state, a.id).toLocaleString("pt-PT")}`,
            }))}
          />
        </label>
        <p className="mt-2 text-xs leading-relaxed text-ink/45">
          Nesta conta: total <Money n={cashNaConta} tone="mute" /> · custódia{" "}
          <Money n={custodiaNaConta} tone="mute" /> · teu <Money n={teuNaConta} tone="mute" />.
          Dívida própria sai do «teu». Custódia devolve-se na conta onde está marcada.
        </p>
      </div>

      <div className="mt-14 grid gap-14 md:grid-cols-2 md:items-stretch md:gap-16">
        <div className="flex flex-col">
          <div className="section-head">
            <Mark tone="pine" />
            <h2 className="section-title">A receber</h2>
            <span className="sep-line ml-2 hidden flex-1 sm:block" />
          </div>
          <AddPartyForm side="receber" onAdd={(draft) => addParty(draft)} />
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
            <h2 className="section-title">Dívida própria</h2>
            <span className="sep-line ml-2 hidden flex-1 sm:block" />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink/45">
            O que <em>tu</em> deves. Sai do «teu» da conta seleccionada.
          </p>
          <AddPartyForm side="pagar" onAdd={(draft) => addParty(draft)} />
          <ul className="mt-4 flex-1 space-y-0">
            {dividaPropria.map((p) => (
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
          <TotalRow label="Total dívida própria" mark="rust" className="mt-auto">
            <Money n={sumPagarOwn} tone="out" />
          </TotalRow>
        </div>
      </div>

      <Section
        title="Custódia (terceiros)"
        mark="soft"
        className="mt-14"
        hint="Marca em que conta está o dinheiro deles. «Devolver» sai dessa conta e o teu saldo próprio nessa conta não muda."
      >
        <AddPartyForm
          side="pagar"
          accounts={personalAccounts.map((a) => ({ id: a.id, name: a.name }))}
          onAdd={(draft) => addParty({ ...draft, ownership: "custody" })}
          forceCustody
        />
        <ul className="mt-4 space-y-0">
          {custodiaParties.map((p) => {
            const held = p.heldInAccountId ?? accountId;
            return (
              <PartyRow
                key={p.id}
                party={p}
                value={partyOf(state, p.id)}
                canEditOpening={canEditPartyOpening(state, p.id)}
                onSetOpening={(n) => setParty(p.id, { opening: n, unknown: n === 0 ? p.unknown : false })}
                onAction={(amount) =>
                  payParty({
                    partyId: p.id,
                    accountId: held,
                    amount,
                  })
                }
                actionLabel="Devolver"
                actionHint={
                  p.heldInAccountId
                    ? `Sai de «${personalAccounts.find((a) => a.id === p.heldInAccountId)?.name ?? p.heldInAccountId}». O «teu» nessa conta mantém-se.`
                    : "Escolhe primeiro a conta onde está este dinheiro."
                }
                accounts={personalAccounts.map((a) => ({ id: a.id, name: a.name }))}
                onSetHeldAccount={(id) => setParty(p.id, { heldInAccountId: id || undefined })}
                onRemove={() => removeParty(p.id)}
              />
            );
          })}
        </ul>
        {custodiaParties.length === 0 ? (
          <p className="mt-4 text-sm text-ink/40">Sem custódia registada.</p>
        ) : null}
        <TotalRow label="Total custódia" mark="soft" className="mt-6">
          <Money n={custodia} tone="mute" />
        </TotalRow>
      </Section>
    </div>
  );
}

function AddPartyForm({
  side,
  onAdd,
  allowCustody = false,
  forceCustody = false,
  accounts = [],
}: {
  side: "receber" | "pagar";
  onAdd: (p: Omit<Party, "id">) => { ok: boolean; reason?: string };
  allowCustody?: boolean;
  forceCustody?: boolean;
  accounts?: { id: string; name: string }[];
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [ownership, setOwnership] = useState<OwnershipClass>(forceCustody ? "custody" : "own");
  const [heldInAccountId, setHeldInAccountId] = useState(accounts[0]?.id ?? "");
  const [err, setErr] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const opening = Number(String(amount).replace(",", ".")) || 0;
    const r = onAdd({
      entityId: "pessoal",
      name,
      side,
      opening,
      ownership: forceCustody ? "custody" : allowCustody ? ownership : "own",
      unknown: opening === 0,
      heldInAccountId: forceCustody && heldInAccountId ? heldInAccountId : undefined,
    });
    if (!r.ok) {
      setErr(r.reason ?? "Não foi possível adicionar.");
      return;
    }
    setName("");
    setAmount("");
    setOwnership(forceCustody ? "custody" : "own");
    setErr("");
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 border border-ink/10 bg-wash/40 p-3">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink/40">
        {forceCustody
          ? "Nova custódia (terceiros)"
          : side === "receber"
            ? "Nova pessoa que te deve"
            : "Nova dívida própria"}
      </p>
      <label className="field-label m-0">
        Nome
        <input
          className="field m-0 text-sm font-normal normal-case tracking-normal text-ink"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={forceCustody ? "ex. Lenu" : side === "receber" ? "ex. João" : "ex. Tuni"}
          required
        />
      </label>
      <div className={`grid gap-3 ${allowCustody && !forceCustody ? "grid-cols-2" : forceCustody ? "grid-cols-2" : ""}`}>
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
        {forceCustody && accounts.length ? (
          <label className="field-label m-0">
            Está em
            <Select
              value={heldInAccountId}
              onChange={setHeldInAccountId}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </label>
        ) : null}
        {allowCustody && !forceCustody ? (
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
  actionHint,
  accounts,
  onSetHeldAccount,
  onRemove,
}: {
  party: Party;
  value: number;
  canEditOpening: boolean;
  onSetOpening: (n: number) => void;
  onAction: (amount: number) => { ok: boolean; reason?: string };
  actionLabel: string;
  actionHint?: string;
  accounts?: { id: string; name: string }[];
  onSetHeldAccount?: (accountId: string) => void;
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
    if (party.ownership === "custody" && !party.heldInAccountId) {
      setErr("Indica em que conta está este dinheiro.");
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
      {onSetHeldAccount && accounts?.length ? (
        <label className="mt-2 block max-w-xs field-label">
          Está em
          <Select
            value={party.heldInAccountId ?? ""}
            onChange={onSetHeldAccount}
            placeholder="Escolher conta…"
            options={[
              { value: "", label: "—" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </label>
      ) : null}
      {value > 0 ? (
        <div className="mt-2">
          {actionHint ? <p className="mb-1.5 text-[0.7rem] text-ink/40">{actionHint}</p> : null}
          <div className="flex flex-wrap items-end gap-2">
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
