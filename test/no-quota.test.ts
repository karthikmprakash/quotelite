import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authed, signup, testApp } from "./helpers.ts";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(path);
  }
  return out;
}

describe("no person or quote caps", () => {
  it("has no seat or quota check in the product code", () => {
    const banned = [/\bseats?\b/i, /\bquotas?\b/i, /maxUsers/, /maxQuotes/, /perSeat/, /quoteLimit/];
    const hits: string[] = [];
    for (const file of [...sourceFiles("src"), ...sourceFiles("server"), ...sourceFiles("shared")]) {
      const text = readFileSync(file, "utf8");
      for (const pattern of banned) {
        if (pattern.test(text)) hits.push(`${file} ${pattern}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("lets a crew add people and quotes without a cap", async () => {
    const { app } = testApp();
    const owner = await signup(app);
    expect(owner.status).toBe(200);
    for (let i = 0; i < 4; i += 1) {
      const res = await app.request(
        "/api/team",
        authed(owner.cookie, {
          method: "POST",
          body: JSON.stringify({ name: `Helper ${i}`, email: `helper-${i}-${crypto.randomUUID()}@example.com`, password: "test-pass-1234" }),
        }),
      );
      expect(res.status).toBe(200);
    }
    const team = (await (await app.request("/api/team", authed(owner.cookie))).json()) as { people: unknown[] };
    expect(team.people.length).toBe(5);
    const now = "2026-10-10T12:00:00.000Z";
    const customerId = crypto.randomUUID();
    const ops = [
      { id: crypto.randomUUID(), entity: "customer", action: "upsert", recordId: customerId, at: now, payload: { name: "Rosa Alvarez", createdAt: now, updatedAt: now } },
    ];
    for (let i = 0; i < 6; i += 1) {
      const id = crypto.randomUUID();
      ops.push({
        id: crypto.randomUUID(),
        entity: "quote",
        action: "upsert",
        recordId: id,
        at: now,
        payload: {
          customerId,
          number: `Q-${2000 + i}`,
          status: "draft",
          taxBps: 0,
          notes: "",
          terms: "",
          publicToken: crypto.randomUUID().replace(/-/g, ""),
          lines: [{ id: crypto.randomUUID(), description: `Line ${i}`, qtyMilli: 1000, unitPriceCents: 100 }],
          createdAt: now,
          updatedAt: now,
        },
      } as never);
    }
    const synced = await app.request("/api/sync", authed(owner.cookie, { method: "POST", body: JSON.stringify({ ops }) }));
    expect(synced.status).toBe(200);
    const body = (await synced.json()) as { rejected: unknown[] };
    expect(body.rejected).toEqual([]);
    const snap = (await (await app.request("/api/sync", authed(owner.cookie))).json()) as { quotes: unknown[] };
    expect(snap.quotes.length).toBe(6);
  });
});
