import { useEffect, useState } from "react";
import { liveRoveStatus, roveCounts, roveMrr, unitEconomics } from "../domain/engine";
import { ENTITY } from "../domain/labels";
import { formatDatePt } from "../domain/money";
import { pluralClientUrl } from "../domain/pluralRemote";
import { useStore } from "../domain/store";
import type { RoveProduct, RoveStatus } from "../domain/types";
import { CompanyAccounts, CompanyOutlook, CompanyRecentMoves, CompanyRecurring } from "../ui/CompanyOps";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { Mark, PageHeader, Section, Stat, TotalRow } from "../ui/Page";
import { Select } from "../ui/Select";

const meta = ENTITY.rove;

/** Refresh automático enquanto a página Plural está aberta (minutos). */
const PLURAL_AUTO_SYNC_MS = 5 * 60 * 1000;

const PLAN_OPTIONS = [
  { value: "netflix" as const, label: "Netflix" },
  { value: "iptv" as const, label: "IPTV" },
];

const ST: { id: RoveStatus; label: string }[] = [
  { id: "ativo", label: "Ativo" },
  { id: "vence_em_breve", label: "Vence em breve" },
  { id: "em_atraso", label: "Em atraso" },
  { id: "suspenso", label: "Suspenso" },
  { id: "cancelado", label: "Cancelado" },
  { id: "potencial", label: "Potencial" },
];

function formatSyncAt(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function Rove() {
  const { state, setClient, pluralSync, syncPlural } = useStore();
  const linked = pluralSync.linked || pluralSync.status === "ok" || pluralSync.status === "syncing";
  const counts = roveCounts(state);
  const mrr = roveMrr(state);
  const netflix = unitEconomics(state, "netflix");
  const iptv = unitEconomics(state, "iptv");
  const syncLabel = formatSyncAt(pluralSync.at);

  useEffect(() => {
    if (!linked) return;
    const id = window.setInterval(() => {
      void syncPlural();
    }, PLURAL_AUTO_SYNC_MS);
    return () => window.clearInterval(id);
  }, [linked]); // syncPlural estável o suficiente; evita recriar o timer a cada render

  return (
    <div className="page">
      <PageHeader title={meta.short} mark={meta.tone}>
        {meta.lede}
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {linked ? (
          <span className="text-ink/55">
            Fonte: <span className="text-ink">Plural</span>
            <span className="text-ink/40"> · operação no Plural · dinheiro aqui</span>
            {syncLabel ? <span className="text-ink/40"> · sync {syncLabel}</span> : null}
            {pluralSync.status === "syncing" ? (
              <span className="text-ink/40"> · a sincronizar…</span>
            ) : null}
            {pluralSync.status === "error" && pluralSync.error ? (
              <span className="text-rust"> · {pluralSync.error}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-ink/40">
            Sem ponte Plural — define PLURAL_API_URL e PLURAL_API_KEY no servidor (.env).
          </span>
        )}
        {linked || pluralSync.status === "error" ? (
          <button
            type="button"
            className="btn-ghost !min-h-9 py-1.5 text-sm"
            disabled={pluralSync.status === "syncing"}
            onClick={() => void syncPlural()}
          >
            Sincronizar
          </button>
        ) : null}
      </div>

      <div className="mt-8">
        <MoveForm defaultEntity="rove" />
      </div>

      <CompanyOutlook
        entity="rove"
        extra={
          <>
            <Stat label="MRR (activos / atraso / suspenso)" n={mrr} mark={meta.tone} />
            <Stat label="Receita declarada" n={state.declared.roveRevenue} mark={meta.tone} />
            <Stat label="Lucro declarado" n={state.declared.roveProfit} mark={meta.tone} />
          </>
        }
      />

      <CompanyRecentMoves entity="rove" />

      <div className="mt-10 flex flex-wrap gap-x-7 gap-y-2 border-y border-ink/10 py-4 text-sm">
        {ST.map((s) => (
          <span key={s.id} className="text-ink/60">
            {s.label} <span className="num text-ink">{counts[s.id]}</span>
          </span>
        ))}
      </div>

      <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-16">
        <Unit title="Netflix" u={netflix} />
        <Unit title="IPTV" u={iptv} />
      </div>

      <CompanyRecurring entity="rove" showProduct />

      <Section
        title="Clientes"
        mark={meta.tone}
        hint={linked ? "Só leitura — edita no painel Plural e sincroniza." : undefined}
      >
        <div className="table-scroll">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/15">
                {["Cliente", "Plano", "Preço", "Vencimento", "Estado", linked ? "" : null]
                  .filter((h) => h !== null)
                  .map((h) => (
                  <th key={h || "link"} className="eyebrow py-3 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.roveClients.map((c) => {
                const live = liveRoveStatus(c, state.asOf);
                const pluralHref = linked ? pluralClientUrl(c.id) : null;
                return (
                  <tr key={c.id} className="border-b border-ink/[0.06]">
                    <td className="py-3 pr-3">
                      {linked ? (
                        pluralHref ? (
                          <a
                            href={pluralHref}
                            target="_blank"
                            rel="noreferrer"
                            className="text-ink underline-offset-2 hover:underline"
                            title="Abrir no Plural"
                          >
                            {c.name}
                          </a>
                        ) : (
                          <span className="text-ink/80">{c.name}</span>
                        )
                      ) : (
                        <input
                          className="w-full bg-transparent outline-none focus:border-b focus:border-ink"
                          defaultValue={c.name}
                          onBlur={(e) => setClient(c.id, { name: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="py-3 pr-3 text-ink/55">{c.product}</td>
                    <td className="py-3 pr-3">
                      <Money n={c.price} />
                    </td>
                    <td className="num py-3 pr-3 text-ink/70">
                      {c.nextPayment ? formatDatePt(c.nextPayment) : "—"}
                    </td>
                    <td className="py-3 pr-3">
                      <Status live={live} stored={c.status} />
                    </td>
                    {linked ? (
                      <td className="py-3 pr-3 text-right">
                        {pluralHref ? (
                          <a
                            href={pluralHref}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-ink/45 hover:text-ink"
                          >
                            Plural ↗
                          </a>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!linked ? <AddClient /> : null}
      </Section>

      <CompanyAccounts entity="rove" />
    </div>
  );
}

function Unit({ title, u }: { title: string; u: ReturnType<typeof unitEconomics> }) {
  return (
    <div>
      <div className="section-head">
        <Mark tone={meta.tone} />
        <h2 className="section-title">{title}</h2>
        <span className="sep-line ml-2 hidden flex-1 sm:block" />
      </div>
      <p className="mt-3 text-sm text-ink/45">{u.n} clientes a contar para MRR</p>
      <ul className="mt-4">
        <li className="ledger-row">
          <span className="text-ink/65">Receita por cliente</span>
          <Money n={u.perClientRevenue} />
        </li>
        <li className="ledger-row">
          <span className="text-ink/65">Custo proporcional</span>
          <Money n={u.perClientCost} />
        </li>
      </ul>
      <TotalRow label="Margem por cliente" mark={meta.tone}>
        <Money n={u.margem} tone={u.margem >= 0 ? "in" : "out"} />
      </TotalRow>
      {u.perClientCost === 0 && (
        <p className="mt-3 text-xs text-copper">
          Sem custos activos neste produto — edita «Custos recorrentes» abaixo.
        </p>
      )}
    </div>
  );
}

function Status({ live, stored }: { live: RoveStatus; stored: RoveStatus }) {
  const label = ST.find((s) => s.id === live)?.label ?? live;
  const color =
    live === "em_atraso" || live === "suspenso"
      ? "text-rust"
      : live === "vence_em_breve"
        ? "text-copper"
        : live === "potencial"
          ? "text-ink/35"
          : "text-pine";
  return (
    <span className={color} title={stored !== live ? `guardado: ${stored}` : undefined}>
      {label}
    </span>
  );
}

function AddClient() {
  const { addClient } = useStore();
  const [name, setName] = useState("");
  const [product, setProduct] = useState<RoveProduct>("netflix");
  const [price, setPrice] = useState("4500");

  return (
    <form
      className="mt-8 flex flex-wrap items-end gap-4 border-t border-ink/10 pt-6 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        addClient({
          name: name.trim(),
          product,
          price: Number(price) || 0,
          dueDay: 1,
          status: "ativo",
          lastPayment: null,
          nextPayment: null,
        });
        setName("");
      }}
    >
      <label className="field-label">
        Nome
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field-label">
        Plano
        <Select value={product} onChange={setProduct} options={PLAN_OPTIONS} />
      </label>
      <label className="field-label">
        Preço
        <input
          className="field num w-28"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <button type="submit" className="btn-ghost">
        Adicionar
      </button>
    </form>
  );
}
