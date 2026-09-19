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

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposal?: ReportProposal;
  clarifyOptions?: ClarifyOption[];
  status?: "pending" | "done" | "skipped" | "failed" | "clarify";
  failReason?: string;
};

const WELCOME =
  "Olá. Saldos («quanto tenho no BAI»), conceitos («o que é custódia?», «como calcular um pró-labore?») ou o que aconteceu no dia — eu proponho e tu confirmas.\nCorrecções: «na caixa pessoal», «foi 25000», «sim», «não».";

function uid() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function proposalReply(p: ReportProposal, preface?: string): ChatMsg {
  if (p.action.type === "unknown") {
    return {
      id: uid(),
      role: "assistant",
      text: `${p.summary}.\n${p.detail}`,
    };
  }
  const head = preface ? `${preface}\n\n` : "Percebi isto:\n\n";
  return {
    id: uid(),
    role: "assistant",
    text: `${head}${p.summary}\n${p.detail}\n\nGravo no ledger?`,
    proposal: p,
    status: "pending",
  };
}

function clarifyReply(text: string, options: ClarifyOption[]): ChatMsg {
  return {
    id: uid(),
    role: "assistant",
    text,
    clarifyOptions: options,
    status: "clarify",
  };
}

export function AssistenteFab() {
  const { state, addMovement, payParty, collectParty } = useStore();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(todayIso);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: "welcome", role: "assistant", text: WELCOME },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
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
            status: "skipped" as const,
            text:
              m.status === "pending"
                ? m.text.replace(/\n\nGravo no ledger\?$/, "") + `\n\n${note}`
                : `${m.text}\n\n${note}`,
            proposal: undefined,
            clarifyOptions: undefined,
          }
        : m,
    );
  }

  function send(text: string) {
    const line = text.trim();
    if (!line) return;
    const userMsg: ChatMsg = { id: uid(), role: "user", text: line };
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
                status: "skipped" as const,
                text: "Ok, ignorei.",
                proposal: undefined,
              }
            : m,
        ),
        userMsg,
        {
          id: uid(),
          role: "assistant",
          text: "Descartado. Diz outra coisa do dia quando quiseres.",
        },
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
      setMsgs((m) => [
        ...m,
        userMsg,
        { id: uid(), role: "assistant", text: turn.text },
      ]);
      setInput("");
      return;
    }

    if (turn.type === "info") {
      setMsgs((m) => [
        ...m,
        userMsg,
        { id: uid(), role: "assistant", text: turn.text },
      ]);
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
                text: `Não deu.\n${r.reason}\n\nCorrige a conta/valor («na caixa», «foi 20000») ou ignora.`,
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
              status: "done" as const,
              text: `Gravado.\n${p.summary}\n${p.detail}`,
              proposal: undefined,
              failReason: undefined,
            }
          : m,
      ),
      {
        id: uid(),
        role: "assistant",
        text: "Feito. Mais alguma coisa?",
      },
    ]);
  }

  function skipProposal(msgId: string) {
    setMsgs((list) =>
      list.map((m) =>
        m.id === msgId
          ? {
              ...m,
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

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 sm:bottom-8 sm:right-8">
      {open ? (
        <div
          className="pointer-events-auto flex h-[min(32rem,calc(100vh-7rem))] w-[min(22rem,calc(100vw-2.5rem))] flex-col border border-ink/15 shadow-[0_12px_40px_rgb(var(--ink)/0.12)]"
          style={{ background: "rgb(var(--paper))" }}
          role="dialog"
          aria-label="Assistente"
        >
          <header className="flex items-center gap-3 border-b border-ink/10 px-4 py-3">
            <Mark tone="pine" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Assistente</p>
              <label className="mt-0.5 flex items-center gap-2 text-[0.65rem] text-ink/40">
                <span className="uppercase tracking-[0.14em]">Data</span>
                <DateField inline value={at} onChange={setAt} className="min-w-[7.5rem]" />
              </label>
            </div>
            <button
              type="button"
              className="text-ink/35 transition-colors hover:text-ink"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[90%] border border-ink/15 bg-wash/80 px-3 py-2 text-[0.8rem] leading-relaxed text-ink"
                      : "max-w-[95%] text-[0.8rem] leading-relaxed text-ink/75"
                  }
                >
                  {m.role === "assistant" ? (
                    <p className="eyebrow mb-1.5 flex items-center gap-1.5 text-[0.6rem]">
                      <Mark
                        tone={
                          m.status === "done"
                            ? "pine"
                            : m.status === "failed"
                              ? "rust"
                              : m.status === "pending" || m.status === "clarify"
                                ? "copper"
                                : "soft"
                        }
                      />
                      {m.proposal && m.status === "pending"
                        ? proposalKindLabel(m.proposal)
                        : m.status === "clarify"
                          ? "Clarificar"
                          : "Assistente"}
                    </p>
                  ) : null}
                  {m.role === "assistant" && m.text.includes("\n\n") ? (
                    <div className="space-y-2">
                      {m.text.split(/\n\n+/).map((block, i) => {
                        const isTitle = i === 0 && !block.startsWith("—") && !block.startsWith("·");
                        const isFooter = block.startsWith("—");
                        return (
                          <p
                            key={i}
                            className={
                              isTitle
                                ? "font-display text-[0.95rem] font-semibold tracking-tight text-ink whitespace-pre-wrap"
                                : isFooter
                                  ? "text-[0.7rem] uppercase tracking-[0.12em] text-ink/40 whitespace-pre-wrap"
                                  : "whitespace-pre-wrap"
                            }
                          >
                            {block}
                          </p>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}
                  {m.clarifyOptions && m.status === "clarify" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.clarifyOptions.map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          className="btn-ghost py-1.5 text-xs"
                          onClick={() => pickClarify(m.id, opt)}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn-ghost py-1.5 text-xs text-ink/45"
                        onClick={() => skipProposal(m.id)}
                      >
                        Ignorar
                      </button>
                    </div>
                  ) : null}
                  {m.proposal && m.status === "pending" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-solid py-1.5 text-xs"
                        onClick={() => applyProposal(m.id, m.proposal!)}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost py-1.5 text-xs"
                        onClick={() => skipProposal(m.id)}
                      >
                        Ignorar
                      </button>
                    </div>
                  ) : null}
                  {m.status === "failed" && m.failReason ? (
                    <p className="mt-1.5 text-[0.7rem] text-rust">{m.failReason}</p>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2 border-t border-ink/10 px-3 py-3"
            onSubmit={onSubmit}
          >
            <input
              ref={inputRef}
              className="field flex-1 py-2 text-sm font-normal normal-case tracking-normal text-ink"
              placeholder={
                pending ? "na caixa · foi 25000 · sim…" : "Emprestei 2000kz na PDS…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              type="submit"
              className="btn-solid shrink-0 px-3 py-2 text-sm"
              disabled={!input.trim()}
            >
              →
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        className="pointer-events-auto flex h-12 w-12 items-center justify-center border border-ink/20 text-ink transition-colors hover:border-ink hover:bg-wash"
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
                className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full"
                style={{ background: "rgb(var(--copper))" }}
              />
            ) : null}
          </span>
        )}
      </button>
    </div>
  );
}
