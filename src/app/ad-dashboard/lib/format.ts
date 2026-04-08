export function fmtN(n: number): string {
  if (!n) return "-";
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

export function fmtCurrency(n: number): string {
  if (!n) return "-";
  return `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

export function fmtSigned(n: number): string {
  if (!n) return "-";
  const s = n > 0 ? "+" : "";
  return `${s}₪${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
}

export function fmtPct(n: number): string {
  if (!n) return "-";
  return `${n.toFixed(1)}%`;
}

export function fmtRoas(n: number): string {
  if (!n) return "-";
  return `${n.toFixed(2)}x`;
}

export function fmtDec(n: number): string {
  if (!n) return "-";
  return `₪${n.toFixed(1)}`;
}

export function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("he-IL");
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}
