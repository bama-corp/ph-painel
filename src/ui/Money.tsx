import { kz } from "../domain/money";

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
      className={`num ${large ? "text-[2.15rem] leading-none tracking-[-0.04em] sm:text-[3.35rem]" : ""} ${color}`}
    >
      {kz(n)}
    </span>
  );
}
