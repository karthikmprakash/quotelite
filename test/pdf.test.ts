import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractText, extractTextItems } from "unpdf";
import { authed, signup, testApp } from "./helpers.ts";

const LOGO =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGPo0ecjCTGMahjVMHw1AABbHMkBArVH8wAAAABJRU5ErkJggg==";

const LONG =
  "The shutoff valve sits behind the sink cabinet and the supply lines are original copper that we will replace back to the angle stop before the new faucet goes on.";

async function textOf(bytes: Uint8Array): Promise<string> {
  const extracted = await extractText(bytes, { mergePages: true });
  return extracted.text;
}

describe("quote PDF", () => {
  it("renders logo, tax, totals, terms, and a wrapped description", async () => {
    const { app } = testApp();
    const account = await signup(app);
    const now = "2026-10-10T12:00:00.000Z";
    const customerId = crypto.randomUUID();
    const quoteId = crypto.randomUUID();
    const crewId = account.body.user.crewId;
    const ops = [
      {
        id: crypto.randomUUID(),
        entity: "business",
        action: "upsert",
        recordId: crewId,
        at: now,
        payload: {
          name: "Alvarez Plumbing",
          phone: "5551212121",
          email: account.email,
          taxBps: 825,
          terms: "Payment is due when the work is done.",
          logoMime: "image/png",
          logoBase64: LOGO,
          updatedAt: now,
        },
      },
      {
        id: crypto.randomUUID(),
        entity: "customer",
        action: "upsert",
        recordId: customerId,
        at: now,
        payload: { name: "Rosa Alvarez", createdAt: now, updatedAt: now },
      },
      {
        id: crypto.randomUUID(),
        entity: "quote",
        action: "upsert",
        recordId: quoteId,
        at: now,
        payload: {
          customerId,
          number: "Q-1001",
          status: "draft",
          taxBps: 825,
          notes: "Shutoff is under the sink.",
          terms: "Payment is due when the work is done.",
          publicToken: "pdftoken",
          lines: [
            { id: "l1", description: "Replace the kitchen faucet", qtyMilli: 1000, unitPriceCents: 10000 },
            { id: "l2", description: LONG, qtyMilli: 1000, unitPriceCents: 2500 },
          ],
          createdAt: now,
          updatedAt: now,
        },
      },
    ];
    const synced = await app.request("/api/sync", authed(account.cookie, { method: "POST", body: JSON.stringify({ ops }) }));
    expect((await synced.json()).rejected).toEqual([]);
    const pdf = await app.request(`/api/quotes/${quoteId}/pdf`, authed(account.cookie));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    expect(Buffer.from(bytes).toString("latin1")).toContain("/Image");
    const text = await textOf(bytes.slice());
    for (const piece of [
      "Alvarez Plumbing",
      "QUOTE",
      "Q-1001",
      "Rosa Alvarez",
      "Replace the kitchen faucet",
      "angle stop",
      "Subtotal",
      "Tax (8.25%)",
      "Total",
      "Notes",
      "Shutoff is under the sink.",
      "Terms",
      "Payment is due when the work is done.",
      "$100.00",
      "$25.00",
      "$125.00",
    ]) {
      expect(text, piece).toContain(piece);
    }
    const items = await extractTextItems(bytes.slice());
    const layout = items.items.flat().map((item) => ({
      str: item.str,
      x: Math.round(item.x),
      y: Math.round(item.y),
    }));
    mkdirSync("test/golden", { recursive: true });
    const goldenPath = "test/golden/quote-layout.json";
    if (process.env.UPDATE_GOLDEN === "1" || !existsSync(goldenPath)) {
      writeFileSync(goldenPath, JSON.stringify(layout, null, 2));
    }
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as typeof layout;
    expect(layout).toEqual(golden);
  });

  it("keeps a long quote on a second page instead of clipping lines", async () => {
    const { app } = testApp();
    const account = await signup(app);
    const now = "2026-10-10T12:00:00.000Z";
    const customerId = crypto.randomUUID();
    const quoteId = crypto.randomUUID();
    const lines = Array.from({ length: 40 }, (_, index) => ({
      id: `p${index}`,
      description: `Outlet number ${index + 1} on the north wall`,
      qtyMilli: 1000,
      unitPriceCents: 1500,
    }));
    const ops = [
      { id: crypto.randomUUID(), entity: "customer", action: "upsert", recordId: customerId, at: now, payload: { name: "Rosa Alvarez", createdAt: now, updatedAt: now } },
      {
        id: crypto.randomUUID(),
        entity: "quote",
        action: "upsert",
        recordId: quoteId,
        at: now,
        payload: {
          customerId,
          number: "Q-1040",
          status: "draft",
          taxBps: 0,
          notes: "",
          terms: "Payment is due when the work is done.",
          publicToken: "pdftoken2",
          lines,
          createdAt: now,
          updatedAt: now,
        },
      },
    ];
    expect((await (await app.request("/api/sync", authed(account.cookie, { method: "POST", body: JSON.stringify({ ops }) }))).json()).rejected).toEqual([]);
    const pdf = await app.request(`/api/quotes/${quoteId}/pdf`, authed(account.cookie));
    const text = await textOf(new Uint8Array(await pdf.arrayBuffer()));
    expect(text).toContain("Outlet number 1 on the north wall");
    expect(text).toContain("Outlet number 40 on the north wall");
    expect(text).toContain("Page 2 of");
  });
});
