import type { ReactNode } from "react";
import type { EntityTone } from "../domain/labels";
import { Money } from "./Money";

export type MarkTone = EntityTone | "soft" | "rust";

const MARK_CLASS: Record<MarkTone, string> = {
  ink: "mark",
  pine: "mark mark-pine",
  copper: "mark mark-copper",
  moss: "mark mark-moss",
  clay: "mark mark-clay",
  rust: "mark mark-rust",
  soft: "mark mark-soft",
};

export function Mark({ tone = "ink" }: { tone?: MarkTone }) {
  return <span className={MARK_CLASS[tone]} aria-hidden />;
}

/** Linha com marca ao centro — separador de bloco. */
export function Sep() {
  return (
    <div className="sep my-10 sm:my-14" role="separator">
      <Mark tone="soft" />
    </div>
  );
}

/** Linha simples. */
export function SepLine({ className = "" }: { className?: string }) {
  return <div className={`sep-line ${className}`} role="separator" />;
}

export function PageHeader({
  title,
  children,
  mark,
}: {
  title: string;
  children?: ReactNode;
  mark?: EntityTone;
}) {
  return (
    <header className="page-head">
      <div className="mb-4 flex items-center gap-3">
        <Mark tone={mark ?? "ink"} />
        <span className="sep-line flex-1" />
        <Mark tone="soft" />
      </div>
      <h1 className="font-display text-[1.75rem] font-semibold leading-[1.05] tracking-tight sm:text-[2.65rem]">
        {title}
      </h1>
      {children ? <div className="lede">{children}</div> : null}
    </header>
  );
}

export function Section({
  title,
  hint,
  children,
  className = "",
  mark,
  id,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  mark?: MarkTone;
  id?: string;
}) {
  return (
    <section id={id} className={`mt-10 scroll-mt-8 sm:mt-16 ${className}`}>
      <div className="section-head">
        <Mark tone={mark ?? "ink"} />
        <h2 className="section-title">{title}</h2>
        <span className="sep-line ml-2 hidden flex-1 sm:block" />
      </div>
      {hint ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/50">{hint}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Linha de total de ledger — marca + borda forte. */
export function TotalRow({
  label = "Total",
  children,
  mark = "ink",
  className = "",
}: {
  label?: string;
  children: ReactNode;
  mark?: MarkTone;
  className?: string;
}) {
  return (
    <div
      className={`mt-1 flex min-w-0 items-baseline justify-between gap-3 border-t-2 border-ink pt-4 pb-1 ${className}`}
    >
      <span className="flex min-w-0 items-center gap-2 font-display text-base font-semibold tracking-tight">
        <Mark tone={mark} />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap font-semibold">{children}</span>
    </div>
  );
}

/** KPI curto — caixa / receita / lucro nas páginas de entidade. */
export function Stat({
  label,
  n,
  mark = "soft",
  note,
}: {
  label: string;
  n: number;
  mark?: MarkTone;
  note?: string;
}) {
  return (
    <div>
      <dt className="eyebrow flex items-center gap-2">
        <Mark tone={mark} />
        {label}
      </dt>
      <dd className="mt-2">
        <Money n={n} />
      </dd>
      {note ? <p className="mt-1.5 text-xs leading-relaxed text-ink/45">{note}</p> : null}
    </div>
  );
}
