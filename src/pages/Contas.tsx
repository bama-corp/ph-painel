import { liquidityByEntity, liquidityOf, partiesSum, partyOf } from "../domain/engine";
import { useStore } from "../domain/store";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { Mark, PageHeader, Section, TotalRow } from "../ui/Page";

export function Contas() {
  const { state, setParty, setAccountOpening } = useStore();
  const receber = state.parties.filter((p) => p.entityId === "pessoal" && p.side === "receber");
  const pagar = state.parties.filter((p) => p.entityId === "pessoal" && p.side === "pagar");
  const liq = liquidityByEntity(state, "pessoal");
  const sumReceber = partiesSum(state, "pessoal", "receber");
  const sumPagar = partiesSum(state, "pessoal", "pagar");

  return (
    <div className="page">
      <PageHeader title="Contas pessoais" mark="pine">
        Onde o dinheiro vive (bancos) não é o que ele pode fazer (bolsos). Aqui só o sítio e as
        pessoas. Bolsos no Orçamento.
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity="pessoal" />
      </div>

      <Section title="Liquidez" mark="pine">
        <ul>
          {state.accounts
            .filter((a) => a.entityId === "pessoal")
            .map((a) => (
              <li
                key={a.id}
                className="grid grid-cols-[minmax(0,1.4fr)_9.5rem_minmax(7.5rem,1fr)] items-baseline gap-x-6 border-b border-ink/[0.07] py-2.5"
              >
                <span className="truncate text-sm text-ink/70">{a.name}</span>
                <label className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink/30">
                    saldo
                  </span>
                  <input
                    className="field num m-0 min-w-0 flex-1 py-1 text-right text-sm"
                    defaultValue={a.opening}
                    onBlur={(e) =>
                      setAccountOpening(a.id, Number(String(e.target.value).replace(",", ".")) || 0)
                    }
                  />
                </label>
                <span className="text-right">
                  <Money n={liquidityOf(state, a.id)} />
                </span>
              </li>
            ))}
        </ul>
        <TotalRow label="Total" mark="pine">
          <Money n={liq} />
        </TotalRow>
      </Section>

      <div className="mt-14 grid gap-14 md:grid-cols-2 md:items-stretch md:gap-16">
        <div className="flex flex-col">
          <div className="section-head">
            <Mark tone="pine" />
            <h2 className="section-title">A receber</h2>
            <span className="sep-line ml-2 hidden flex-1 sm:block" />
          </div>
          <ul className="mt-6 flex-1 space-y-0">
            {receber.map((p) => (
              <PartyRow
                key={p.id}
                name={p.name}
                unknown={p.unknown}
                value={partyOf(state, p.id)}
                onSet={(n) => setParty(p.id, { opening: n, unknown: n === 0 ? p.unknown : false })}
              />
            ))}
          </ul>
          <TotalRow label="Total" mark="pine" className="mt-auto">
            <Money n={sumReceber} tone="in" />
          </TotalRow>
        </div>
        <div className="flex flex-col">
          <div className="section-head">
            <span className="mark" aria-hidden style={{ background: "rgb(var(--rust))" }} />
            <h2 className="section-title">A pagar</h2>
            <span className="sep-line ml-2 hidden flex-1 sm:block" />
          </div>
          <ul className="mt-6 flex-1 space-y-0">
            {pagar.map((p) => (
              <PartyRow
                key={p.id}
                name={p.name}
                unknown={p.unknown}
                value={partyOf(state, p.id)}
                onSet={(n) => setParty(p.id, { opening: n, unknown: n === 0 ? p.unknown : false })}
              />
            ))}
          </ul>
          <TotalRow label="Total" mark="ink" className="mt-auto">
            <Money n={sumPagar} tone="out" />
          </TotalRow>
        </div>
      </div>
    </div>
  );
}

function PartyRow({
  name,
  unknown,
  value,
  onSet,
}: {
  name: string;
  unknown?: boolean;
  value: number;
  onSet: (n: number) => void;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_8.5rem] items-baseline gap-x-4 border-b border-ink/[0.07] py-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink/80">
          {name}
          {unknown && value === 0 ? (
            <span className="ml-2 text-[0.68rem] uppercase tracking-[0.12em] text-copper">
              por confirmar
            </span>
          ) : null}
        </p>
      </div>
      <div className="text-right">
        <Money n={value} />
        <input
          className="field num m-0 mt-1 w-full py-1 text-right text-sm"
          defaultValue={value || ""}
          placeholder="0"
          onBlur={(e) => onSet(Number(String(e.target.value).replace(",", ".")) || 0)}
        />
      </div>
    </li>
  );
}
