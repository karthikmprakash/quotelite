import { describe, expect, it } from "vitest";
import { get, run } from "../server/db.ts";
import { authed, signup, testApp } from "./helpers.ts";

const charge = process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || process.env.STRIPE_API_HOST ? it : it.skip;

describe("bring your own test account", () => {
  it("refuses a live secret and stores a test secret without returning it", async () => {
    const { app, db } = testApp();
    const account = await signup(app);
    const liveSecret = "sk_" + "live_example";
    const livePublishable = "pk_" + "live_example";
    const live = await app.request(
      "/api/settings/stripe",
      authed(account.cookie, { method: "PUT", body: JSON.stringify({ secret: liveSecret, publishable: livePublishable }) }),
    );
    expect(live.status).toBe(400);
    const saved = await app.request(
      "/api/settings/stripe",
      authed(account.cookie, { method: "PUT", body: JSON.stringify({ secret: "sk_test_example", publishable: "pk_test_example" }) }),
    );
    expect(saved.status).toBe(200);
    const settings = (await (await app.request("/api/settings", authed(account.cookie))).json()) as { business: { payments: string } };
    expect(settings.business.payments).toBe("test");
    expect(JSON.stringify(settings)).not.toContain("sk_test_example");
    expect(() =>
      run(
        db,
        `INSERT INTO payments (id, crew_id, invoice_id, amount_cents, fee_cents, method, created_at)
         VALUES ('fee', ?, 'missing', 1, 1, 'cash', ?)`,
        account.body.user.crewId,
        "2026-10-10T12:00:00.000Z",
      ),
    ).toThrow();
    expect(get(db, "SELECT id FROM payments WHERE id = 'fee'")).toBeUndefined();
  });

  charge("charges the balance on a test card and adds no platform fee", async () => {
    const { app } = testApp();
    const account = await signup(app);
    const secret = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
    const publishable = secret.startsWith("sk_test_") ? "pk_test_mock" : "pk_test_mock";
    const connected = await app.request(
      "/api/settings/stripe",
      authed(account.cookie, { method: "PUT", body: JSON.stringify({ secret, publishable }) }),
    );
    expect(connected.status).toBe(200);
    const now = "2026-10-10T12:00:00.000Z";
    const customerId = crypto.randomUUID();
    const invoiceId = crypto.randomUUID();
    const ops = [
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
          taxBps: 0,
          notes: "",
          terms: "Payment is due when the work is done.",
          publicToken: "paytoken",
          lines: [{ id: "l1", description: "Faucet", qtyMilli: 1000, unitPriceCents: 2000 }],
          createdAt: now,
          updatedAt: now,
        },
      },
    ];
    expect((await (await app.request("/api/sync", authed(account.cookie, { method: "POST", body: JSON.stringify({ ops }) }))).json()).rejected).toEqual([]);
    const paid = await app.request("/api/public/invoices/paytoken/pay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), paymentMethod: "pm_card_visa" }),
    });
    const body = (await paid.json()) as {
      status: string;
      balanceCents: number;
      applicationFeeAmount: number | null;
      payments: { feeCents: number; amountCents: number }[];
      error?: string;
    };
    expect(paid.status, body.error).toBe(200);
    expect(body.status).toBe("paid");
    expect(body.balanceCents).toBe(0);
    expect(body.applicationFeeAmount).toBeNull();
    expect(body.payments[0].feeCents).toBe(0);
    expect(body.payments[0].amountCents).toBe(2000);
  });
});
