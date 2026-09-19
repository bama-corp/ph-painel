import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  buildAlerts,
  custodyInAccount,
  fluxoMes,
  liquidityByEntity,
  liquidityOf,
  lucroMes,
  ownLiquidityOf,
  ownerCurrent,
  patrimonioPessoal,
  receitaMes,
  unallocated,
} from "../domain/engine";
import { COMPANIES } from "../domain/types";
import { ENTITY, type EntityTone } from "../domain/labels";
import { monthLabel } from "../domain/money";
import { useStore } from "../domain/store";
import { Money } from "../ui/Money";
import { Mark, Section, Sep, TotalRow, type MarkTone } from "../ui/Page";

export function Eu() {
  const { state } = useStore();
  const p = patrimonioPessoal(state);
  const byEntity = Object.fromEntries(
    (["pessoal", ...COMPANIES] as const).map((id) => [id, liquidityByEntity(state, id)]),
  ) as Record<keyof typeof ENTITY, number>;
  const empresas = COMPANIES.reduce((s, id) => s + byEntity[id], 0);
  const u = unallocated(state);
  const alerts = buildAlerts(state);
  const fluxo = fluxoMes(state);
  const banks = state.accounts.filter((a) => a.entityId === "pessoal");
  const owner = ownerCurrent(state);
  const fluxoSaldo =
    fluxo.entradas - fluxo.despesas - fluxo.investimentos - fluxo.dividasPagas;
  const posicao = p.proprio + p.receber - p.dividasOwn;

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
          Pessoal + quatro empresas. O painel consolida. Não mistura.
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
              {COMPANIES.map((id) => {
                const e = ENTITY[id];
                return (
                  <div
                    key={id}
                    className="flex items-baseline justify-between gap-4 border-b border-ink/[0.08] py-3"
                  >
                    <span className="flex items-center gap-2 font-display text-lg tracking-tight">
                      <Mark tone={e.tone} /> {e.short}
                    </span>
                    <span className="num text-lg font-semibold text-ink/80">
                      {byEntity[id].toLocaleString("pt-PT")} Kz
                    </span>
                  </div>
                );
              })}
              <TotalRow label="Total empresas" mark="soft">
                <Money n={empresas} />
              </TotalRow>
            </div>
          </div>
        </div>
      </motion.section>

      <Sep />

      {/* Pessoal — faixa completa; empresas — 4 colunas iguais (não 5 esmagadas). */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-14"
      >
        <Col meta={ENTITY.pessoal}>
          <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {banks.map((a) => {
              const teu = ownLiquidityOf(state, a.id);
              const cust = custodyInAccount(state, a.id);
              return (
                <div key={a.id}>
                  <Row label={a.name} n={teu} />
                  {cust > 0 ? (
                    <p className="mt-0.5 text-[0.65rem] text-ink/35">
                      + {cust.toLocaleString("pt-PT")} Kz custódia (não é teu)
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid gap-x-10 gap-y-1 border-t-2 border-ink pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <TotalCell label="Teu (próprio)" mark="pine" n={p.proprio} />
            <TotalCell label="Custódia" mark="soft" n={p.custodia} />
            <TotalCell label="Bruto nos bancos" mark="soft" n={p.dinheiro} />
            <TotalCell label="A receber" mark="pine" n={p.receber} tone="in" />
            <TotalCell label="Dívida própria" mark="rust" n={p.dividasOwn} tone="out" />
            <TotalCell
              label="Posição"
              mark="pine"
              n={posicao}
              tone={posicao >= 0 ? "in" : "out"}
            />
          </div>
        </Col>

        <div>
          <div className="section-head mb-8 !border-ink/20">
            <Mark tone="soft" />
            <h2 className="section-title">Empresas</h2>
            <span className="sep-line ml-2 hidden flex-1 sm:block" />
          </div>
          <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-4 xl:gap-12">
            {COMPANIES.map((id) => {
              const e = ENTITY[id];
              const contas = state.accounts.filter((a) => a.entityId === id);
              return (
                <Col key={id} meta={e}>
                  {contas.map((a) => (
                    <Row
                      key={a.id}
                      label={shortAccountName(a.name, e.short)}
                      n={liquidityOf(state, a.id)}
                    />
                  ))}
                  <TotalRow label="Total" mark={e.tone}>
                    <Money n={byEntity[id]} />
                  </TotalRow>
                  {id === "cw" && owner > 0 && (
                    <Row label="C/C Emanuel" n={owner} tone="in" />
                  )}
                  {id === "cw" && (
                    <Row label="Receita jul (decl.)" n={state.declared.cwRevenueJuly} />
                  )}
                  {id === "rove" && (
                    <Row label="Receita (decl.)" n={state.declared.roveRevenue} />
                  )}
                  {id === "rove" && (
                    <Row label="Lucro (decl.)" n={state.declared.roveProfit} />
                  )}
                  <Row label="Receita mês" n={receitaMes(state, id)} />
                  <Row label="Lucro mês" n={lucroMes(state, id)} />
                </Col>
              );
            })}
          </div>
        </div>
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
          <TotalRow label="Total">
            <Money n={p.liquido} />
          </TotalRow>
        </div>
      </Section>

      <Sep />

      <Section
        title={`Fluxo ${monthLabel(state.month)}`}
        mark="pine"
        hint="Movimentos reais do mês — não o salário declarado. Transferências ≠ despesas."
        className="mt-0"
      >
        <div>
          <Row label="Entradas reais" n={fluxo.entradas} tone="in" />
          <Row label="Despesas" n={fluxo.despesas} tone="out" />
          <Row label="Transferências" n={fluxo.transferencias} />
          <Row label="Investimentos" n={fluxo.investimentos} />
          <Row label="Dívidas pagas" n={fluxo.dividasPagas} />
          <Row label="Interempresa" n={fluxo.interempresa} />
          <Row label="Reservado (aloc.)" n={fluxo.reservado} />
          <TotalRow label="Total" mark="pine">
            <Money n={fluxoSaldo} tone={fluxoSaldo >= 0 ? "in" : "out"} />
          </TotalRow>
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
                  tone={
                    (a.tone === "bad" ? "ink" : a.tone === "warn" ? "copper" : "soft") as MarkTone
                  }
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
  meta,
  children,
}: {
  meta: { short: string; path: string; tone: EntityTone; rail: string };
  children: ReactNode;
}) {
  return (
    <div className="entity-rail min-w-0" style={{ ["--rail" as string]: meta.rail }}>
      <div className="section-head !border-ink/20 !pb-2">
        <Mark tone={meta.tone} />
        <h2 className="min-w-0 truncate font-display text-lg font-semibold tracking-tight">
          {meta.short}
        </h2>
        <Link
          to={meta.path}
          className="ml-auto shrink-0 text-[0.68rem] uppercase tracking-[0.16em] text-ink/35 hover:text-ink"
        >
          abrir
        </Link>
      </div>
      <div className="mt-1">{children}</div>
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
    <div className="ledger-row min-w-0">
      <span className="min-w-0 truncate text-ink/60">{label}</span>
      <span className="shrink-0 whitespace-nowrap">
        <Money n={n} tone={tone} />
      </span>
    </div>
  );
}

function TotalCell({
  label,
  n,
  mark,
  tone,
}: {
  label: string;
  n: number;
  mark: MarkTone;
  tone?: "in" | "out";
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-1">
      <span className="flex min-w-0 items-center gap-2 font-display text-sm font-semibold tracking-tight">
        <Mark tone={mark} />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap">
        <Money n={n} tone={tone} />
      </span>
    </div>
  );
}

/** Evita "Caixa PDS" sob o título PDS. */
function shortAccountName(name: string, entityShort: string) {
  const stripped = name
    .replace(new RegExp(`\\s*[—-]\\s*${entityShort}$`, "i"), "")
    .replace(new RegExp(`^Caixa\\s+${entityShort}$`, "i"), "Caixa")
    .replace(new RegExp(`\\s+${entityShort}$`, "i"), "")
    .trim();
  return stripped || name;
}
