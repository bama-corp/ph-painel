export const roundKz = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Lê um campo de valor em Kz.
 * `1500` · `1.500` · `1.500.000` · `1.500,50` · `1500,5` · `10.5`.
 * Separador a meio (`1.` / `1.500.`) devolve null para o texto poder continuar.
 */
export function parseKzInput(raw: string): number | null {
  const s = raw.trim().replace(/[\s\u00a0]/g, "");
  if (!s || /[.,]$/.test(s)) return null;
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      const intRaw = s.slice(0, lastComma);
      const dec = s.slice(lastComma + 1);
      if (!/^\d{1,2}$/.test(dec)) return null;
      if (!/^\d{1,3}(\.\d{3})*$/.test(intRaw) && !/^\d+$/.test(intRaw)) return null;
      normalized = `${intRaw.replace(/\./g, "")}.${dec}`;
    } else {
      const intRaw = s.slice(0, lastDot);
      const dec = s.slice(lastDot + 1);
      if (!/^\d{1,2}$/.test(dec)) return null;
      if (!/^\d{1,3}(,\d{3})*$/.test(intRaw) && !/^\d+$/.test(intRaw)) return null;
      normalized = `${intRaw.replace(/,/g, "")}.${dec}`;
    }
  } else if (lastComma >= 0) {
    const intRaw = s.slice(0, lastComma);
    const dec = s.slice(lastComma + 1);
    if (!/^\d+$/.test(intRaw) || !/^\d{1,2}$/.test(dec)) return null;
    normalized = `${intRaw}.${dec}`;
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
    else if (/^\d+\.\d{1,2}$/.test(s)) normalized = s;
    else return null;
  } else if (/^\d+$/.test(s)) {
    normalized = s;
  } else {
    return null;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundKz(n);
}

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

const MONTHS_SHORT_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** Data local de hoje em ISO `YYYY-MM-DD`. */
export function todayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Mês local actual em ISO `YYYY-MM`. */
export function currentMonthIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Ex.: `19 set 2026`. */
export function formatDatePt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_SHORT_PT[m - 1]} ${y}`;
}

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
