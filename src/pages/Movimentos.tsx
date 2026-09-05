import { KIND_LABEL } from "../domain/engine";
import { entityShort } from "../domain/labels";
import { kz } from "../domain/money";
import { useStore } from "../domain/store";
import type { EntityId } from "../domain/types";
import { MoveForm } from "../ui/MoveForm";
import { Mark, PageHeader, Sep } from "../ui/Page";
import { Select } from "../ui/Select";
import { useState } from "react";

const ENTITY_FILTER = [
  { value: "todas" as const, label: "Todas" },
  { value: "pessoal" as const, label: "Pessoal" },
  { value: "cw" as const, label: "PDS" },
  { value: "rove" as const, label: "Plural" },
  { value: "picasso" as const, label: "Picasso's" },
  { value: "ph" as const, label: "PH" },
];

export function Movimentos() {
  const { state } = useStore();
  const [entity, setEntity] = useState<EntityId | "todas">("todas");
  const rows = state.movements.filter((m) => entity === "todas" || m.entityId === entity);

  return (
    <div className="page">
      <PageHeader title="Registo">
        Camada 1. Tudo o que acontece: entrada, saída, transferência, dívida, investimento.
      </PageHeader>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <MoveForm />
        <label className="field-label flex items-center gap-2 font-normal normal-case tracking-normal text-sm text-ink/55">
          Entidade
          <Select
            inline
            value={entity}
            onChange={setEntity}
            options={ENTITY_FILTER}
          />
        </label>
      </div>

      <Sep />

      <ul className="space-y-0">
        {rows.length === 0 && (
          <li className="flex items-center gap-2.5 py-8 text-sm text-ink/45">
            <Mark tone="soft" />
            Ainda não há movimentos neste filtro.
          </li>
        )}
        {rows.map((m) => (
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
              <span className="num text-base">{kz(m.amount)}</span>
            </div>
            <p className="mt-1.5 pl-[1.1rem] text-[0.68rem] uppercase tracking-[0.16em] text-ink/35">
              {m.at} · {entityShort(m.entityId)}
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
    </div>
  );
}
