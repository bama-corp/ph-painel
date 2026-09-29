import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { KIND_LABEL, liquidityByEntity } from "../domain/engine";
import { ENTITY, entityShort } from "../domain/labels";
import { formatDatePt } from "../domain/money";
import { useStore } from "../domain/store";
import type { AppState, Endpoint, EntityId, Movement, MovementKind } from "../domain/types";
import { COMPANIES } from "../domain/types";
import { Money } from "../ui/Money";
import { MoveForm } from "../ui/MoveForm";
import { Mark, PageHeader, Sep } from "../ui/Page";

/** Ordem: eu primeiro, depois cada empresa. */
const SECTIONS: EntityId[] = ["pessoal", ...COMPANIES];

/** Linhas iniciais por entidade — evita scroll infinito. */
const PAGE_SIZE = 15;

const IN_KINDS = new Set<MovementKind>([
  "receita",
  "reembolso",
  "distribuicao",
  "cobranca_party",
]);

const OUT_KINDS = new Set<MovementKind>([
  "despesa",
  "despesa_pessoal_pela_empresa",
  "prolabore",
  "investimento_proprietario",
  "emprestimo_proprietario",
  "pagamento_party",
]);

function sectionTitle(id: EntityId) {
  return id === "pessoal" ? "Eu" : ENTITY[id].short;
}

function endpointLabel(state: AppState, ep: Endpoint): string {
  if (ep.type === "world") return "mundo";
  if (ep.type === "unallocated") return "sem função";
  if (ep.type === "envelope") {
    return state.envelopes.find((e) => e.id === ep.id)?.name ?? ep.id;
  }
  if (ep.type === "party") {
    return state.parties.find((p) => p.id === ep.id)?.name ?? ep.id;
  }
  const acc = state.accounts.find((a) => a.id === ep.id);
  return acc ? acc.name : ep.id;
}

function descritivo(state: AppState, m: Movement): string {
  const note = m.note?.trim();
  if (note) return note;
  const route = `${endpointLabel(state, m.from)} → ${endpointLabel(state, m.to)}`;
  return `${KIND_LABEL[m.kind]} · ${route}`;
}

function montanteTone(m: Movement): "in" | "out" | "plain" {
  if (IN_KINDS.has(m.kind)) return "in";
  if (OUT_KINDS.has(m.kind)) return "out";
  if (m.kind === "transferencia" || m.kind === "interempresa" || m.kind === "alocacao") return "plain";
  if (m.kind === "ajuste") {
    if (m.to.type === "liquidity" && m.from.type === "world") return "in";
    if (m.from.type === "liquidity" && m.to.type === "world") return "out";
  }
  return "plain";
}

function saldoAposPorEntidade(state: AppState, entity: EntityId): Map<string, number> {
  const chrono = [...state.movements].reverse();
  const map = new Map<string, number>();
  for (let i = 0; i < chrono.length; i++) {
    const partial: AppState = { ...state, movements: chrono.slice(0, i + 1) };
    map.set(chrono[i]!.id, liquidityByEntity(partial, entity));
  }
  return map;
}

export function Movimentos() {
  const { state, removeMovement } = useStore();
  const [tab, setTab] = useState<EntityId>("pessoal");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [err, setErr] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = {} as Record<EntityId, number>;
    for (const id of SECTIONS) c[id] = 0;
    for (const m of state.movements) c[m.entityId] = (c[m.entityId] ?? 0) + 1;
    return c;
  }, [state.movements]);

  const rows = useMemo(
    () => state.movements.filter((m) => m.entityId === tab),
    [state.movements, tab],
  );

  const saldos = useMemo(() => saldoAposPorEntidade(state, tab), [state, tab]);

  const shown = rows.slice(0, visible);
  const hasMore = rows.length > visible;
  const meta = ENTITY[tab];

  function selectTab(id: EntityId) {
    setTab(id);
    setVisible(PAGE_SIZE);
    setConfirmId(null);
    setErr("");
  }

  function onDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      setErr("");
      return;
    }
    const r = removeMovement(id);
    if (!r.ok) {
      setErr(r.reason);
      return;
    }
    setConfirmId(null);
    setErr("");
  }

  return (
    <div className="page">
      <PageHeader title="Registo">
        Uma lista de cada vez — Eu e cada empresa. Errou? Apaga — os saldos recalculam-se.
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity={tab} />
      </div>

      <Sep />

      <div className="page-tabs" role="tablist" aria-label="Entidade">
        {SECTIONS.map((id) => {
          const on = tab === id;
          const n = counts[id] ?? 0;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => selectTab(id)}
              className={`page-tab ${
                on
                  ? "border-b-2 border-ink font-medium text-ink"
                  : "border-b-2 border-transparent text-ink/40 hover:text-ink/70"
              }`}
            >
              {sectionTitle(id)}
              {n > 0 ? <span className="ml-1.5 num text-ink/35">{n}</span> : null}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-ink/40">
        {tab === "pessoal"
          ? "Contas e movimentos pessoais."
          : `Liquidez ${meta.short} · saldo após = caixa desta empresa.`}
        {tab !== "pessoal" ? (
          <>
            {" "}
            <Link to={meta.path} className="border-b border-ink/20 hover:border-ink">
              Abrir {meta.short}
            </Link>
          </>
        ) : null}
      </p>

      {err ? <p className="mt-4 text-sm text-rust">{err}</p> : null}

      <div className="mt-6">
        {rows.length === 0 ? (
          <p className="flex items-center gap-2.5 py-6 text-sm text-ink/45">
            <Mark tone="soft" />
            Sem movimentos em {sectionTitle(tab)}.
          </p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/15">
                    {["Descritivo", "Data valor", "Montante", "Saldo após", ""].map((h) => (
                      <th key={h || "act"} className="eyebrow py-3 pr-3 font-medium last:pr-0">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => {
                    const tone = montanteTone(m);
                    const saldo = saldos.get(m.id);
                    return (
                      <tr key={m.id} className="border-b border-ink/[0.06] align-top">
                        <td className="py-3 pr-3">
                          <p className="font-medium leading-snug text-ink">{descritivo(state, m)}</p>
                          <p className="mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-ink/35">
                            {KIND_LABEL[m.kind]}
                            {m.otherEntityId ? ` → ${entityShort(m.otherEntityId)}` : ""}
                            {m.category ? ` · ${m.category}` : ""}
                          </p>
                        </td>
                        <td className="num whitespace-nowrap py-3 pr-3 text-ink/70">
                          {formatDatePt(m.at)}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-3">
                          <span className="mr-1 text-ink/35" aria-hidden>
                            {tone === "in" ? "↑" : tone === "out" ? "↓" : "·"}
                          </span>
                          <Money n={m.amount} tone={tone === "plain" ? "plain" : tone} />
                        </td>
                        <td className="whitespace-nowrap py-3 pr-3">
                          {saldo != null ? <Money n={saldo} tone="mute" /> : "—"}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            className={`btn-ghost !min-h-9 py-1.5 text-xs ${
                              confirmId === m.id ? "border-rust/40 text-rust" : "text-ink/40"
                            }`}
                            onClick={() => onDelete(m.id)}
                          >
                            {confirmId === m.id ? "Confirmar" : "Apagar"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasMore ? (
              <button
                type="button"
                className="btn-ghost mt-4 text-sm"
                onClick={() => setVisible((n) => n + PAGE_SIZE)}
              >
                Ver mais ({rows.length - visible} restantes)
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
