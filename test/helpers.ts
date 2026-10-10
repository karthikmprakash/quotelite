import type { Hono } from "hono";
import { createApp } from "../server/app.ts";

type App = { request: Hono["request"] };

export function cookieFrom(res: Response): string {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie") || ""];
  const raw = list.find((item) => item.startsWith("ql_session=")) || "";
  return raw.split(";")[0];
}

export function testApp() {
  return createApp(":memory:");
}

export async function signup(app: App, email = `rosa-${crypto.randomUUID()}@example.com`) {
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Rosa Alvarez",
      businessName: "Alvarez Plumbing",
      email,
      password: "test-pass-1234",
      plan: "solo",
    }),
  });
  const body = (await res.json()) as { user: { id: string; crewId: string; businessName: string }; error?: string };
  return { status: res.status, cookie: cookieFrom(res), body, email };
}

export function authed(cookie: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return { ...init, headers };
}
