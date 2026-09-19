import { useState } from "react";
import { Link } from "react-router-dom";
import { KIND_LABEL } from "../domain/engine";
import { ENTITY_FILTER_OPTIONS, entityShort } from "../domain/labels";
import { formatDatePt, kz } from "../domain/money";
import { useStore } from "../domain/store";
import type { EntityId } from "../domain/types";
import { MoveForm } from "../ui/MoveForm";
import { Mark, PageHeader, Sep } from "../ui/Page";
import { Select } from "../ui/Select";

export function Movimentos() {
  const { state, removeMovement } = useStore();
  const [entity, setEntity] = useState<EntityId | "todas">("todas");
  const [err, setErr] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const rows = state.movements.filter((m) => entity === "todas" || m.entityId === entity);
  // mais recentes primeiro
  const ordered = [...rows].reverse();

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
        Camada 1. Tudo o que acontece: entrada, saída, transferência, dívida, investimento. Errou?
        Apaga o movimento — os saldos recalculam-se.
      </PageHeader>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <MoveForm />
        <label className="field-label flex items-center gap-2 font-normal normal-case tracking-normal text-sm text-ink/55">
          Entidade
          <Select
            inline
            value={entity}
            onChange={setEntity}
            options={ENTITY_FILTER_OPTIONS}
          />
        </label>
      </div>

      <Sep />

      {err ? <p className="mb-4 text-sm text-rust">{err}</p> : null}

      <ul className="space-y-0">
        {ordered.length === 0 && (
          <li className="flex items-center gap-2.5 py-8 text-sm text-ink/45">
            <Mark tone="soft" />
            Ainda não há movimentos neste filtro.
          </li>
        )}
        {ordered.map((m) => (
          <li key={m.id} className="border-b border-ink/[0.07] py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex items-center gap-2.5 font-display text-lg tracking-tight">
                <Mark
                  tone={
                    m.kind === "receita" || m.kind === "reembolso" || m.kind === "distribuicao"
                      ? "pine"
                      : m.kind === "despesa" || m.kind === "despesa_pessoal_pela_empresa"
                        ? "ink"
                        : m.kind === "prolabore" || m.kind === "emprestimo_proprietario"
                          ? "copper"
                          : "soft"
                  }
                />
                {KIND_LABEL[m.kind]}
              </span>
              <span className="flex items-center gap-3">
                <span className="num text-base">{kz(m.amount)}</span>
                <button
                  type="button"
                  className={`btn-ghost !min-h-10 py-2 text-xs sm:!min-h-0 sm:py-1 ${
                    confirmId === m.id ? "border-rust/40 text-rust" : "text-ink/40"
                  }`}
                  onClick={() => onDelete(m.id)}
                >
                  {confirmId === m.id ? "Confirmar apagar" : "Apagar"}
                </button>
              </span>
            </div>
            <p className="mt-1.5 pl-[1.1rem] text-[0.68rem] uppercase tracking-[0.16em] text-ink/35">
              {formatDatePt(m.at)} · {entityShort(m.entityId)}
              {m.otherEntityId ? ` → ${entityShort(m.otherEntityId)}` : ""}
              {m.category ? ` · ${m.category}` : ""}
              {m.envelopeId ? ` · bolso ${m.envelopeId}` : ""}
            </p>
            {m.note && (
              <p className="mt-2 pl-[1.1rem] text-sm leading-relaxed text-ink/55">{m.note}</p>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-ink/40">
        Também podes apagar a partir da página da empresa (últimos movimentos).{" "}
        <Link to="/pds" className="border-b border-ink/20 hover:border-ink">
          PDS
        </Link>
        , Plural, Picasso's, PH.
      </p>
    </div>
  );
}
