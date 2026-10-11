import { describe, expect, it } from "vitest";
import { all } from "../server/db.ts";
import { authed, testApp } from "./helpers.ts";

describe("demo auth", () => {
  it("creates a demo session with sample work", async () => {
    const { app, db } = testApp();
    const res = await app.request("/api/auth/demo", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { email: string; businessName: string } };
    expect(body.user.email).toBe("demo@quotelite.local");
    expect(body.user.businessName).toBe("Ridgeway Trades");

    const cookie = res.headers.getSetCookie?.().find((item) => item.startsWith("ql_session="))?.split(";")[0];
    expect(cookie).toBeTruthy();

    const me = await app.request("/api/auth/me", authed(cookie!));
    expect(me.status).toBe(200);

    const quotes = all<{ number: string }>(db, "SELECT number FROM quotes WHERE crew_id = (SELECT crew_id FROM users WHERE email = ?)", "demo@quotelite.local");
    expect(quotes.some((quote) => quote.number === "Q-1001")).toBe(true);

    const again = await app.request("/api/auth/demo", { method: "POST" });
    expect(again.status).toBe(200);
    const againBody = (await again.json()) as { user: { email: string } };
    expect(againBody.user.email).toBe("demo@quotelite.local");
  });
});
