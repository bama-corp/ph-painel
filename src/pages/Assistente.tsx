import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  interpretChat,
  proposalKindLabel,
  type ClarifyOption,
  type ReportProposal,
} from "../domain/dailyReport";
import { todayIso } from "../domain/money";
import { useStore } from "../domain/store";
import { DateField } from "../ui/DateField";
import { Mark } from "../ui/Page";

type MsgKind = "welcome" | "info" | "proposal" | "clarify" | "status" | "user";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  kind: MsgKind;
  text: string;
  title?: string;
  body?: string;
  footer?: string;
  proposal?: ReportProposal;
  clarifyOptions?: ClarifyOption[];
  status?: "pending" | "done" | "skipped" | "failed" | "clarify";
  failReason?: string;
};

const WELCOME =
  "Saldos, conceitos do Caderno ou o que aconteceu no dia — eu proponho, tu confirmas.";

const CHIPS = [
  "Saldo BAI",
  "Minhas dívidas",
  "O que é custódia?",
  "Como calcular lucro?",
] as const;

function uid() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Parte respostas do Caderno / saldo em título · corpo · rodapé. */
function parseInfoText(text: string): Pick<ChatMsg, "title" | "body" | "footer" | "text"> {
  const parts = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { text };
  const last = parts[parts.length - 1]!;
  if (last.startsWith("—") && parts.length >= 2) {
    const footer = last;
    const title = parts[0];
    const body = parts.slice(1, -1).join("\n\n") || undefined;
    return { text, title, body, footer };
  }
  if (parts.length >= 2) {
    return { text, title: parts[0], body: parts.slice(1).join("\n\n") };
  }
  return { text, body: text };
}

function infoReply(text: string): ChatMsg {
  return {
    id: uid(),
    role: "assistant",
    kind: "info",
    ...parseInfoText(text),
  };
}

function statusReply(text: string): ChatMsg {
  return { id: uid(), role: "assistant", kind: "status", text };
}

function proposalReply(p: ReportProposal, preface?: string): ChatMsg {
  if (p.action.type === "unknown") {
    return {
      id: uid(),
      role: "assistant",
      kind: "info",
      text: `${p.summary}.\n${p.detail}`,
      title: p.summary,
      body: p.detail,
    };
  }
  return {
    id: uid(),
    role: "assistant",
    kind: "proposal",
    text: preface ? `${preface}\n${p.summary}\n${p.detail}` : `${p.summary}\n${p.detail}`,
    title: preface,
    proposal: p,
    status: "pending",
  };
}

function clarifyReply(text: string, options: ClarifyOption[]): ChatMsg {
  return {
    id: uid(),
    role: "assistant",
    kind: "clarify",
    text,
    clarifyOptions: options,
    status: "clarify",
  };
}

function BodyLines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const step = /^(\d+)[.)]\s+(.*)$/.exec(line);
        const bullet = /^[·•]\s*(.*)$/.exec(line);
        if (step) {
          return (
            <p key={i} className="chat-step flex gap-2.5 text-[0.8rem] leading-relaxed text-ink/70">
              <span className="num shrink-0 w-5 text-ink/40">{step[1]}.</span>
              <span className="min-w-0 flex-1">{step[2]}</span>
            </p>
          );
        }
        if (bullet) {
          return (
            <p key={i} className="flex gap-2.5 text-[0.8rem] leading-relaxed text-ink/70">
              <span className="shrink-0 text-ink/35">·</span>
              <span className="min-w-0 flex-1">{bullet[1]}</span>
            </p>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        return (
          <p key={i} className="text-[0.8rem] leading-relaxed text-ink/70 whitespace-pre-wrap">
            {line}
          </p>
        );
      })}
    </div>
  );
}

function ChipRow({ onPick, disabled }: { onPick: (t: string) => void; disabled?: boolean }) {
  return (
    <div className="assistente-chips">
      {CHIPS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          className="assistente-chip"
          onClick={() => onPick(c)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function AssistenteFab() {
  const { state, addMovement, payParty, collectParty } = useStore();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(todayIso);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: "welcome", role: "assistant", kind: "welcome", text: WELCOME },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, open]);

  useEffect(() => {
    if (!open) return;
    // No telemóvel o teclado a abrir logo cobre o sheet; no desktop focamos.
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function pendingMsg(list: ChatMsg[] = msgs) {
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i]!;
      if (m.status === "pending" && m.proposal) return m;
    }
    return null;
  }

  function clearPending(list: ChatMsg[], note = "(substituído)") {
    return list.map((m) =>
      m.status === "pending" || m.status === "clarify"
        ? {
            ...m,
            kind: "status" as const,
            status: "skipped" as const,
            text:
              m.status === "pending"
                ? `${m.proposal?.summary ?? m.text}\n\n${note}`
                : `${m.text}\n\n${note}`,
            title: undefined,
            body: undefined,
            proposal: undefined,
            clarifyOptions: undefined,
          }
        : m,
    );
  }

  function send(text: string) {
    const line = text.trim();
    if (!line) return;
    const userMsg: ChatMsg = { id: uid(), role: "user", kind: "user", text: line };
    const pend = pendingMsg();
    const turn = interpretChat(line, state, at, pend?.proposal ?? null);

    if (turn.type === "confirm" && pend?.proposal) {
      setMsgs((m) => [...m, userMsg]);
      setInput("");
      applyProposal(pend.id, pend.proposal);
      return;
    }

    if (turn.type === "skip" && pend) {
      setMsgs((list) => [
        ...list.map((m) =>
          m.id === pend.id
            ? {
                ...m,
                kind: "status" as const,
                status: "skipped" as const,
                text: "Ok, ignorei.",
                proposal: undefined,
                clarifyOptions: undefined,
              }
            : m,
        ),
        userMsg,
        statusReply("Descartado. Diz outra coisa do dia quando quiseres."),
      ]);
      setInput("");
      return;
    }

    if (turn.type === "revise" && pend) {
      setMsgs((list) => [
        ...list.map((m) =>
          m.id === pend.id
            ? {
                ...m,
                kind: "status" as const,
                status: "skipped" as const,
                text: `Actualizado (${turn.tip}).`,
                proposal: undefined,
              }
            : m,
        ),
        userMsg,
        proposalReply(turn.proposal, `Actualizei (${turn.tip}):`),
      ]);
      setInput("");
      return;
    }

    if (turn.type === "orphan_fix") {
      setMsgs((m) => [...m, userMsg, infoReply(turn.text)]);
      setInput("");
      return;
    }

    if (turn.type === "info") {
      setMsgs((m) => [...m, userMsg, infoReply(turn.text)]);
      setInput("");
      return;
    }

    if (turn.type === "clarify") {
      setMsgs((list) => [...clearPending(list), userMsg, clarifyReply(turn.text, turn.options)]);
      setInput("");
      return;
    }

    const proposal = turn.type === "fresh" ? turn.proposal : null;
    if (!proposal) {
      setInput("");
      return;
    }

    setMsgs((list) => [...clearPending(list), userMsg, proposalReply(proposal)]);
    setInput("");
  }

  function pickClarify(msgId: string, option: ClarifyOption) {
    setMsgs((list) => [
      ...list.map((m) =>
        m.id === msgId
          ? {
              ...m,
              kind: "status" as const,
              status: "skipped" as const,
              text: `Escolheste: ${option.label}`,
              clarifyOptions: undefined,
            }
          : m,
      ),
      proposalReply(option.proposal, `Ok — ${option.label}:`),
    ]);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function applyProposal(msgId: string, p: ReportProposal) {
    const r = applyOne(p);
    if (!r.ok) {
      setMsgs((list) => [
        ...list.map((m) =>
          m.id === msgId
            ? {
                ...m,
                status: "pending" as const,
                failReason: r.reason,
                text: `Não deu.\n${r.reason}`,
                proposal: p,
              }
            : m,
        ),
      ]);
      return;
    }
    setMsgs((list) => [
      ...list.map((m) =>
        m.id === msgId
          ? {
              ...m,
              kind: "status" as const,
              status: "done" as const,
              text: `Gravado.\n${p.summary}\n${p.detail}`,
              title: "Gravado",
              body: `${p.summary}\n${p.detail}`,
              proposal: undefined,
              failReason: undefined,
            }
          : m,
      ),
      statusReply("Feito. Mais alguma coisa?"),
    ]);
  }

  function skipProposal(msgId: string) {
    setMsgs((list) =>
      list.map((m) =>
        m.id === msgId
          ? {
              ...m,
              kind: "status" as const,
              status: "skipped",
              text: "Ok, ignorei. Diz de outra forma se quiseres.",
              proposal: undefined,
              clarifyOptions: undefined,
            }
          : m,
      ),
    );
  }

  function applyOne(p: ReportProposal): { ok: true } | { ok: false; reason: string } {
    const a = p.action;
    if (a.type === "movement") {
      const r = addMovement(a.draft);
      return r.ok ? { ok: true } : { ok: false, reason: r.reason };
    }
    if (a.type === "payParty") {
      const r = payParty({
        partyId: a.partyId,
        accountId: a.accountId,
        amount: a.amount,
        at: a.at,
        note: a.note,
      });
      return r.ok ? { ok: true } : { ok: false, reason: r.reason };
    }
    if (a.type === "collectParty") {
      const r = collectParty({
        partyId: a.partyId,
        accountId: a.accountId,
        amount: a.amount,
        at: a.at,
        note: a.note,
      });
      return r.ok ? { ok: true } : { ok: false, reason: r.reason };
    }
    return { ok: false, reason: "Acção desconhecida." };
  }

  const pending = msgs.some((m) => m.status === "pending" || m.status === "clarify");
  const onlyWelcome = msgs.length === 1 && msgs[0]?.kind === "welcome";

  return (
    <div
      className={`assistente-fab-wrap pointer-events-none fixed z-40 flex flex-col items-end gap-3 ${
        open ? "is-open" : ""
      }`}
    >
      {open ? (
        <>
          <button
            type="button"
            className="assistente-backdrop"
            aria-label="Fechar assistente"
            onClick={() => setOpen(false)}
          />
          <div
            className="assistente-panel pointer-events-auto flex flex-col border border-ink/15 shadow-[0_12px_40px_rgb(var(--ink)/0.12)]"
            style={{ background: "rgb(var(--paper))" }}
            role="dialog"
            aria-modal="true"
            aria-label="Assistente"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-ink/10 px-4 py-3 sm:px-5">
              <Mark tone={pending ? "copper" : "pine"} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-display text-[1.1rem] font-semibold tracking-tight text-ink sm:text-[1.05rem]">
                    Assistente
                  </p>
                  <label className="flex items-center gap-2 text-[0.65rem] text-ink/40">
                    <span className="uppercase tracking-[0.14em]">Data</span>
                    <DateField inline value={at} onChange={setAt} className="min-w-[7.5rem]" />
                  </label>
                </div>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center text-ink/35 transition-colors hover:text-ink sm:h-auto sm:w-auto"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </header>

            <div
              className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
              aria-live="polite"
              aria-relevant="additions"
            >
              {msgs.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  onConfirm={() => m.proposal && applyProposal(m.id, m.proposal)}
                  onSkip={() => skipProposal(m.id)}
                  onClarify={(opt) => pickClarify(m.id, opt)}
                />
              ))}
              {onlyWelcome ? (
                <div className="pt-1">
                  <p className="mb-2 text-[0.65rem] uppercase tracking-[0.14em] text-ink/35">
                    Atalhos
                  </p>
                  <ChipRow onPick={send} disabled={pending} />
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="shrink-0 border-t border-ink/10 px-3 py-3 sm:px-4">
              {!onlyWelcome ? (
                <div className="mb-2.5">
                  <ChipRow onPick={send} disabled={pending} />
                </div>
              ) : null}
              <form className="flex gap-2" onSubmit={onSubmit}>
                <input
                  ref={inputRef}
                  className="assistente-composer-input"
                  placeholder={
                    pending
                      ? "na caixa · foi 25000 · sim…"
                      : "Emprestei 2000kz… ou um conceito"
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  enterKeyHint="send"
                  autoComplete="off"
                  autoCorrect="off"
                />
                <button
                  type="submit"
                  className="btn-solid shrink-0 px-4 py-2.5 text-base sm:px-3 sm:py-2 sm:text-sm"
                  disabled={!input.trim()}
                >
                  →
                </button>
              </form>
            </div>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className={`pointer-events-auto flex h-14 w-14 items-center justify-center border border-ink/20 text-ink transition-colors hover:border-ink hover:bg-wash sm:h-12 sm:w-12 ${
          open ? "hidden sm:flex" : ""
        }`}
        style={{ background: "rgb(var(--paper))" }}
        aria-label={open ? "Fechar assistente" : "Abrir assistente"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <span className="text-lg leading-none">✕</span>
        ) : (
          <span className="relative flex items-center justify-center">
            <Mark tone={pending ? "copper" : "pine"} />
            {pending ? (
              <span
                className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full sm:h-2 sm:w-2"
                style={{ background: "rgb(var(--copper))" }}
              />
            ) : null}
          </span>
        )}
      </button>
    </div>
  );
}

function MessageBubble({
  msg,
  onConfirm,
  onSkip,
  onClarify,
}: {
  msg: ChatMsg;
  onConfirm: () => void;
  onSkip: () => void;
  onClarify: (opt: ClarifyOption) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] border border-ink/12 bg-wash/80 px-3 py-2 text-[0.8rem] leading-relaxed text-ink">
          <p className="whitespace-pre-wrap">{msg.text}</p>
        </div>
      </div>
    );
  }

  const markTone =
    msg.status === "done"
      ? "pine"
      : msg.status === "failed"
        ? "rust"
        : msg.status === "pending" || msg.status === "clarify"
          ? "copper"
          : "soft";

  const label =
    msg.kind === "proposal" && msg.status === "pending" && msg.proposal
      ? proposalKindLabel(msg.proposal)
      : msg.kind === "clarify"
        ? "Clarificar"
        : msg.kind === "welcome"
          ? "Olá"
          : msg.kind === "info"
            ? "Resposta"
            : "Assistente";

  if (msg.kind === "proposal" && msg.proposal && msg.status === "pending") {
    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[98%] border border-ink/15 px-3.5 py-3">
          <p className="eyebrow mb-2 flex items-center gap-1.5 text-[0.6rem]">
            <Mark tone="copper" />
            {label}
          </p>
          {msg.title ? (
            <p className="mb-2 text-[0.75rem] leading-snug text-ink/50">{msg.title}</p>
          ) : null}
          <p className="font-display text-[1rem] font-semibold tracking-tight text-ink">
            {msg.proposal.summary}
          </p>
          <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink/55 whitespace-pre-wrap">
            {msg.proposal.detail}
          </p>
          {msg.failReason ? (
            <p className="mt-2 text-[0.72rem] leading-snug text-rust">{msg.failReason}</p>
          ) : null}
          <p className="mt-3 text-[0.7rem] text-ink/40">Gravo no ledger?</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className="btn-solid min-h-11 flex-1 py-2.5 text-sm sm:min-h-0 sm:flex-none sm:py-1.5 sm:text-xs" onClick={onConfirm}>
              Confirmar
            </button>
            <button type="button" className="btn-ghost min-h-11 flex-1 py-2.5 text-sm sm:min-h-0 sm:flex-none sm:py-1.5 sm:text-xs" onClick={onSkip}>
              Ignorar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === "clarify" && msg.clarifyOptions && msg.status === "clarify") {
    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[98%] border border-ink/15 px-3.5 py-3">
          <p className="eyebrow mb-2 flex items-center gap-1.5 text-[0.6rem]">
            <Mark tone="copper" />
            Clarificar
          </p>
          <p className="text-[0.85rem] leading-relaxed text-ink/75 whitespace-pre-wrap">{msg.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {msg.clarifyOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className="btn-ghost min-h-11 py-2.5 text-sm sm:min-h-0 sm:py-1.5 sm:text-xs"
                onClick={() => onClarify(opt)}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              className="btn-ghost min-h-11 py-2.5 text-sm text-ink/45 sm:min-h-0 sm:py-1.5 sm:text-xs"
              onClick={onSkip}
            >
              Ignorar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (msg.kind === "info" || (msg.title && msg.body)) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[98%]">
          <p className="eyebrow mb-2 flex items-center gap-1.5 text-[0.6rem]">
            <Mark tone={markTone} />
            {label}
          </p>
          {msg.title ? (
            <p className="font-display text-[1.05rem] font-semibold tracking-tight text-ink">
              {msg.title}
            </p>
          ) : null}
          {msg.body ? (
            <div className={msg.title ? "mt-2.5" : undefined}>
              <BodyLines text={msg.body} />
            </div>
          ) : !msg.title ? (
            <BodyLines text={msg.text} />
          ) : null}
          {msg.footer ? (
            <p className="mt-3 text-[0.65rem] uppercase tracking-[0.12em] text-ink/35">
              {msg.footer.replace(/^—\s*/, "")}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%]">
        <p className="eyebrow mb-1.5 flex items-center gap-1.5 text-[0.6rem]">
          <Mark tone={markTone} />
          {label}
        </p>
        <p className="text-[0.8rem] leading-relaxed text-ink/70 whitespace-pre-wrap">{msg.text}</p>
      </div>
    </div>
  );
}
