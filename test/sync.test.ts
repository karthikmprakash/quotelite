import { describe, expect, it } from "vitest";
import { get } from "../server/db.ts";
import { authed, signup, testApp } from "./helpers.ts";

describe("sync once", () => {
  it("applies the same op a second time without a second row", async () => {
    const { app, db } = testApp();
    const account = await signup(app);
    const now = "2026-10-10T12:00:00.000Z";
    const customerId = crypto.randomUUID();
    const quoteId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const ops = [
      { id: "op-customer", entity: "customer", action: "upsert", recordId: customerId, at: now, payload: { name: "Rosa Alvarez", createdAt: now, updatedAt: now } },
      {
        id: "op-quote",
        entity: "quote",
        action: "upsert",
        recordId: quoteId,
        at: now,
        payload: {
          customerId,
          number: "Q-1001",
          status: "approved",
          taxBps: 0,
          notes: "Tap",
          terms: "Due on completion.",
          publicToken: "publictoken1",
          lines: [{ id: "line-1", description: "Faucet", qtyMilli: 1000, unitPriceCents: 5000 }],
          photos: [],
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        id: "op-invoice",
        entity: "invoice",
        action: "upsert",
        recordId: invoiceId,
        at: "2026-10-10T12:00:01.000Z",
        payload: {
          customerId,
          quoteId,
          number: "INV-1001",
          taxBps: 0,
          notes: "Tap",
          terms: "Due on completion.",
          publicToken: "publictoken2",
          lines: [{ id: "line-2", description: "Faucet", qtyMilli: 1000, unitPriceCents: 5000 }],
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        id: "op-payment",
        entity: "payment",
        action: "upsert",
        recordId: paymentId,
        at: "2026-10-10T12:00:02.000Z",
        payload: { invoiceId, amountCents: 5000, method: "cash", createdAt: now },
      },
    ];
    const send = () =>
      app.request("/api/sync", authed(account.cookie, { method: "POST", body: JSON.stringify({ ops }) }));
    const first = await (await send()).json();
    const second = await (await send()).json();
    expect(first.acked).toHaveLength(4);
    expect(second.acked).toHaveLength(4);
    expect(second.rejected).toEqual([]);
    expect(get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM quotes")?.n).toBe(1);
    expect(get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM invoices")?.n).toBe(1);
    expect(get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM payments")?.n).toBe(1);
    expect(get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM customers")?.n).toBe(1);
    const other = await signup(app, `other-${crypto.randomUUID()}@example.com`);
    const hidden = (await (await app.request("/api/sync", authed(other.cookie))).json()) as { quotes: unknown[] };
    expect(hidden.quotes).toEqual([]);
  });
});
