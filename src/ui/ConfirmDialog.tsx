import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Mark } from "./Page";

export type ConfirmOptions = {
  eyebrow?: string;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm fora do ConfirmProvider");
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending((cur) => {
        cur?.resolve(false);
        return { ...opts, resolve };
      });
    });
  }, []);

  const finish = useCallback((ok: boolean) => {
    setPending((cur) => {
      cur?.resolve(ok);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending ? <ConfirmSheet pending={pending} onFinish={finish} /> : null}
    </ConfirmContext.Provider>
  );
}

function ConfirmSheet({
  pending,
  onFinish,
}: {
  pending: Pending;
  onFinish: (ok: boolean) => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const danger = pending.danger !== false;

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label={pending.cancelLabel ?? "Cancelar"}
        onClick={() => onFinish(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={pending.body ? bodyId : undefined}
        className="relative w-full max-w-md border border-ink/15 bg-paper px-5 py-5 shadow-[0_22px_60px_rgb(var(--ink)/0.2)]"
      >
        <p className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.16em] text-ink/45">
          <Mark tone={danger ? "rust" : "copper"} />
          {pending.eyebrow ?? "Confirmar"}
        </p>
        <h2 id={titleId} className="font-display mt-3 text-[1.35rem] font-semibold leading-tight tracking-tight text-ink">
          {pending.title}
        </h2>
        {pending.body ? (
          <p id={bodyId} className="mt-2 text-sm leading-relaxed text-ink/60">
            {pending.body}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onFinish(false)}
            className="btn-ghost min-w-[6.5rem]"
          >
            {pending.cancelLabel ?? "Cancelar"}
          </button>
          <button
            type="button"
            onClick={() => onFinish(true)}
            className={
              danger
                ? "inline-flex min-h-11 min-w-[6.5rem] items-center justify-center border border-rust bg-rust px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:border-ink hover:bg-ink sm:min-h-0"
                : "btn-solid min-w-[6.5rem]"
            }
          >
            {pending.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
