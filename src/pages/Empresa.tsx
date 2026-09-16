import { despesaMes, liquidityByEntity, liquidityOf, lucroMes, receitaMes } from "../domain/engine";
import { ENTITY } from "../domain/labels";
import { monthLabel } from "../domain/money";
import { useStore } from "../domain/store";
import type { EntityId } from "../domain/types";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { PageHeader, Section, Stat, TotalRow } from "../ui/Page";

export function Empresa({ entity }: { entity: Extract<EntityId, "picasso" | "ph"> }) {
  const { state } = useStore();
  const meta = ENTITY[entity];
  const caixa = liquidityByEntity(state, entity);
  const rec = receitaMes(state, entity);
  const desp = despesaMes(state, entity);
  const lucro = lucroMes(state, entity);
  const contas = state.accounts.filter((a) => a.entityId === entity);

  return (
    <div className="page">
      <PageHeader title={meta.short} mark={meta.tone}>
        {meta.lede}
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity={entity} />
      </div>

      <dl className="mt-14 grid gap-10 sm:grid-cols-2">
        <Stat label="Caixa actual" n={caixa} mark={meta.tone} />
        <Stat label={`Receita ${monthLabel(state.month)}`} n={rec} mark={meta.tone} />
        <Stat label="Despesas do mês" n={desp} mark="soft" />
        <Stat label="Lucro do mês" n={lucro} mark={meta.tone} />
      </dl>

      <Section title="Contas" mark={meta.tone}>
        <ul>
          {contas.map((a) => (
            <li key={a.id} className="ledger-row">
              <span className="text-ink/65">{a.name}</span>
              <Money n={liquidityOf(state, a.id)} />
            </li>
          ))}
        </ul>
        <TotalRow label="Total" mark={meta.tone}>
          <Money n={caixa} />
        </TotalRow>
      </Section>
    </div>
  );
}
