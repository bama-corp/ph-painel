import {
  CW_CATS,
  cwByCategory,
  cwCosts,
  cwJulyUnclassified,
} from "../domain/engine";
import { ENTITY } from "../domain/labels";
import { useStore } from "../domain/store";
import { CompanyAccounts, CompanyOutlook, CompanyRecurring } from "../ui/CompanyOps";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { PageHeader, Section, Stat, TotalRow } from "../ui/Page";

const meta = ENTITY.cw;

export function Cw() {
  const { state } = useStore();
  const cats = cwByCategory(state);
  const july = cwJulyUnclassified(state);
  const costs = cwCosts(state);

  return (
    <div className="page">
      <PageHeader title={meta.short} mark={meta.tone}>
        {meta.lede}
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity="cw" />
      </div>

      <CompanyOutlook
        entity="cw"
        extra={<Stat label="Faturação julho (por classificar)" n={july} mark="soft" />}
      />

      <Section
        title="De onde vem a receita"
        mark={meta.tone}
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
        <TotalRow label="Total" mark={meta.tone}>
          <Money n={Object.values(cats).reduce((s, n) => s + n, 0)} />
        </TotalRow>
      </Section>

      <Section
        title="Custos registados no mês"
        mark={meta.tone}
        hint="Movimentos reais. O inventário planeado está em «Custos recorrentes»."
      >
        <ul>
          <li className="ledger-row">
            <span className="text-ink/65">Fixos</span>
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
        <TotalRow label="Total" mark={meta.tone}>
          <Money n={costs.fixo + costs.variavel + costs.investimento + costs.retirada} />
        </TotalRow>
      </Section>

      <CompanyRecurring entity="cw" />
      <CompanyAccounts entity="cw" />
    </div>
  );
}
