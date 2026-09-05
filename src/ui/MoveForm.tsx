import { useState, type FormEvent } from "react";
import { CW_CATS, KIND_LABEL } from "../domain/engine";
import { entityShort } from "../domain/labels";
import { useStore } from "../domain/store";
import type { CostNature, CwCategory, EntityId, MovementKind } from "../domain/types";
import { Select } from "./Select";

const ENTITY_OPTIONS = [
  { value: "pessoal" as const, label: "Pessoal" },
  { value: "cw" as const, label: "PDS (PADStation)" },
  { value: "rove" as const, label: "Plural" },
  { value: "picasso" as const, label: "Picasso's" },
  { value: "ph" as const, label: "PH" },
];

const KIND_OPTIONS = Object.entries(KIND_LABEL).map(([value, label]) => ({
  value: value as MovementKind,
  label,
}));

const COST_NATURE_OPTIONS: { value: CostNature; label: string }[] = [
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
  { value: "investimento", label: "Investimento" },
  { value: "retirada", label: "Retirada" },
];

const OWNER: MovementKind[] = [
  "investimento_proprietario",
  "emprestimo_proprietario",
  "prolabore",
  "distribuicao",
  "reembolso",
  "despesa_pessoal_pela_empresa",
];

export function MoveForm({ defaultEntity }: { defaultEntity?: EntityId }) {
  const { state, addMovement } = useStore();
  const [open, setOpen] = useState(false);
  const [entityId, setEntityId] = useState<EntityId>(defaultEntity ?? "pessoal");
  const [kind, setKind] = useState<MovementKind>("despesa");
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(state.asOf);
  const [fromId, setFromId] = useState(state.accounts.find((a) => a.entityId === entityId)?.id ?? "");
  const [toId, setToId] = useState("");
  const [category, setCategory] = useState<CwCategory>("por_classificar");
  const [costNature, setCostNature] = useState<CostNature>("variavel");
  const [envelopeId, setEnvelopeId] = useState("operacional");
  const [method, setMethod] = useState("numerario");
  const [responsible, setResponsible] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const accounts = state.accounts.filter((a) => a.entityId === entityId);
  const otherAccounts = state.accounts.filter((a) => a.entityId !== entityId);

  const fromOptions = [
    { value: "", label: "—" },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
    ...(kind === "interempresa" || kind === "investimento_proprietario" || kind === "reembolso"
      ? otherAccounts.map((a) => ({
          value: a.id,
          label: `${entityShort(a.entityId)} · ${a.name}`,
        }))
      : []),
  ];

  const toOptions = [
    { value: "", label: "mundo / vazio" },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
    ...otherAccounts.map((a) => ({
      value: a.id,
      label: `${entityShort(a.entityId)} · ${a.name}`,
    })),
  ];

  const cwCategoryOptions = CW_CATS.map((c) => ({ value: c.id, label: c.label }));
  const envelopeOptions = state.envelopes.map((env) => ({ value: env.id, label: env.name }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(String(amount).replace(",", "."));
    if (!n || n <= 0) {
      setErr("Valor inválido.");
      return;
    }
    const fromAcc = state.accounts.find((a) => a.id === fromId);
    const toAcc = state.accounts.find((a) => a.id === toId);

    if (kind === "receita") {
      if (!fromAcc && !toId) {
        const dest = accounts[0]?.id;
        if (!dest) return setErr("Conta de destino em falta.");
        addMovement({
          at,
          kind,
          amount: n,
          from: { type: "world" },
          to: { type: "liquidity", id: dest },
          entityId,
          category: entityId === "cw" ? category : undefined,
          method,
          responsible,
          note,
          envelopeId: entityId === "pessoal" ? envelopeId : undefined,
        });
      } else {
        addMovement({
          at,
          kind,
          amount: n,
          from: { type: "world" },
          to: { type: "liquidity", id: toId || fromId },
          entityId,
          category: entityId === "cw" ? category : undefined,
          method,
          responsible,
          note,
        });
      }
      done();
      return;
    }

    if (kind === "despesa") {
      if (!fromId) return setErr("Escolhe a conta de saída.");
      if (entityId === "pessoal" && !envelopeId) return setErr("Toda a despesa pessoal precisa de um bolso.");
      addMovement({
        at,
        kind,
        amount: n,
        from: { type: "liquidity", id: fromId },
        to: { type: "world" },
        entityId,
        costNature: entityId === "cw" ? costNature : undefined,
        method,
        responsible,
        note,
        envelopeId: entityId === "pessoal" ? envelopeId : undefined,
        category: entityId === "cw" ? category : undefined,
      });
      done();
      return;
    }

    if (kind === "interempresa" || kind === "investimento_proprietario" || kind === "reembolso" || kind === "emprestimo_proprietario") {
      if (!fromId || !toId) return setErr("Origem e destino obrigatórios.");
      if (fromAcc?.entityId === toAcc?.entityId && kind === "interempresa") {
        return setErr("Interempresarial tem de cruzar duas entidades diferentes.");
      }
      addMovement({
        at,
        kind,
        amount: n,
        from: { type: "liquidity", id: fromId },
        to: { type: "liquidity", id: toId },
        entityId,
        otherEntityId: toAcc?.entityId,
        method,
        responsible,
        note,
        envelopeId: kind === "investimento_proprietario" ? "investimento" : undefined,
        costNature: OWNER.includes(kind) ? "retirada" : undefined,
      });
      done();
      return;
    }

    if (OWNER.includes(kind)) {
      if (!fromId) return setErr("Conta de origem em falta.");
      addMovement({
        at,
        kind,
        amount: n,
        from: { type: "liquidity", id: fromId },
        to: { type: "liquidity", id: toId || "caixa-p" },
        entityId,
        method,
        responsible,
        note,
        costNature: "retirada",
      });
      done();
      return;
    }

    if (kind === "transferencia") {
      if (!fromId || !toId) return setErr("Duas contas da mesma entidade.");
      addMovement({
        at,
        kind,
        amount: n,
        from: { type: "liquidity", id: fromId },
        to: { type: "liquidity", id: toId },
        entityId,
        method,
        note,
      });
      done();
      return;
    }

    setErr("Tipo não suportado neste formulário.");
  }

  function done() {
    setErr("");
    setAmount("");
    setNote("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost">
        Novo movimento
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="panel max-w-xl">
      <p className="font-display text-xl tracking-tight">Registo</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/55">
        Camada 1 — o que aconteceu. Sem isto as outras camadas mentem.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
        <label className="field-label col-span-2 sm:col-span-1">
          Entidade
          <Select
            value={entityId}
            onChange={(v) => {
              setEntityId(v);
              setFromId(state.accounts.find((a) => a.entityId === v)?.id ?? "");
            }}
            options={ENTITY_OPTIONS}
          />
        </label>
        <label className="field-label">
          Tipo
          <Select value={kind} onChange={setKind} options={KIND_OPTIONS} />
        </label>
        <label className="field-label">
          Data
          <input
            type="date"
            className="field text-sm font-normal normal-case tracking-normal text-ink"
            value={at}
            onChange={(e) => setAt(e.target.value)}
          />
        </label>
        <label className="field-label">
          Valor (Kz)
          <input
            className="field num text-sm font-normal normal-case tracking-normal text-ink"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            required
          />
        </label>
        <label className="field-label">
          De
          <Select value={fromId} onChange={setFromId} options={fromOptions} />
        </label>
        <label className="field-label">
          Para
          <Select value={toId} onChange={setToId} options={toOptions} />
        </label>
        {entityId === "cw" && kind === "receita" && (
          <label className="field-label">
            Serviço
            <Select value={category} onChange={setCategory} options={cwCategoryOptions} />
          </label>
        )}
        {entityId === "cw" && kind === "despesa" && (
          <label className="field-label">
            Natureza
            <Select value={costNature} onChange={setCostNature} options={COST_NATURE_OPTIONS} />
          </label>
        )}
        {entityId === "pessoal" && kind === "despesa" && (
          <label className="field-label col-span-2">
            Bolso
            <Select value={envelopeId} onChange={setEnvelopeId} options={envelopeOptions} />
          </label>
        )}
        <label className="field-label">
          Método
          <input
            className="field text-sm font-normal normal-case tracking-normal text-ink"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          />
        </label>
        <label className="field-label">
          Responsável
          <input
            className="field text-sm font-normal normal-case tracking-normal text-ink"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
          />
        </label>
        <label className="field-label col-span-2">
          Observação
          <input
            className="field text-sm font-normal normal-case tracking-normal text-ink"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      {OWNER.includes(kind) && (
        <p className="mt-4 text-xs leading-relaxed text-ink/45">
          Empréstimo ≠ pró-labore ≠ distribuição ≠ reembolso ≠ despesa pessoal pela empresa. Escolhe o
          tipo certo.
        </p>
      )}
      {err && <p className="mt-3 text-sm text-rust">{err}</p>}
      <div className="mt-5 flex gap-3">
        <button type="submit" className="btn-solid">
          Guardar
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink/45 hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
