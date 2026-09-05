import { useState } from "react";
import { liveRoveStatus, lucroMes, receitaMes, roveCounts, roveMrr, unitEconomics } from "../domain/engine";
import { useStore } from "../domain/store";
import type { RoveProduct, RoveStatus } from "../domain/types";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { Mark, PageHeader, Section } from "../ui/Page";
import { Select } from "../ui/Select";

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

export function Rove() {
  const { state, setClient } = useStore();
  const counts = roveCounts(state);
  const mrr = roveMrr(state);
  const netflix = unitEconomics(state, "netflix");
  const iptv = unitEconomics(state, "iptv");

  return (
    <div className="page">
      <PageHeader title="Plural" mark="moss">
        Recorrência. Cliente não é pagamento. A faturação declarada só conta quando o cliente paga.
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity="rove" />
      </div>

      <dl className="mt-14 grid gap-8 sm:grid-cols-3">
        <Box k="MRR (activos / atraso / suspenso)" n={mrr} />
        <Box k="Receita declarada" n={state.declared.roveRevenue} />
        <Box k="Lucro declarado" n={state.declared.roveProfit} />
        <Box k="Receita registada no mês" n={receitaMes(state, "rove")} />
        <Box k="Lucro registado no mês" n={lucroMes(state, "rove")} />
      </dl>

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

      <Section title="Clientes">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/15">
                {["Cliente", "Plano", "Preço", "Vencimento", "Estado"].map((h) => (
                  <th key={h} className="eyebrow py-3 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.roveClients.map((c) => {
                const live = liveRoveStatus(c, state.asOf);
                return (
                  <tr key={c.id} className="border-b border-ink/[0.06]">
                    <td className="py-3 pr-3">
                      <input
                        className="w-full bg-transparent outline-none focus:border-b focus:border-ink"
                        defaultValue={c.name}
                        onBlur={(e) => setClient(c.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="py-3 pr-3 text-ink/55">{c.product}</td>
                    <td className="py-3 pr-3">
                      <Money n={c.price} />
                    </td>
                    <td className="num py-3 pr-3 text-ink/70">{c.nextPayment ?? "—"}</td>
                    <td className="py-3 pr-3">
                      <Status live={live} stored={c.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AddClient />
      </Section>
    </div>
  );
}

function Box({ k, n }: { k: string; n: number }) {
  return (
    <div>
      <dt className="eyebrow flex items-center gap-2">
        <Mark tone="moss" />
        {k}
      </dt>
      <dd className="mt-2">
        <Money n={n} />
      </dd>
    </div>
  );
}

function Unit({ title, u }: { title: string; u: ReturnType<typeof unitEconomics> }) {
  return (
    <div>
      <div className="section-head">
        <Mark tone="moss" />
        <h2 className="section-title">{title}</h2>
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
        <li className="flex items-baseline justify-between gap-4 border-t border-ink/20 pt-3 text-sm">
          <span>Margem por cliente</span>
          <Money n={u.margem} tone={u.margem >= 0 ? "in" : "out"} />
        </li>
      </ul>
      {u.perClientCost === 0 && (
        <p className="mt-3 text-xs text-copper">
          Custos Plural ainda não registados em recorrentes — margem incompleta.
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
