import { useState } from "react";
import { kz, parseKzInput } from "../domain/money";

export function Money({
  n,
  tone,
  large,
}: {
  n: number;
  tone?: "in" | "out" | "mute" | "plain";
  large?: boolean;
}) {
  const color =
    tone === "in"
      ? "text-pine"
      : tone === "out"
        ? "text-rust"
        : tone === "mute"
          ? "text-ink/40"
          : "text-ink";

  return (
    <span
      className={`num font-semibold ${large ? "text-[2.15rem] leading-none tracking-[-0.04em] sm:text-[3.35rem]" : ""} ${color}`}
    >
      {kz(n)}
    </span>
  );
}

/** Campo de Kz. Mantém o que está a ser escrito (`1.500.`) e grava quando o número fecha. */
export function KzInput({
  value,
  onValue,
  className,
  placeholder,
}: {
  value: number;
  onValue: (n: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className={className}
      inputMode="decimal"
      placeholder={placeholder}
      value={draft ?? String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = parseKzInput(raw);
        if (n != null) onValue(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
