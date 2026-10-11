import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";

const dbPath = process.env.DB_PATH || "data/quotelite.sqlite";
if (process.env.E2E_RESET === "1" && dbPath !== ":memory:" && existsSync(dbPath)) unlinkSync(dbPath);
if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });

const { app } = createApp(dbPath);
const port = Number(process.env.PORT || 8787);
const hostname = process.env.HOST || "0.0.0.0";
serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`listening ${info.address}:${info.port}`);
});
