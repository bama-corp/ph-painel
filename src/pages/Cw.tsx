import {
  CW_CATS,
  cwByCategory,
  cwCosts,
  cwJulyUnclassified,
  despesaMes,
  lucroMes,
  liquidityByEntity,
  ownerCurrent,
  receitaMes,
} from "../domain/engine";
import { monthLabel } from "../domain/money";
import { useStore } from "../domain/store";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { Mark, PageHeader, Section, TotalRow } from "../ui/Page";

export function Cw() {
  const { state } = useStore();
  const caixa = liquidityByEntity(state, "cw");
  const rec = receitaMes(state, "cw");
  const desp = despesaMes(state, "cw");
  const lucro = lucroMes(state, "cw");
  const cats = cwByCategory(state);
  const july = cwJulyUnclassified(state);
  const costs = cwCosts(state);
  const owner = ownerCurrent(state);

  return (
    <div className="page">
      <PageHeader title="PDS" mark="copper">
        PADStation — empresa independente. A caixa dela não é tua. Se tirares dinheiro, o sistema
        pergunta o tipo.
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity="cw" />
      </div>

      <dl className="mt-14 grid gap-10 sm:grid-cols-2">
        <Item k="Caixa actual" n={caixa} mark="copper" />
        <Item k={`Receita ${monthLabel(state.month)}`} n={rec} mark="pine" />
        <Item k="Despesas do mês" n={desp} />
        <Item k="Lucro do mês" n={lucro} mark="moss" />
        <Item
          k="Conta corrente do proprietário (a receber)"
          n={owner}
          note="Emanuel deve isto à PDS. Não está perdido."
          mark="copper"
        />
        <Item k="Faturação julho (por classificar)" n={july} />
      </dl>

      <Section
        title="De onde vem a receita"
        mark="copper"
        hint="Sem categorias, 86 mil Kz num mês não diz qual serviço dá dinheiro."
      >
        <ul>
          {CW_CATS.map((c) => (
            <li key={c.id} className="ledger-row">
              <span className="text-ink/65">{c.label}</span>
              <Money
                n={cats[c.id]}
                tone={c.id === "por_classificar" && cats[c.id] > 0 ? "out" : "plain"}
              />
            </li>
          ))}
        </ul>
        <TotalRow label="Total" mark="copper">
          <Money n={Object.values(cats).reduce((s, n) => s + n, 0)} />
        </TotalRow>
      </Section>

      <Section title="Custos" mark="copper">
        <ul>
          <li className="ledger-row">
            <span className="text-ink/65">Fixos (ex.: funcionário 35.000)</span>
            <Money n={costs.fixo} />
          </li>
          <li className="ledger-row">
            <span className="text-ink/65">Variáveis</span>
            <Money n={costs.variavel} />
          </li>
          <li className="ledger-row">
            <span className="text-ink/65">Investimentos</span>
            <Money n={costs.investimento} />
          </li>
          <li className="ledger-row">
            <span className="text-ink/65">Retiradas do proprietário</span>
            <Money n={costs.retirada} tone="out" />
          </li>
        </ul>
        <TotalRow label="Total" mark="copper">
          <Money n={costs.fixo + costs.variavel + costs.investimento + costs.retirada} />
        </TotalRow>
        {state.recurring
          .filter((r) => r.entityId === "cw")
          .map((r) => (
            <p key={r.id} className="mt-5 text-sm text-ink/50">
              Recorrente: {r.name} — {r.amount.toLocaleString("pt-PT")} Kz/mês ({r.nature}). Regista no
              mês para entrar no lucro.
            </p>
          ))}
      </Section>
    </div>
  );
}

function Item({
  k,
  n,
  note,
  mark = "soft",
}: {
  k: string;
  n: number;
  note?: string;
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
      {note && <p className="mt-1.5 text-xs leading-relaxed text-ink/45">{note}</p>}
    </div>
  );
}
