import { buildAlerts, buildDecisions, splitSalary } from "../domain/engine";
import { kz } from "../domain/money";
import { useStore } from "../domain/store";
import { Link } from "react-router-dom";
import { Mark, PageHeader, Section, Sep } from "../ui/Page";

export function Decisao() {
  const { state } = useStore();
  const decisions = buildDecisions(state);
  const alerts = buildAlerts(state);
  const split = splitSalary(state.declared.salary, state.rules);

  return (
    <div className="page">
      <PageHeader title="O que faço com o dinheiro?">
        Camada 4. Não é um extrato. É o CFO: regras + contas + dívidas, numa resposta.
      </PageHeader>

      <p className="mt-10 flex gap-3 border border-ink/12 bg-wash/50 p-4 text-sm leading-relaxed text-ink/55">
        <Mark tone="copper" />
        <span>
          Quando entram {kz(state.declared.salary, 0)} de salário GSA, as regras actuais partem assim:
          obrigações {kz(split.obrigacoes)} · reserva {kz(split.reserva)} · investimento{" "}
          {kz(split.investimento)} · despesas {kz(split.despesas)} · lazer {kz(split.lazer)}.{" "}
          <Link to="/orcamento" className="border-b border-ink/25 hover:border-ink">
            Alterar regras
          </Link>
        </span>
      </p>

      <ol className="mt-14 space-y-0">
        {decisions.map((d, i) => (
          <li key={d.question} className="border-b border-ink/10 py-8 first:pt-0">
            <p className="eyebrow flex items-center gap-2">
              <Mark tone="soft" />
              {String(i + 1).padStart(2, "0")} · {d.question}
            </p>
            <p className="mt-2 font-display text-[1.65rem] font-semibold leading-tight tracking-tight sm:text-[1.85rem]">
              {d.answer}
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/60">{d.detail}</p>
          </li>
        ))}
      </ol>

      <Sep />

      <Section title="O sistema está a ver" className="mt-0">
        <ul className="space-y-0">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex gap-3 border-b border-ink/[0.07] py-3.5 text-sm leading-relaxed text-ink/70 last:border-0"
            >
              <Mark tone={a.tone === "bad" ? "ink" : a.tone === "warn" ? "copper" : "soft"} />
              <span className="min-w-0 flex-1">
                {a.href ? (
                  <Link to={a.href} className="hover:text-ink">
                    {a.text}
                  </Link>
                ) : (
                  a.text
                )}
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
