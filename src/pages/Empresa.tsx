import { despesaMes, liquidityByEntity, liquidityOf, lucroMes, receitaMes } from "../domain/engine";
import { monthLabel } from "../domain/money";
import { useStore } from "../domain/store";
import type { EntityId } from "../domain/types";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { Mark, PageHeader, TotalRow } from "../ui/Page";

type MarkTone = "ink" | "pine" | "copper" | "moss";

const META: Record<
  "picasso" | "ph",
  { title: string; lede: string; mark: MarkTone }
> = {
  picasso: {
    title: "Picasso's",
    lede: "Empresa independente. A caixa dela não é tua. Se tirares dinheiro, o sistema pergunta o tipo.",
    mark: "ink",
  },
  ph: {
    title: "PH",
    lede: "Empresa independente. A caixa dela não é tua. Se tirares dinheiro, o sistema pergunta o tipo.",
    mark: "pine",
  },
};

export function Empresa({ entity }: { entity: Extract<EntityId, "picasso" | "ph"> }) {
  const { state } = useStore();
  const meta = META[entity];
  const caixa = liquidityByEntity(state, entity);
  const rec = receitaMes(state, entity);
  const desp = despesaMes(state, entity);
  const lucro = lucroMes(state, entity);
  const contas = state.accounts.filter((a) => a.entityId === entity);

  return (
    <div className="page">
      <PageHeader title={meta.title} mark={meta.mark}>
        {meta.lede}
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity={entity} />
      </div>

      <dl className="mt-14 grid gap-10 sm:grid-cols-2">
        <Item k="Caixa actual" n={caixa} mark={meta.mark} />
        <Item k={`Receita ${monthLabel(state.month)}`} n={rec} mark="pine" />
        <Item k="Despesas do mês" n={desp} />
        <Item k="Lucro do mês" n={lucro} mark="moss" />
      </dl>

      <ul className="mt-14">
        {contas.map((a) => (
          <li key={a.id} className="ledger-row">
            <span className="text-ink/65">{a.name}</span>
            <Money n={liquidityOf(state, a.id)} />
          </li>
        ))}
      </ul>
      <TotalRow label="Total" mark={meta.mark}>
        <Money n={caixa} />
      </TotalRow>
    </div>
  );
}

function Item({
  k,
  n,
  mark = "soft",
}: {
  k: string;
  n: number;
  mark?: "ink" | "pine" | "copper" | "moss" | "soft";
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
    </div>
  );
}
