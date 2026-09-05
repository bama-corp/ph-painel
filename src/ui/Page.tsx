import type { ReactNode } from "react";

export function Mark({
  tone = "ink",
}: {
  tone?: "ink" | "pine" | "copper" | "moss" | "soft";
}) {
  const cls =
    tone === "pine"
      ? "mark mark-pine"
      : tone === "copper"
        ? "mark mark-copper"
        : tone === "moss"
          ? "mark mark-moss"
          : tone === "soft"
            ? "mark mark-soft"
            : "mark";
  return <span className={cls} aria-hidden />;
}

/** Linha com marca ao centro — separador de bloco. */
export function Sep() {
  return (
    <div className="sep my-12 sm:my-14" role="separator">
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
  mark?: "ink" | "pine" | "copper" | "moss";
}) {
  return (
    <header className="page-head">
      <div className="mb-4 flex items-center gap-3">
        <Mark tone={mark ?? "ink"} />
        <span className="sep-line flex-1" />
        <Mark tone="soft" />
      </div>
      <h1 className="font-display text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-[2.65rem]">
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
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  mark?: "ink" | "pine" | "copper" | "moss" | "soft";
}) {
  return (
    <section className={`mt-14 sm:mt-16 ${className}`}>
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
  mark?: "ink" | "pine" | "copper" | "moss" | "soft";
  className?: string;
}) {
  return (
    <div
      className={`mt-1 flex items-baseline justify-between gap-4 border-t-2 border-ink pt-4 pb-1 ${className}`}
    >
      <span className="flex items-center gap-2 font-display text-base tracking-tight">
        <Mark tone={mark} /> {label}
      </span>
      {children}
    </div>
  );
}
