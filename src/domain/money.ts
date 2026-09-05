export const roundKz = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function kz(n: number, digits = 2) {
  return `${new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)} Kz`;
}

export function kzShort(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(".", ",")} M Kz`;
  if (abs >= 10_000) return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(n)} Kz`;
  return kz(n);
}

export const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_PT[(m ?? 1) - 1]} ${y}`;
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function inMonth(iso: string, month: string) {
  return iso.startsWith(month);
}
