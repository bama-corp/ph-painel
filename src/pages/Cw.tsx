import {
  CW_CATS,
  companyDetailMonth,
  cwByCategory,
  cwCosts,
  cwJulyUnclassified,
  liquidityOf,
  monthsWithReceita,
  receitaMes,
  recurringPlanned,
} from "../domain/engine";
import { ENTITY } from "../domain/labels";
import { kz, monthLabel } from "../domain/money";
import { useStore } from "../domain/store";
import { CompanyAccounts, CompanyOutlook, CompanyRecentMoves, CompanyRecurring } from "../ui/CompanyOps";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { PageHeader, Section, Stat, TotalRow } from "../ui/Page";

const meta = ENTITY.cw;

export function Cw() {
  const { state, setMonth } = useStore();
  const detailMonth = companyDetailMonth(state, "cw");
  const viewingPanelMonth = detailMonth === state.month;
  const cats = cwByCategory(state, detailMonth);
  const catsTotal = Object.values(cats).reduce((s, n) => s + n, 0);
  const july = cwJulyUnclassified(state);
  const costs = cwCosts(state, detailMonth);
  const costsTotal = costs.fixo + costs.variavel + costs.investimento + costs.retirada;
  const planned = recurringPlanned(state, "cw");
  const bai2 = liquidityOf(state, "cw-bai2");
  const otherMonths = monthsWithReceita(state, "cw").filter((m) => m.month !== detailMonth);
  const panelReceita = receitaMes(state, "cw", state.month);

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
        extra={
          july > 0 ? (
            <Stat label="Faturação julho (por classificar)" n={july} mark="soft" />
          ) : undefined
        }
      />

      <Section
        title="BAI 2"
        mark={meta.tone}
        hint="Conta da PDS. Não há fatia pessoal nesta conta."
      >
        <ul>
          <li className="ledger-row">
            <span className="text-ink/65">Saldo na conta</span>
            <Money n={bai2} />
          </li>
        </ul>
      </Section>

      <CompanyRecentMoves entity="cw" />

      <Section
        title={`De onde vem a receita · ${monthLabel(detailMonth)}`}
        mark={meta.tone}
        hint={
          viewingPanelMonth
            ? "Cada receita nova deve ter serviço (Jogos, Impressões, …). Sem isso fica em «Por classificar»."
            : `O mês do painel (${monthLabel(state.month)}) não tem receita — a mostrar ${monthLabel(detailMonth)}, onde está a faturação.`
        }
      >
        {!viewingPanelMonth && panelReceita === 0 ? (
          <p className="mb-4 text-sm text-ink/55">
            Mês do painel sem faturação.{" "}
            <button
              type="button"
              className="border-b border-ink/25 text-ink hover:border-ink"
              onClick={() => setMonth(detailMonth)}
            >
              Mudar o mês do painel para {monthLabel(detailMonth)}
            </button>
            {otherMonths.length > 0 ? (
              <span className="text-ink/40">
                {" "}
                · outros:{" "}
                {otherMonths.map((m, i) => (
                  <span key={m.month}>
                    {i > 0 ? ", " : ""}
                    <button
                      type="button"
                      className="border-b border-ink/20 hover:border-ink"
                      onClick={() => setMonth(m.month)}
                    >
                      {monthLabel(m.month)}
                    </button>
                  </span>
                ))}
              </span>
            ) : null}
          </p>
        ) : null}
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
          <Money n={catsTotal} />
        </TotalRow>
        {cats.por_classificar > 0 ? (
          <p className="mt-3 text-xs text-copper">
            {cats.por_classificar.toLocaleString("pt-PT")} Kz ainda sem serviço — desdobra no Registo
            (apaga o bloco e cria receitas por categoria, ou edita a categoria ao registar).
          </p>
        ) : null}
      </Section>

      <Section
        title={`Custos registados · ${monthLabel(detailMonth)}`}
        mark={meta.tone}
        hint="Só conta despesas/pró-labore já no Registo deste mês — não os custos recorrentes."
      >
        {costsTotal === 0 ? (
          <p className="mb-4 text-sm text-ink/55">
            Ainda não há movimentos de custo em {monthLabel(detailMonth)}. Isto não é um erro: o
            inventário planeado ({kz(planned)}) está em «Custos recorrentes» abaixo — só entra aqui
            quando registas a saída no mês.
          </p>
        ) : null}
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
        <TotalRow label="Total registado" mark={meta.tone}>
          <Money n={costsTotal} />
        </TotalRow>
        {planned > 0 ? (
          <p className="mt-3 text-xs text-ink/40">
            Planeado (recorrentes): {kz(planned)}
            {costsTotal === 0
              ? " — por registar neste mês."
              : costsTotal < planned - 0.01
                ? ` — faltam ~${kz(planned - costsTotal)} face ao inventário.`
                : null}
          </p>
        ) : null}
      </Section>

      <CompanyRecurring entity="cw" />
      <CompanyAccounts entity="cw" />
    </div>
  );
}
