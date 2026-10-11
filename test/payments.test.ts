import { describe, expect, it } from "vitest";
import {
  PaymentError,
  assertCanPay,
  balanceDue,
  computeTotals,
  formatMoney,
  lineCents,
  parseDollars,
  parseQty,
  parseTaxPercent,
  statusFor,
} from "../shared/money.ts";
import { authed, signup, testApp } from "./helpers.ts";

describe("payment math", () => {
  it("prices lines and tax with half-up cents", () => {
    expect(lineCents(1000, 1000)).toBe(1000);
    expect(lineCents(1500, 1999)).toBe(2999);
    expect(lineCents(333, 1000)).toBe(333);
    expect(computeTotals([{ lineCents: 999 }], 1000)).toEqual({ subtotalCents: 999, taxCents: 100, totalCents: 1099 });
    expect(computeTotals([{ lineCents: 1000 }], 825)).toEqual({ subtotalCents: 1000, taxCents: 83, totalCents: 1083 });
    expect(formatMoney(1083)).toBe("$10.83");
    expect(formatMoney(123456789)).toBe("$1,234,567.89");
    expect(parseDollars("12.50")).toBe(1250);
    expect(parseDollars("$1,250.00")).toBe(125000);
    expect(parseDollars("1,25")).toBeNull();
    expect(parseQty("1.5")).toBe(1500);
    expect(parseTaxPercent("8.25")).toBe(825);
  });

  it("takes a partial, then the rest, and refuses an overpayment", () => {
    const total = 1083;
    expect(statusFor(total, 0)).toBe("open");
    assertCanPay(total, 0, 400);
    const afterPartial = 400;
    expect(balanceDue(total, afterPartial)).toBe(683);
    expect(statusFor(total, afterPartial)).toBe("partial");
    assertCanPay(total, afterPartial, 683);
    expect(statusFor(total, 1083)).toBe("paid");
    expect(balanceDue(total, 1083)).toBe(0);
    expect(() => assertCanPay(total, afterPartial, 684)).toThrow(PaymentError);
    expect(() => assertCanPay(total, afterPartial, 684)).toThrow(/more than the balance/);
    expect(() => assertCanPay(total, 0, 0)).toThrow(/greater than zero/);
  });
});

describe("payment sync", () => {
  it("keeps the balance and rejects an overpayment on the server", async () => {
    const { app } = testApp();
    const account = await signup(app);
    const now = "2026-10-10T12:00:00.000Z";
    const customerId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    const third = crypto.randomUUID();
    const line = { id: crypto.randomUUID(), description: "Faucet", qtyMilli: 1000, unitPriceCents: 1000 };
    const base = [
      { id: crypto.randomUUID(), entity: "customer", action: "upsert", recordId: customerId, at: now, payload: { name: "Rosa Alvarez", createdAt: now, updatedAt: now } },
      {
        id: crypto.randomUUID(),
        entity: "invoice",
        action: "upsert",
        recordId: invoiceId,
        at: now,
        payload: {
          customerId,
          number: "INV-1001",
          taxBps: 825,
          notes: "",
          terms: "Payment is due when the work is done.",
          publicToken: "invitetoken",
          lines: [line],
          createdAt: now,
          updatedAt: now,
        },
      },
    ];
    const seeded = await app.request("/api/sync", authed(account.cookie, { method: "POST", body: JSON.stringify({ ops: base }) }));
    expect(seeded.status).toBe(200);
    const partial = await app.request(
      "/api/sync",
      authed(account.cookie, {
        method: "POST",
        body: JSON.stringify({
          ops: [{ id: first, entity: "payment", action: "upsert", recordId: first, at: now, payload: { invoiceId, amountCents: 400, method: "cash", createdAt: now } }],
        }),
      }),
    );
    expect((await partial.json()).acked).toContain(first);
    const rest = await app.request(
      "/api/sync",
      authed(account.cookie, {
        method: "POST",
        body: JSON.stringify({
          ops: [{ id: second, entity: "payment", action: "upsert", recordId: second, at: now, payload: { invoiceId, amountCents: 683, method: "cash", createdAt: now } }],
        }),
      }),
    );
    expect((await rest.json()).acked).toContain(second);
    const over = await app.request(
      "/api/sync",
      authed(account.cookie, {
        method: "POST",
        body: JSON.stringify({
          ops: [{ id: third, entity: "payment", action: "upsert", recordId: third, at: now, payload: { invoiceId, amountCents: 1, method: "cash", createdAt: now } }],
        }),
      }),
    );
    const overBody = (await over.json()) as { rejected: { error: string; permanent: boolean }[] };
    expect(overBody.rejected[0].error).toMatch(/more than the balance/);
    expect(overBody.rejected[0].permanent).toBe(true);
    const snap = (await (await app.request("/api/sync", authed(account.cookie))).json()) as {
      invoices: { status: string; totalCents: number; payments: { amountCents: number; feeCents: number }[] }[];
    };
    expect(snap.invoices).toHaveLength(1);
    expect(snap.invoices[0].status).toBe("paid");
    expect(snap.invoices[0].payments).toHaveLength(2);
    expect(snap.invoices[0].payments.every((payment) => payment.feeCents === 0)).toBe(true);
    const paid = snap.invoices[0].payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    expect(paid).toBe(snap.invoices[0].totalCents);
  });
});