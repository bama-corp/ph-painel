import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import {
  interpretTasksChat,
  tasksAssistActionLabel,
  withNewSubtask,
  type TasksAssistProposal,
  type TasksClarifyOption,
} from "../domain/tasksAssist";
import { entityFromTasksPath } from "../domain/tasks";
import { useTasks } from "../domain/tasksStore";
import { Mark } from "../ui/Page";

type MsgKind = "welcome" | "info" | "proposal" | "clarify" | "status" | "user";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  kind: MsgKind;
  text: string;
  title?: string;
  body?: string;
  proposal?: TasksAssistProposal;
  clarifyOptions?: TasksClarifyOption[];
  status?: "pending" | "done" | "skipped" | "failed" | "clarify";
  failReason?: string;
};

const WELCOME =
  "Tarefas do dia, inbox ou cria/conclui — eu proponho, tu confirmas.";

const CHIPS = [
  "O que tenho hoje?",
  "Atrasadas",
  "Inbox",
  "Adiciona tarefa ",
] as const;

function uid() {
  return `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function infoReply(text: string): ChatMsg {
  const parts = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      id: uid(),
      role: "assistant",
      kind: "info",
      text,
      title: parts[0],
      body: parts.slice(1).join("\n\n"),
    };
  }
  return { id: uid(), role: "assistant", kind: "info", text, body: text };
}

function statusReply(text: string): ChatMsg {
  return { id: uid(), role: "assistant", kind: "status", text };
}

function proposalReply(p: TasksAssistProposal, preface?: string): ChatMsg {
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

function clarifyReply(text: string, options: TasksClarifyOption[]): ChatMsg {
  return {
    id: uid(),
    role: "assistant",
    kind: "clarify",
    text,
    clarifyOptions: options,
    status: "clarify",
  };
}

function ChipRow({
  onPick,
  onFill,
  disabled,
}: {
  onPick: (t: string) => void;
  /** Chips que terminam em espaço: preenche o input em vez de enviar. */
  onFill?: (t: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="assistente-chips">
      {CHIPS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          className="assistente-chip"
          onClick={() => {
            if (c.endsWith(" ") && onFill) onFill(c);
            else onPick(c.trimEnd());
          }}
        >
          {c.trimEnd()}
        </button>
      ))}
    </div>
  );
}

function entityHintFromPath(pathname: string) {
  if (!pathname.startsWith("/tarefas")) return undefined;
  const rest = pathname.replace(/^\/tarefas\/?/, "");
  const seg = rest.split("/")[0];
  if (
    !seg ||
    seg === "calendario" ||
    seg === "rotina" ||
    seg === "alertas" ||
    seg === "sistema"
  ) {
    return seg ? undefined : "pessoal";
  }
  return entityFromTasksPath(seg);
}

export function TarefasAssistenteFab() {
  const { pathname } = useLocation();
  const { tasks, add, setStatus, toggleFocusToday, update } = useTasks();
  const entityHint = entityHintFromPath(pathname);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: "welcome", role: "assistant", kind: "welcome", text: WELCOME },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, open]);

  /** Mobile: altura do sheet = visualViewport (teclado). */
  useEffect(() => {
    if (!open) return;
    const el = wrapRef.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;

    function sync() {
      if (!el || !vv) return;
      const top = Math.max(0, vv.offsetTop);
      const h = Math.max(240, vv.height);
      el.style.setProperty("--assistente-vv-top", `${top}px`);
      el.style.setProperty("--assistente-vvh", `${h}px`);
    }

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      el.style.removeProperty("--assistente-vv-top");
      el.style.removeProperty("--assistente-vvh");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
      inputRef.current?.focus();
    }
  }, [open]);

  function fillComposer(prefix: string) {
    setInput(prefix);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const len = prefix.length;
      inputRef.current?.setSelectionRange(len, len);
    });
  }

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

  function applyOne(p: TasksAssistProposal): { ok: true } | { ok: false; reason: string } {
    const a = p.action;
    if (a.type === "add") {
      return add(a.draft);
    }
    if (a.type === "setStatus") {
      return setStatus(a.id, a.status);
    }
    if (a.type === "toggleFocus") {
      return toggleFocusToday(a.id);
    }
    if (a.type === "setDue") {
      return update(a.id, { due: a.due });
    }
    if (a.type === "addSubtask") {
      const t = tasks.find((x) => x.id === a.id);
      if (!t) return { ok: false, reason: "Tarefa em falta." };
      const next = withNewSubtask(t, a.subtaskTitle);
      return update(a.id, { subtasks: next.subtasks });
    }
    return { ok: false, reason: a.reason || "Acção desconhecida." };
  }

  function applyProposal(msgId: string, p: TasksAssistProposal) {
    const r = applyOne(p);
    if (!r.ok) {
      setMsgs((list) =>
        list.map((m) =>
          m.id === msgId
            ? {
                ...m,
                status: "failed" as const,
                failReason: r.reason,
              }
            : m,
        ),
      );
      return;
    }
    setMsgs((list) => [
      ...list.map((m) =>
        m.id === msgId
          ? {
              ...m,
              kind: "status" as const,
              status: "done" as const,
              text: `Feito — ${p.summary}`,
              proposal: undefined,
              failReason: undefined,
            }
          : m,
      ),
    ]);
  }

  function skipProposal(msgId: string) {
    setMsgs((list) =>
      list.map((m) =>
        m.id === msgId
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
    );
  }

  function send(text: string) {
    const line = text.trim();
    if (!line) return;
    const userMsg: ChatMsg = { id: uid(), role: "user", kind: "user", text: line };
    const pend = pendingMsg();
    const turn = interpretTasksChat(line, tasks, {
      entityHint,
      pending: pend?.proposal ?? null,
    });

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
        statusReply("Descartado. Diz outra coisa quando quiseres."),
      ]);
      setInput("");
      return;
    }

    if (turn.type === "info") {
      setMsgs((m) => [...m, userMsg, infoReply(turn.text)]);
      setInput("");
      return;
    }

    if (turn.type === "unknown") {
      setMsgs((m) => [...m, userMsg, infoReply(turn.text)]);
      setInput("");
      return;
    }

    if (turn.type === "clarify") {
      setMsgs((list) => [...clearPending(list), userMsg, clarifyReply(turn.text, turn.options)]);
      setInput("");
      return;
    }

    if (turn.type === "fresh") {
      setMsgs((list) => [...clearPending(list), userMsg, proposalReply(turn.proposal)]);
      setInput("");
      return;
    }

    setInput("");
  }

  function pickClarify(msgId: string, option: TasksClarifyOption) {
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

  const pending = msgs.some((m) => m.status === "pending" || m.status === "clarify");
  const onlyWelcome = msgs.length === 1 && msgs[0]?.kind === "welcome";

  return (
    <div
      ref={wrapRef}
      className={`assistente-fab-wrap assistente-fab-tarefas pointer-events-none fixed z-40 flex flex-col items-end gap-3 ${
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
            aria-label="Assistente de tarefas"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-ink/10 px-4 py-3 sm:px-5">
              <Mark tone={pending ? "copper" : "pine"} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-[1.1rem] font-semibold tracking-tight text-ink sm:text-[1.05rem]">
                  Assistente · Tarefas
                </p>
                <p className="text-[0.65rem] text-ink/40">Propõe · tu confirmas</p>
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
              className="scroll-panel min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
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
                  <ChipRow onPick={send} onFill={fillComposer} disabled={pending} />
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="shrink-0 border-t border-ink/10 px-3 py-3 sm:px-4">
              {!onlyWelcome ? (
                <div className="mb-2.5">
                  <ChipRow onPick={send} onFill={fillComposer} disabled={pending} />
                </div>
              ) : null}
              <form className="flex gap-2" onSubmit={onSubmit}>
                <input
                  ref={inputRef}
                  className="assistente-composer-input"
                  placeholder={
                    pending
                      ? "sim · não · ou outra frase…"
                      : "O que tenho hoje? · adiciona tarefa…"
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
        aria-label={open ? "Fechar assistente" : "Abrir assistente de tarefas"}
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
  onClarify: (opt: TasksClarifyOption) => void;
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
      ? tasksAssistActionLabel(msg.proposal.action)
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
          <p className="mt-1.5 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-ink/55">
            {msg.proposal.detail}
          </p>
          {msg.failReason ? (
            <p className="mt-2 text-[0.72rem] leading-snug text-rust">{msg.failReason}</p>
          ) : null}
          <p className="mt-3 text-[0.7rem] text-ink/40">Aplicar nas tarefas?</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-solid min-h-11 flex-1 py-2.5 text-sm sm:min-h-0 sm:flex-none sm:py-1.5 sm:text-xs"
              onClick={onConfirm}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11 flex-1 py-2.5 text-sm sm:min-h-0 sm:flex-none sm:py-1.5 sm:text-xs"
              onClick={onSkip}
            >
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
          <p className="whitespace-pre-wrap text-[0.85rem] leading-relaxed text-ink/75">{msg.text}</p>
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
          <p className="mt-1.5 whitespace-pre-wrap text-[0.85rem] leading-relaxed text-ink/65">
            {msg.body ?? msg.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%]">
        <p className="eyebrow mb-1.5 flex items-center gap-1.5 text-[0.6rem]">
          <Mark tone={markTone} />
          {label}
        </p>
        <p className="whitespace-pre-wrap text-[0.85rem] leading-relaxed text-ink/70">{msg.text}</p>
      </div>
    </div>
  );
}
