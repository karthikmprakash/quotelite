import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { existsSync, readFileSync } from "node:fs";
import { hashPassword, sessionToken, validEmail, verifyPassword } from "./auth.ts";
import { all, get, nowIso, openDatabase, run, uid, type DB } from "./db.ts";
import { renderDocumentPdf, type PdfDoc } from "../shared/pdf.ts";
import { balanceDue, formatMoney, paidTotal } from "../shared/money.ts";
import { chargeTestCard } from "./stripe.ts";
import {
  businessOf,
  recordEvent,
  refreshInvoiceStatus,
  snapshot,
  sumPayments,
  applyOps,
  type SyncOp,
} from "./sync.ts";

export type SessionUser = {
  id: string;
  crewId: string;
  name: string;
  email: string;
  role: "owner" | "helper";
  businessName: string;
};

type Vars = { user: SessionUser };

const DEFAULT_TERMS = "Payment is due when the work is done. This quote is good for 30 days.";

function pathOf(c: { req: { url: string } }): string {
  return new URL(c.req.url).pathname;
}

function readUser(db: DB, token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = get<{
    id: string;
    crew_id: string;
    name: string;
    email: string;
    role: "owner" | "helper";
    business_name: string;
  }>(
    db,
    `SELECT users.id, users.crew_id, users.name, users.email, users.role, crews.name AS business_name
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     JOIN crews ON crews.id = users.crew_id
     WHERE sessions.token = ? AND sessions.expires_at > ?`,
    token,
    nowIso(),
  );
  if (!row) return null;
  return {
    id: row.id,
    crewId: row.crew_id,
    name: row.name,
    email: row.email,
    role: row.role,
    businessName: row.business_name,
  };
}

function issueSession(c: { header: (name: string, value: string) => void }, db: DB, userId: string): void {
  const token = sessionToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  run(db, "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, userId, expires);
  setCookie(c as never, "ql_session", token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

function issuedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type DocRow = {
  id: string;
  crew_id: string;
  customer_id: string;
  number: string;
  status: string;
  tax_bps: number;
  notes: string;
  terms: string;
  public_token: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  created_at: string;
  customer_name: string;
  business_name: string;
  logo_mime: string | null;
  logo_base64: string | null;
  quote_id?: string | null;
  scheduled_date?: string | null;
};

function loadQuote(db: DB, where: string, ...values: Array<string | number | null>): DocRow | undefined {
  return get<DocRow>(
    db,
    `SELECT quotes.id, quotes.crew_id, quotes.customer_id, quotes.number, quotes.status, quotes.tax_bps,
      quotes.notes, quotes.terms, quotes.public_token, quotes.subtotal_cents, quotes.tax_cents,
      quotes.total_cents, quotes.created_at, customers.name AS customer_name, crews.name AS business_name,
      crews.logo_mime, crews.logo_base64
     FROM quotes
     JOIN customers ON customers.id = quotes.customer_id
     JOIN crews ON crews.id = quotes.crew_id
     WHERE ${where}`,
    ...values,
  );
}

function loadInvoice(db: DB, where: string, ...values: Array<string | number | null>): DocRow | undefined {
  return get<DocRow>(
    db,
    `SELECT invoices.id, invoices.crew_id, invoices.customer_id, invoices.quote_id, invoices.number,
      invoices.status, invoices.tax_bps, invoices.notes, invoices.terms, invoices.public_token,
      invoices.subtotal_cents, invoices.tax_cents, invoices.total_cents, invoices.scheduled_date,
      invoices.created_at, customers.name AS customer_name, crews.name AS business_name,
      crews.logo_mime, crews.logo_base64
     FROM invoices
     JOIN customers ON customers.id = invoices.customer_id
     JOIN crews ON crews.id = invoices.crew_id
     WHERE ${where}`,
    ...values,
  );
}

function linesOf(db: DB, table: "quote_lines" | "invoice_lines", column: string, id: string) {
  return all<{
    description: string;
    qty_milli: number;
    unit_price_cents: number;
    line_cents: number;
  }>(
    db,
    `SELECT description, qty_milli, unit_price_cents, line_cents FROM ${table} WHERE ${column} = ? ORDER BY position`,
    id,
  ).map((row) => ({
    description: row.description,
    qtyMilli: row.qty_milli,
    unitPriceCents: row.unit_price_cents,
    lineCents: row.line_cents,
  }));
}

async function pdfFor(db: DB, row: DocRow, kind: "quote" | "invoice"): Promise<Uint8Array> {
  const lines =
    kind === "quote" ? linesOf(db, "quote_lines", "quote_id", row.id) : linesOf(db, "invoice_lines", "invoice_id", row.id);
  const paid = kind === "invoice" ? sumPayments(db, row.id) : 0;
  const doc: PdfDoc = {
    kind,
    businessName: row.business_name,
    number: row.number,
    issuedLabel: issuedLabel(row.created_at),
    customerName: row.customer_name,
    lines,
    subtotalCents: row.subtotal_cents,
    taxBps: row.tax_bps,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    notes: row.notes,
    terms: row.terms,
    logoBytes: row.logo_base64 ? new Uint8Array(Buffer.from(row.logo_base64, "base64")) : undefined,
    paidCents: paid,
    balanceCents: balanceDue(row.total_cents, paid),
  };
  const rendered = await renderDocumentPdf(doc);
  return rendered.bytes;
}

function publicQuote(db: DB, row: DocRow) {
  const photos = all<{ mime: string; data_base64: string }>(
    db,
    "SELECT mime, data_base64 FROM quote_photos WHERE quote_id = ? ORDER BY position",
    row.id,
  );
  return {
    number: row.number,
    status: row.status,
    customerName: row.customer_name,
    businessName: row.business_name,
    logoDataUrl: row.logo_base64 ? `data:${row.logo_mime || "image/png"};base64,${row.logo_base64}` : null,
    notes: row.notes,
    terms: row.terms,
    taxBps: row.tax_bps,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    issuedLabel: issuedLabel(row.created_at),
    lines: linesOf(db, "quote_lines", "quote_id", row.id),
    photos: photos.map((photo, index) => ({
      alt: `Quote photo ${index + 1}`,
      dataUrl: `data:${photo.mime};base64,${photo.data_base64}`,
    })),
  };
}

function publicInvoice(db: DB, row: DocRow) {
  const business = businessOf(db, row.crew_id);
  const payments = all<{ amount_cents: number; fee_cents: number; method: string; created_at: string }>(
    db,
    "SELECT amount_cents, fee_cents, method, created_at FROM payments WHERE invoice_id = ? ORDER BY created_at",
    row.id,
  );
  const paid = paidTotal(payments.map((payment) => payment.amount_cents));
  return {
    number: row.number,
    status: row.status,
    customerName: row.customer_name,
    businessName: row.business_name,
    logoDataUrl: row.logo_base64 ? `data:${row.logo_mime || "image/png"};base64,${row.logo_base64}` : null,
    notes: row.notes,
    terms: row.terms,
    taxBps: row.tax_bps,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    paidCents: paid,
    balanceCents: balanceDue(row.total_cents, paid),
    issuedLabel: issuedLabel(row.created_at),
    scheduledDate: row.scheduled_date,
    payments: payments.map((payment) => ({
      amountCents: payment.amount_cents,
      feeCents: payment.fee_cents,
      method: payment.method,
      createdAt: payment.created_at,
    })),
    cardPayments: business?.payments === "test" ? "test" : "off",
    lines: linesOf(db, "invoice_lines", "invoice_id", row.id),
  };
}

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function createApp(dbPath: string) {
  const db = openDatabase(dbPath);
  const app = new Hono<{ Variables: Vars }>();

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post("/api/auth/signup", async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const business = String(body?.businessName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const plan = body?.plan === "crew" ? "crew" : "solo";
    if (!name || !business) return c.json({ error: "Add your name and the business name." }, 400);
    if (!validEmail(email)) return c.json({ error: "That email does not look right." }, 400);
    if (password.length < 8) return c.json({ error: "Use a password of at least 8 characters." }, 400);
    if (get(db, "SELECT id FROM users WHERE email = ?", email)) {
      return c.json({ error: "That email is already in use." }, 409);
    }
    const crewId = uid();
    const userId = uid();
    const at = nowIso();
    db.exec("BEGIN");
    try {
      run(
        db,
        `INSERT INTO crews (id, name, phone, email, plan, tax_bps, terms, created_at, updated_at)
         VALUES (?, ?, '', ?, ?, 0, ?, ?, ?)`,
        crewId,
        business,
        email,
        plan,
        DEFAULT_TERMS,
        at,
        at,
      );
      run(
        db,
        `INSERT INTO users (id, crew_id, name, email, password_hash, role, created_at)
         VALUES (?, ?, ?, ?, ?, 'owner', ?)`,
        userId,
        crewId,
        name,
        email,
        hashPassword(password),
        at,
      );
      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* closed */
      }
      throw err;
    }
    issueSession(c, db, userId);
    return c.json({
      user: { id: userId, crewId, name, email, role: "owner" as const, businessName: business },
    });
  });

  app.post("/api/auth/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const row = get<{ id: string; password_hash: string }>(
      db,
      "SELECT id, password_hash FROM users WHERE email = ?",
      email,
    );
    if (!row || !verifyPassword(password, row.password_hash)) {
      return c.json({ error: "Email or password is wrong." }, 401);
    }
    issueSession(c, db, row.id);
    const issued = get<{ token: string }>(
      db,
      "SELECT token FROM sessions WHERE user_id = ? ORDER BY expires_at DESC",
      row.id,
    );
    return c.json({ user: readUser(db, issued?.token) });
  });

  app.post("/api/auth/logout", (c) => {
    const token = getCookie(c, "ql_session");
    if (token) run(db, "DELETE FROM sessions WHERE token = ?", token);
    deleteCookie(c, "ql_session", { path: "/" });
    return c.json({ ok: true });
  });

  app.use("/api/*", async (c, next) => {
    const path = pathOf(c);
    if (
      path === "/api/health" ||
      path === "/api/auth/login" ||
      path === "/api/auth/signup" ||
      path === "/api/auth/logout" ||
      path.startsWith("/api/public/")
    ) {
      return next();
    }
    const user = readUser(db, getCookie(c, "ql_session"));
    if (!user) return c.json({ error: "Sign in required." }, 401);
    c.set("user", user);
    await next();
  });

  app.get("/api/auth/me", (c) => c.json({ user: c.get("user") }));

  app.get("/api/sync", (c) => c.json(snapshot(db, c.get("user").crewId)));

  app.post("/api/sync", async (c) => {
    const body = await c.req.json().catch(() => null);
    const ops = Array.isArray(body?.ops) ? (body.ops as SyncOp[]) : null;
    if (!ops) return c.json({ error: "Send a list of changes." }, 400);
    if (ops.length > 200) return c.json({ error: "Too many changes at once." }, 400);
    const result = applyOps(db, c.get("user").crewId, ops);
    return c.json(result);
  });

  app.get("/api/team", (c) => {
    const people = all<{ id: string; name: string; email: string; role: string }>(
      db,
      "SELECT id, name, email, role FROM users WHERE crew_id = ? ORDER BY created_at",
      c.get("user").crewId,
    );
    return c.json({ people });
  });

  app.post("/api/team", async (c) => {
    const user = c.get("user");
    if (user.role !== "owner") return c.json({ error: "Only the owner can add people." }, 403);
    const body = await c.req.json().catch(() => null);
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!name) return c.json({ error: "Add a name." }, 400);
    if (!validEmail(email)) return c.json({ error: "That email does not look right." }, 400);
    if (password.length < 8) return c.json({ error: "Use a password of at least 8 characters." }, 400);
    if (get(db, "SELECT id FROM users WHERE email = ?", email)) {
      return c.json({ error: "That email is already in use." }, 409);
    }
    const id = uid();
    run(
      db,
      `INSERT INTO users (id, crew_id, name, email, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, ?, 'helper', ?)`,
      id,
      user.crewId,
      name,
      email,
      hashPassword(password),
      nowIso(),
    );
    return c.json({ person: { id, name, email, role: "helper" } });
  });

  app.get("/api/settings", (c) => c.json({ business: businessOf(db, c.get("user").crewId) }));

  app.put("/api/settings/stripe", async (c) => {
    const user = c.get("user");
    if (user.role !== "owner") return c.json({ error: "Only the owner can connect payments." }, 403);
    const body = await c.req.json().catch(() => null);
    const secret = String(body?.secret || "").trim();
    const publishable = String(body?.publishable || "").trim();
    const liveSecret = "sk_" + "live_";
    const livePublishable = "pk_" + "live_";
    if (secret.includes(liveSecret) || publishable.includes(livePublishable)) {
      return c.json({ error: "Live keys are refused. Use a test key." }, 400);
    }
    if (!secret.startsWith("sk_test_")) return c.json({ error: "The secret key must be a Stripe test key." }, 400);
    if (publishable && !publishable.startsWith("pk_test_")) {
      return c.json({ error: "The publishable key must be a Stripe test key." }, 400);
    }
    run(
      db,
      "UPDATE crews SET stripe_secret = ?, stripe_publishable = ?, updated_at = ? WHERE id = ?",
      secret,
      publishable,
      nowIso(),
      user.crewId,
    );
    return c.json({ payments: "test" });
  });

  app.get("/api/export.csv", (c) => {
    const rows = all<{
      number: string;
      status: string;
      customer_name: string;
      total_cents: number;
      paid_cents: number;
      created_at: string;
    }>(
      db,
      `SELECT invoices.number, invoices.status, customers.name AS customer_name, invoices.total_cents,
        COALESCE((SELECT SUM(amount_cents) FROM payments WHERE payments.invoice_id = invoices.id), 0) AS paid_cents,
        invoices.created_at
       FROM invoices JOIN customers ON customers.id = invoices.customer_id
       WHERE invoices.crew_id = ?
       ORDER BY invoices.created_at`,
      c.get("user").crewId,
    );
    const header = ["number", "customer", "status", "total", "paid", "balance", "created"];
    const lines = rows.map((row) =>
      [
        row.number,
        row.customer_name,
        row.status,
        formatMoney(row.total_cents),
        formatMoney(Number(row.paid_cents)),
        formatMoney(balanceDue(row.total_cents, Number(row.paid_cents))),
        row.created_at,
      ]
        .map(csvEscape)
        .join(","),
    );
    return c.text([header.join(","), ...lines].join("\n"), 200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"invoices.csv\"",
    });
  });

  app.get("/api/quotes/:id/pdf", async (c) => {
    const user = c.get("user");
    const row = loadQuote(db, "quotes.id = ? AND quotes.crew_id = ?", c.req.param("id"), user.crewId);
    if (!row || row.crew_id !== user.crewId) return c.json({ error: "Quote not found." }, 404);
    const bytes = await pdfFor(db, row, "quote");
    return c.body(Buffer.from(bytes), 200, {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${row.number}.pdf"`,
    });
  });

  app.get("/api/invoices/:id/pdf", async (c) => {
    const row = loadInvoice(db, "invoices.id = ? AND invoices.crew_id = ?", c.req.param("id"), c.get("user").crewId);
    if (!row || row.crew_id !== c.get("user").crewId) return c.json({ error: "Invoice not found." }, 404);
    const bytes = await pdfFor(db, row, "invoice");
    return c.body(Buffer.from(bytes), 200, {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${row.number}.pdf"`,
    });
  });

  app.get("/api/public/quotes/:token", (c) => {
    const row = loadQuote(db, "quotes.public_token = ?", c.req.param("token"));
    if (!row) return c.json({ error: "Quote not found." }, 404);
    return c.json(publicQuote(db, row));
  });

  app.post("/api/public/quotes/:token/approve", (c) => {
    const row = loadQuote(db, "quotes.public_token = ?", c.req.param("token"));
    if (!row) return c.json({ error: "Quote not found." }, 404);
    if (row.status === "archived") return c.json({ error: "This quote is closed." }, 400);
    if (row.status !== "approved" && row.status !== "converted") {
      const at = nowIso();
      run(db, "UPDATE quotes SET status = 'approved', updated_at = ? WHERE id = ?", at, row.id);
      recordEvent(db, row.crew_id, "quote", row.id, row.status, "approved", at);
      row.status = "approved";
    }
    return c.json(publicQuote(db, row));
  });

  app.get("/api/public/quotes/:token/pdf", async (c) => {
    const row = loadQuote(db, "quotes.public_token = ?", c.req.param("token"));
    if (!row) return c.json({ error: "Quote not found." }, 404);
    const bytes = await pdfFor(db, row, "quote");
    return c.body(Buffer.from(bytes), 200, { "content-type": "application/pdf" });
  });

  app.get("/api/public/invoices/:token", (c) => {
    const row = loadInvoice(db, "invoices.public_token = ?", c.req.param("token"));
    if (!row) return c.json({ error: "Invoice not found." }, 404);
    return c.json(publicInvoice(db, row));
  });

  app.post("/api/public/invoices/:token/pay", async (c) => {
    const row = loadInvoice(db, "invoices.public_token = ?", c.req.param("token"));
    if (!row) return c.json({ error: "Invoice not found." }, 404);
    const body = await c.req.json().catch(() => ({}));
    const requestId = String(body?.requestId || "").trim() || uid();
    const paymentMethod = String(body?.paymentMethod || "pm_card_visa");
    if (!/^pm_card_[A-Za-z0-9_]+$/.test(paymentMethod)) {
      return c.json({ error: "Use a Stripe test card method." }, 400);
    }
    const existing = get<{ id: string }>(db, "SELECT id FROM payments WHERE id = ?", requestId);
    if (existing) return c.json(publicInvoice(db, { ...row, status: loadInvoice(db, "invoices.id = ?", row.id)?.status || row.status }));
    const secret = get<{ stripe_secret: string | null }>(db, "SELECT stripe_secret FROM crews WHERE id = ?", row.crew_id);
    if (!secret?.stripe_secret || !secret.stripe_secret.startsWith("sk_test_")) {
      return c.json({ error: "This shop has not connected a test card account." }, 400);
    }
    const paid = sumPayments(db, row.id);
    const due = balanceDue(row.total_cents, paid);
    if (due <= 0) return c.json(publicInvoice(db, row));
    let intent;
    try {
      intent = await chargeTestCard({
        secret: secret.stripe_secret,
        amountCents: due,
        invoiceId: row.id,
        idempotencyKey: requestId,
        paymentMethod,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "The card was declined.";
      return c.json({ error: message }, 402);
    }
    if (intent.status !== "succeeded") {
      return c.json({ error: "The card did not go through." }, 402);
    }
    if (intent.application_fee_amount) {
      return c.json({ error: "Refusing a charge that includes a platform fee." }, 500);
    }
    const at = nowIso();
    db.exec("BEGIN");
    try {
      run(
        db,
        `INSERT INTO payments (id, crew_id, invoice_id, amount_cents, fee_cents, method, stripe_payment_intent, created_at)
         VALUES (?, ?, ?, ?, 0, 'card', ?, ?)`,
        requestId,
        row.crew_id,
        row.id,
        due,
        intent.id,
        at,
      );
      refreshInvoiceStatus(db, row.crew_id, row.id, at);
      db.exec("COMMIT");
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* closed */
      }
      throw err;
    }
    const fresh = loadInvoice(db, "invoices.id = ?", row.id)!;
    return c.json({
      ...publicInvoice(db, fresh),
      paymentIntentId: intent.id,
      applicationFeeAmount: intent.application_fee_amount,
    });
  });

  app.get("/api/public/invoices/:token/pdf", async (c) => {
    const row = loadInvoice(db, "invoices.public_token = ?", c.req.param("token"));
    if (!row) return c.json({ error: "Invoice not found." }, 404);
    const bytes = await pdfFor(db, row, "invoice");
    return c.body(Buffer.from(bytes), 200, { "content-type": "application/pdf" });
  });

  if (existsSync("dist/index.html")) {
    const html = readFileSync("dist/index.html", "utf8");
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".webmanifest": "application/manifest+json",
      ".png": "image/png",
      ".json": "application/json",
    };
    app.use("/*", async (c, next) => {
      const path = pathOf(c);
      if (path.startsWith("/api/") || path.includes("..")) return next();
      const ext = path.includes(".") ? path.slice(path.lastIndexOf(".")) : "";
      const candidate = `dist${path}`;
      if (ext && existsSync(candidate) && !candidate.endsWith("/")) {
        return c.body(readFileSync(candidate), 200, { "content-type": types[ext] || "application/octet-stream" });
      }
      return c.html(html);
    });
  }

  return { app, db };
}
