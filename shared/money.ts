export class PaymentError extends Error {
  code: "INVALID" | "OVERPAYMENT";

  constructor(code: "INVALID" | "OVERPAYMENT", message: string) {
    super(message);
    this.code = code;
  }
}

export function lineCents(qtyMilli: number, unitPriceCents: number): number {
  return Math.round((qtyMilli * unitPriceCents) / 1000);
}

export function computeTotals(lines: { lineCents: number }[], taxBps: number) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);
  const taxCents = Math.round((subtotalCents * taxBps) / 10000);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export function paidTotal(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

export function balanceDue(totalCents: number, paidCents: number): number {
  return totalCents - paidCents;
}

export function statusFor(totalCents: number, paidCents: number): "open" | "partial" | "paid" {
  if (paidCents <= 0) return "open";
  if (paidCents < totalCents) return "partial";
  return "paid";
}

export function assertCanPay(totalCents: number, paidCents: number, amountCents: number): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new PaymentError("INVALID", "Enter a payment greater than zero.");
  }
  const due = balanceDue(totalCents, paidCents);
  if (amountCents > due) {
    throw new PaymentError("OVERPAYMENT", "That is more than the balance due.");
  }
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function formatQty(milli: number): string {
  const whole = milli / 1000;
  return Number.isInteger(whole) ? String(whole) : String(Math.round(whole * 1000) / 1000);
}

export function formatPercent(bps: number): string {
  const value = bps / 100;
  return Number.isInteger(value) ? String(value) : String(value);
}

export function formatDollarsInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function parseDollars(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [dollars, cents = ""] = trimmed.split(".");
  const value = Number(dollars) * 100 + Number(cents.padEnd(2, "0").slice(0, 2));
  return Number.isSafeInteger(value) ? value : null;
}

export function parseQty(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (value <= 0) return null;
  return Math.round(value * 1000);
}

export function parseTaxPercent(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return 0;
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  const bps = Math.round(Number(trimmed) * 100);
  if (bps < 0 || bps > 3000) return null;
  return bps;
}
