import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  buildAlerts,
  fluxoMes,
  liquidityByEntity,
  liquidityOf,
  ownerCurrent,
  patrimonioPessoal,
  receitaMes,
  lucroMes,
  unallocated,
} from "../domain/engine";
import { monthLabel } from "../domain/money";
import { useStore } from "../domain/store";
import { Money } from "../ui/Money";
import { Mark, Section, Sep } from "../ui/Page";

export function Eu() {
  const { state } = useStore();
  const p = patrimonioPessoal(state);
  const cw = liquidityByEntity(state, "cw");
  const rove = liquidityByEntity(state, "rove");
  const picasso = liquidityByEntity(state, "picasso");
  const phEmp = liquidityByEntity(state, "ph");
  const empresas = cw + rove + picasso + phEmp;
  const u = unallocated(state);
  const alerts = buildAlerts(state);
  const fluxo = fluxoMes(state);
  const banks = state.accounts.filter((a) => a.entityId === "pessoal");
  const owner = ownerCurrent(state);
  const fluxoSaldo =
    fluxo.entradas - fluxo.despesas - fluxo.investimentos - fluxo.dividasPagas;
  const posicao = p.dinheiro + p.receber - p.dividas;

  return (
    <div className="page">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="min-h-[min(72vh,38rem)]"
      >
        <div className="flex flex-wrap items-end gap-1 sm:gap-1.5">
          <p className="brand text-[clamp(5.5rem,22vw,10.5rem)] text-ink">PH</p>
          <img
            src="/logo.png?v=3"
            alt=""
            width={160}
            height={160}
            className="-ml-1 mb-[0.15em] h-[clamp(4.25rem,15vw,7.5rem)] w-auto shrink-0 select-none sm:-ml-1.5"
            decoding="async"
          />
        </div>
        <div className="mt-5 flex max-w-xl items-center gap-3">
          <Mark />
          <span className="sep-line flex-1" />
        </div>
        <h1 className="mt-5 max-w-xl font-display text-[1.65rem] font-semibold leading-tight tracking-tight sm:mt-6 sm:text-[2.15rem]">
          De quem é este dinheiro?
        </h1>
        <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-ink/60">
          Pessoal, PDS, Plural, Picasso's e PH são caixas à parte. O painel consolida. Não mistura.
        </p>

        <div className="mt-12 grid gap-10 border-t border-ink/15 pt-10 lg:grid-cols-[1.35fr_0.9fr] lg:gap-16">
          <div>
            <p className="eyebrow flex items-center gap-2">
              <Mark tone="pine" /> Dinheiro pessoal
            </p>
            <div className="mt-3">
              <Money n={p.dinheiro} large />
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/55">
              {u > 1 ? (
                <>
                  <span className="text-rust">{u.toLocaleString("pt-PT")} Kz</span> ainda sem função.{" "}
                  <Link to="/orcamento" className="border-b border-ink/30 pb-px hover:border-ink">
                    Alocar
                  </Link>
                </>
              ) : (
                "Tudo com bolso — o que podes gastar está em Decisão."
              )}
            </p>
          </div>

          <div className="lg:border-l lg:border-ink/12 lg:pl-12">
            <p className="eyebrow flex items-center gap-2">
              <Mark tone="soft" /> Das empresas — não gastes
            </p>
            <div className="mt-5 space-y-0">
              <div className="flex items-baseline justify-between gap-4 border-b border-ink/[0.08] py-3">
                <span className="flex items-center gap-2 font-display text-lg tracking-tight">
                  <Mark tone="copper" /> PDS
                </span>
                <span className="num text-lg text-ink/80">{cw.toLocaleString("pt-PT")} Kz</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-ink/[0.08] py-3">
                <span className="flex items-center gap-2 font-display text-lg tracking-tight">
                  <Mark tone="moss" /> Plural
                </span>
                <span className="num text-lg text-ink/80">{rove.toLocaleString("pt-PT")} Kz</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-ink/[0.08] py-3">
                <span className="flex items-center gap-2 font-display text-lg tracking-tight">
                  <Mark /> Picasso's
                </span>
                <span className="num text-lg text-ink/80">{picasso.toLocaleString("pt-PT")} Kz</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-ink/[0.08] py-3">
                <span className="flex items-center gap-2 font-display text-lg tracking-tight">
                  <Mark tone="pine" /> PH
                </span>
                <span className="num text-lg text-ink/80">{phEmp.toLocaleString("pt-PT")} Kz</span>
              </div>
              <Total label="Total empresas" n={empresas} mark="soft" />
            </div>
          </div>
        </div>
      </motion.section>

      <Sep />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="grid gap-12 lg:grid-cols-3 lg:items-stretch lg:gap-10"
      >
        <Col title="Pessoal" to="/contas" rail="rgb(var(--pine))" mark="pine">
          <div className="flex flex-1 flex-col">
            {banks.map((a) => (
              <Row key={a.id} label={a.name} n={liquidityOf(state, a.id)} />
            ))}
          </div>
          <Total label="Total liquidez" n={p.dinheiro} mark="pine" />
          <div className="flex flex-1 flex-col">
            <Row label="A receber" n={p.receber} tone="in" />
            <Row label="A pagar" n={p.dividas} tone="out" />
          </div>
          <Total
            label="Total posição"
            n={posicao}
            mark="pine"
            tone={posicao >= 0 ? "in" : "out"}
            className="mt-auto"
          />
        </Col>
        <Col title="PDS" to="/pds" rail="rgb(var(--copper))" mark="copper">
          <div className="flex flex-1 flex-col">
            <Row label="Caixa" n={cw} />
            <Row label="Conta corrente Emanuel" n={owner} tone="in" />
          </div>
          <Total label="Total caixa + a receber" n={cw + owner} mark="copper" />
          <div className="flex flex-1 flex-col">
            <Row label="Receita julho (declarada)" n={state.declared.cwRevenueJuly} />
            <Row label="Receita deste mês" n={receitaMes(state, "cw")} />
          </div>
          <div className="mt-auto">
            <Row label="Lucro deste mês" n={lucroMes(state, "cw")} />
          </div>
        </Col>
        <Col title="Plural" to="/plural" rail="rgb(var(--moss))" mark="moss">
          <div className="flex flex-1 flex-col">
            <Row label="Caixa" n={rove} />
          </div>
          <Total label="Total caixa" n={rove} mark="moss" />
          <div className="flex flex-1 flex-col">
            <Row label="Receita declarada" n={state.declared.roveRevenue} />
            <Row label="Lucro declarado" n={state.declared.roveProfit} />
          </div>
          <div className="mt-auto">
            <Row label="Receita deste mês (registo)" n={receitaMes(state, "rove")} />
          </div>
        </Col>
        <Col title="Picasso's" to="/picasso" rail="rgb(var(--ink))" mark="ink">
          <div className="flex flex-1 flex-col">
            <Row label="Caixa" n={picasso} />
          </div>
          <Total label="Total caixa" n={picasso} />
          <div className="mt-auto">
            <Row label="Receita deste mês" n={receitaMes(state, "picasso")} />
          </div>
        </Col>
        <Col title="PH" to="/ph" rail="rgb(var(--pine))" mark="pine">
          <div className="flex flex-1 flex-col">
            <Row label="Caixa" n={phEmp} />
          </div>
          <Total label="Total caixa" n={phEmp} mark="pine" />
          <div className="mt-auto">
            <Row label="Receita deste mês" n={receitaMes(state, "ph")} />
          </div>
        </Col>
      </motion.div>

      <Sep />

      <Section
        title="Património líquido"
        mark="ink"
        hint="Dinheiro + bens + participações nas empresas + a receber − dívidas. A caixa das empresas não entra como «teu para gastar» — entra como participação."
        className="mt-0"
      >
        <div>
          <Row label="Dinheiro" n={p.dinheiro} />
          <Row label="Bens pessoais" n={p.bens} />
          <Row label="Participações nas empresas" n={p.participacoes} />
          <Row label="A receber" n={p.receber} tone="in" />
          <Row label="Dívidas" n={p.dividas} tone="out" />
          <Total label="Total" n={p.liquido} />
        </div>
      </Section>

      <Sep />

      <Section
        title={`Fluxo ${monthLabel(state.month)}`}
        mark="pine"
        hint="Movimento do mês — o que entrou, saiu e ficou de lado."
        className="mt-0"
      >
        <div>
          <Row label="Entradas" n={fluxo.entradas} tone="in" />
          <Row label="Despesas" n={fluxo.despesas} tone="out" />
          <Row label="Investimentos" n={fluxo.investimentos} />
          <Row label="Dívidas pagas" n={fluxo.dividasPagas} />
          <Row label="Reservado" n={fluxo.reservado} />
          <Total
            label="Total"
            n={fluxoSaldo}
            mark="pine"
            tone={fluxoSaldo >= 0 ? "in" : "out"}
          />
        </div>
      </Section>

      <Sep />

      <Section title="Alertas" mark="copper" className="mt-0">
        <ul className="space-y-0">
          {alerts.map((a, i) => (
            <motion.li
              key={a.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.35 }}
              className="ledger-row !items-start py-3.5 text-sm leading-relaxed text-ink/75"
            >
              <span className="flex min-w-0 flex-1 gap-3">
                <Mark
                  tone={a.tone === "bad" ? "ink" : a.tone === "warn" ? "copper" : "soft"}
                />
                {a.href ? (
                  <Link to={a.href} className="hover:text-ink">
                    {a.text}
                  </Link>
                ) : (
                  a.text
                )}
              </span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-10 flex items-center gap-3 border-t-2 border-ink pt-6">
          <Mark />
          <Link
            to="/decisao"
            className="font-display text-lg tracking-tight transition-opacity hover:opacity-70"
          >
            <span className="border-b border-ink pb-0.5">O que faço com o dinheiro →</span>
          </Link>
          <span className="sep-line ml-2 hidden flex-1 sm:block" />
          <Mark tone="soft" />
        </div>
      </Section>

      <Sep />
    </div>
  );
}

function Col({
  title,
  to,
  children,
  rail,
  mark,
}: {
  title: string;
  to: string;
  children: ReactNode;
  rail: string;
  mark: "pine" | "copper" | "moss" | "ink";
}) {
  return (
    <div className="entity-rail flex h-full flex-col" style={{ ["--rail" as string]: rail }}>
      <div className="section-head !border-ink/20 !pb-2">
        <Mark tone={mark} />
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        <Link
          to={to}
          className="ml-auto text-[0.68rem] uppercase tracking-[0.16em] text-ink/35 hover:text-ink"
        >
          abrir
        </Link>
      </div>
      <div className="mt-1 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function Row({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone?: "in" | "out";
}) {
  return (
    <div className="ledger-row">
      <span className="text-ink/60">{label}</span>
      <Money n={n} tone={tone} />
    </div>
  );
}

function Total({
  label = "Total",
  n,
  tone,
  mark = "ink",
  className = "",
}: {
  label?: string;
  n: number;
  tone?: "in" | "out";
  mark?: "ink" | "pine" | "copper" | "moss" | "soft";
  className?: string;
}) {
  return (
    <div
      className={`ledger-row mt-1 !items-center border-t-2 border-ink !py-0 pt-4 pb-1 ${className}`}
    >
      <span className="flex min-w-0 items-center gap-2 font-display text-base tracking-tight">
        <Mark tone={mark} /> {label}
      </span>
      <Money n={n} tone={tone} />
    </div>
  );
}
