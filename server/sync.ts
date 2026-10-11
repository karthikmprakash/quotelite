import { assertCanPay, computeTotals, lineCents, statusFor, PaymentError } from "../shared/money.ts";
import { all, get, nowIso, run, type DB } from "./db.ts";

export type SyncOp = {
  id: string;
  entity: "customer" | "saved_item" | "quote" | "invoice" | "payment" | "business";
  action: "upsert";
  recordId: string;
  at: string;
  payload: Record<string, unknown>;
};

const RANK: Record<string, number> = {
  business: 0,
  customer: 1,
  saved_item: 2,
  quote: 3,
  invoice: 4,
  payment: 5,
};

const QUOTE_STATUS = new Set(["draft", "sent", "approved", "converted", "archived"]);

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function int(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? value : Number.NaN;
}

function permanent(message: string): Error {
  return new Error(`permanent: ${message}`);
}

function friendly(err: unknown): { message: string; permanent: boolean } {
  const raw = err instanceof Error ? err.message : "Could not save that change.";
  if (raw.startsWith("permanent: ")) return { message: raw.slice("permanent: ".length), permanent: true };
  if (/UNIQUE/i.test(raw)) return { message: "That number is already used.", permanent: true };
  return { message: raw, permanent: false };
}

export function applyOps(db: DB, crewId: string, ops: SyncOp[]) {
  const acked: string[] = [];
  const rejected: { id: string; error: string; permanent: boolean }[] = [];
  const sorted = [...ops].sort(
    (a, b) => a.at.localeCompare(b.at) || (RANK[a.entity] ?? 9) - (RANK[b.entity] ?? 9),
  );
  for (const op of sorted) {
    if (!op?.id || !op.entity || !op.recordId) {
      rejected.push({ id: op?.id || "", error: "Incomplete change.", permanent: true });
      continue;
    }
    if (get(db, "SELECT id FROM sync_ops WHERE id = ?", op.id)) {
      acked.push(op.id);
      continue;
    }
    try {
      db.exec("BEGIN");
      applyOne(db, crewId, op);
      run(db, "INSERT INTO sync_ops (id, crew_id, applied_at) VALUES (?, ?, ?)", op.id, crewId, nowIso());
      db.exec("COMMIT");
      acked.push(op.id);
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* transaction already closed */
      }
      if (get(db, "SELECT id FROM sync_ops WHERE id = ?", op.id)) {
        acked.push(op.id);
        continue;
      }
      const parsed = friendly(err);
      rejected.push({ id: op.id, error: parsed.message, permanent: parsed.permanent });
    }
  }
  return { acked, rejected };
}

function applyOne(db: DB, crewId: string, op: SyncOp): void {
  if (op.entity === "business") return applyBusiness(db, crewId, op);
  if (op.entity === "customer") return applyCustomer(db, crewId, op);
  if (op.entity === "saved_item") return applySavedItem(db, crewId, op);
  if (op.entity === "quote") return applyQuote(db, crewId, op);
  if (op.entity === "invoice") return applyInvoice(db, crewId, op);
  if (op.entity === "payment") return applyPayment(db, crewId, op);
  throw permanent("Unknown change.");
}

function applyBusiness(db: DB, crewId: string, op: SyncOp): void {
  const name = str(op.payload.name).trim();
  if (!name) throw permanent("The business needs a name.");
  const tax = int(op.payload.taxBps);
  if (!Number.isInteger(tax) || tax < 0 || tax > 3000) throw permanent("Tax rate is not valid.");
  const logo = str(op.payload.logoBase64);
  if (logo.length > 1_800_000) throw permanent("That logo is too large.");
  run(
    db,
    `UPDATE crews SET name = ?, phone = ?, email = ?, tax_bps = ?, terms = ?,
      logo_mime = ?, logo_base64 = ?, updated_at = ? WHERE id = ?`,
    name,
    str(op.payload.phone).trim(),
    str(op.payload.email).trim(),
    tax,
    str(op.payload.terms),
    logo ? str(op.payload.logoMime, "image/png") : null,
    logo || null,
    str(op.payload.updatedAt, op.at),
    crewId,
  );
}

function applyCustomer(db: DB, crewId: string, op: SyncOp): void {
  const name = str(op.payload.name).trim();
  if (!name) throw permanent("Customer needs a name.");
  const existing = get<{ crew_id: string }>(db, "SELECT crew_id FROM customers WHERE id = ?", op.recordId);
  if (existing && existing.crew_id !== crewId) throw permanent("That customer belongs to another crew.");
  const updated = str(op.payload.updatedAt, op.at);
  const created = str(op.payload.createdAt, updated);
  run(
    db,
    `INSERT INTO customers (id, crew_id, name, phone, email, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, phone = excluded.phone, email = excluded.email,
       notes = excluded.notes, updated_at = excluded.updated_at`,
    op.recordId,
    crewId,
    name,
    str(op.payload.phone).trim(),
    str(op.payload.email).trim(),
    str(op.payload.notes),
    created,
    updated,
  );
}

function applySavedItem(db: DB, crewId: string, op: SyncOp): void {
  const description = str(op.payload.description).trim();
  const price = int(op.payload.unitPriceCents);
  if (!description) throw permanent("A saved item needs a description.");
  if (!Number.isInteger(price) || price < 0) throw permanent("A saved item needs a price.");
  const updated = str(op.payload.updatedAt, op.at);
  run(
    db,
    `INSERT INTO saved_items (id, crew_id, description, unit_price_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET description = excluded.description,
       unit_price_cents = excluded.unit_price_cents, updated_at = excluded.updated_at`,
    op.recordId,
    crewId,
    description,
    price,
    str(op.payload.createdAt, updated),
    updated,
  );
}

type IncomingLine = {
  id?: string;
  description?: string;
  qtyMilli?: number;
  unitPriceCents?: number;
  position?: number;
};

function readLines(value: unknown): { id: string; description: string; qtyMilli: number; unitPriceCents: number; lineCents: number; position: number }[] {
  if (!Array.isArray(value) || value.length === 0) throw permanent("Add at least one line.");
  return value.map((raw, index) => {
    const line = raw as IncomingLine;
    const description = str(line.description).trim();
    const qtyMilli = int(line.qtyMilli);
    const unitPriceCents = int(line.unitPriceCents);
    if (!description) throw permanent("Each line needs a description.");
    if (!Number.isInteger(qtyMilli) || qtyMilli <= 0) throw permanent("Each line needs a quantity.");
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) throw permanent("Each line needs a price.");
    return {
      id: str(line.id) || crypto.randomUUID(),
      description,
      qtyMilli,
      unitPriceCents,
      lineCents: lineCents(qtyMilli, unitPriceCents),
      position: index,
    };
  });
}

function numberFor(
  db: DB,
  table: "quotes" | "invoices",
  crewId: string,
  recordId: string,
  wanted: string,
  current: string | undefined,
): string {
  if (current) return current;
  const taken = get(db, `SELECT id FROM ${table} WHERE crew_id = ? AND number = ? AND id <> ?`, crewId, wanted, recordId);
  if (!taken) return wanted;
  const prefix = wanted.replace(/\d+$/, "") || (table === "quotes" ? "Q-" : "INV-");
  const highest = all<{ number: string }>(db, `SELECT number FROM ${table} WHERE crew_id = ?`, crewId).reduce(
    (max, row) => Math.max(max, Number(/(\d+)$/.exec(row.number)?.[1] ?? 0)),
    1000,
  );
  return `${prefix}${highest + 1}`;
}

function applyQuote(db: DB, crewId: string, op: SyncOp): void {
  const customerId = str(op.payload.customerId);
  const customer = get<{ id: string }>(
    db,
    "SELECT id FROM customers WHERE id = ? AND crew_id = ?",
    customerId,
    crewId,
  );
  if (!customer) throw permanent("Pick a customer on this crew.");
  const status = str(op.payload.status, "draft");
  if (!QUOTE_STATUS.has(status)) throw permanent("That quote status is not valid.");
  const lines = readLines(op.payload.lines);
  const taxBps = int(op.payload.taxBps);
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 3000) throw permanent("Tax rate is not valid.");
  const totals = computeTotals(lines, taxBps);
  const updated = str(op.payload.updatedAt, op.at);
  const created = str(op.payload.createdAt, updated);
  const previous = get<{ status: string; created_at: string; number: string }>(
    db,
    "SELECT status, created_at, number FROM quotes WHERE id = ? AND crew_id = ?",
    op.recordId,
    crewId,
  );
  const number = numberFor(db, "quotes", crewId, op.recordId, str(op.payload.number).trim(), previous?.number);
  run(
    db,
    `INSERT INTO quotes (
      id, crew_id, customer_id, number, status, tax_bps, notes, terms, public_token,
      subtotal_cents, tax_cents, total_cents, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      customer_id = excluded.customer_id, number = excluded.number, status = excluded.status,
      tax_bps = excluded.tax_bps, notes = excluded.notes, terms = excluded.terms,
      subtotal_cents = excluded.subtotal_cents, tax_cents = excluded.tax_cents,
      total_cents = excluded.total_cents, updated_at = excluded.updated_at`,
    op.recordId,
    crewId,
    customerId,
    number,
    status,
    taxBps,
    str(op.payload.notes),
    str(op.payload.terms),
    str(op.payload.publicToken),
    totals.subtotalCents,
    totals.taxCents,
    totals.totalCents,
    previous?.created_at || created,
    updated,
  );
  run(db, "DELETE FROM quote_lines WHERE quote_id = ?", op.recordId);
  for (const line of lines) {
    run(
      db,
      `INSERT INTO quote_lines (id, quote_id, position, description, qty_milli, unit_price_cents, line_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      line.id,
      op.recordId,
      line.position,
      line.description,
      line.qtyMilli,
      line.unitPriceCents,
      line.lineCents,
    );
  }
  run(db, "DELETE FROM quote_photos WHERE quote_id = ?", op.recordId);
  const photos = Array.isArray(op.payload.photos) ? op.payload.photos.slice(0, 3) : [];
  photos.forEach((raw, index) => {
    const photo = raw as { id?: string; mime?: string; dataBase64?: string };
    const data = str(photo.dataBase64);
    if (!data || data.length > 1_800_000) return;
    run(
      db,
      `INSERT INTO quote_photos (id, quote_id, position, mime, data_base64) VALUES (?, ?, ?, ?, ?)`,
      str(photo.id) || crypto.randomUUID(),
      op.recordId,
      index,
      str(photo.mime, "image/jpeg"),
      data,
    );
  });
  if (previous && previous.status !== status) {
    recordEvent(db, crewId, "quote", op.recordId, previous.status, status, updated);
  } else if (!previous) {
    recordEvent(db, crewId, "quote", op.recordId, null, status, created);
  }
}

function applyInvoice(db: DB, crewId: string, op: SyncOp): void {
  const customerId = str(op.payload.customerId);
  const customer = get<{ id: string }>(
    db,
    "SELECT id FROM customers WHERE id = ? AND crew_id = ?",
    customerId,
    crewId,
  );
  if (!customer) throw permanent("Pick a customer on this crew.");
  const quoteId = str(op.payload.quoteId);
  if (quoteId) {
    const quote = get<{ id: string }>(db, "SELECT id FROM quotes WHERE id = ? AND crew_id = ?", quoteId, crewId);
    if (!quote) throw permanent("That quote is not on this crew.");
  }
  const lines = readLines(op.payload.lines);
  const taxBps = int(op.payload.taxBps);
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 3000) throw permanent("Tax rate is not valid.");
  const totals = computeTotals(lines, taxBps);
  const updated = str(op.payload.updatedAt, op.at);
  const created = str(op.payload.createdAt, updated);
  const previous = get<{ created_at: string; number: string }>(
    db,
    "SELECT created_at, number FROM invoices WHERE id = ? AND crew_id = ?",
    op.recordId,
    crewId,
  );
  const number = numberFor(db, "invoices", crewId, op.recordId, str(op.payload.number).trim(), previous?.number);
  const scheduled = str(op.payload.scheduledDate).trim();
  run(
    db,
    `INSERT INTO invoices (
      id, crew_id, customer_id, quote_id, number, status, tax_bps, notes, terms, public_token,
      subtotal_cents, tax_cents, total_cents, scheduled_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      customer_id = excluded.customer_id, quote_id = excluded.quote_id, number = excluded.number,
      tax_bps = excluded.tax_bps, notes = excluded.notes, terms = excluded.terms,
      subtotal_cents = excluded.subtotal_cents, tax_cents = excluded.tax_cents,
      total_cents = excluded.total_cents, scheduled_date = excluded.scheduled_date,
      updated_at = excluded.updated_at`,
    op.recordId,
    crewId,
    customerId,
    quoteId || null,
    number,
    taxBps,
    str(op.payload.notes),
    str(op.payload.terms),
    str(op.payload.publicToken),
    totals.subtotalCents,
    totals.taxCents,
    totals.totalCents,
    scheduled || null,
    previous?.created_at || created,
    updated,
  );
  if (!previous) recordEvent(db, crewId, "invoice", op.recordId, null, "open", created);
  run(db, "DELETE FROM invoice_lines WHERE invoice_id = ?", op.recordId);
  for (const line of lines) {
    run(
      db,
      `INSERT INTO invoice_lines (id, invoice_id, position, description, qty_milli, unit_price_cents, line_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      line.id,
      op.recordId,
      line.position,
      line.description,
      line.qtyMilli,
      line.unitPriceCents,
      line.lineCents,
    );
  }
  refreshInvoiceStatus(db, crewId, op.recordId, updated);
}

function applyPayment(db: DB, crewId: string, op: SyncOp): void {
  if (get(db, "SELECT id FROM payments WHERE id = ?", op.recordId)) return;
  const invoiceId = str(op.payload.invoiceId);
  const invoice = get<{ total_cents: number }>(
    db,
    "SELECT total_cents FROM invoices WHERE id = ? AND crew_id = ?",
    invoiceId,
    crewId,
  );
  if (!invoice) throw permanent("Invoice not found.");
  const amount = int(op.payload.amountCents);
  const paid = sumPayments(db, invoiceId);
  try {
    assertCanPay(invoice.total_cents, paid, amount);
  } catch (err) {
    if (err instanceof PaymentError) throw permanent(err.message);
    throw err;
  }
  const method = str(op.payload.method, "cash");
  if (!["cash", "card", "transfer", "other"].includes(method)) throw permanent("Unknown payment method.");
  run(
    db,
    `INSERT INTO payments (id, crew_id, invoice_id, amount_cents, fee_cents, method, stripe_payment_intent, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    op.recordId,
    crewId,
    invoiceId,
    amount,
    method,
    str(op.payload.stripePaymentIntent) || null,
    str(op.payload.createdAt, op.at),
  );
  refreshInvoiceStatus(db, crewId, invoiceId, str(op.payload.createdAt, op.at));
}

export function sumPayments(db: DB, invoiceId: string): number {
  const row = get<{ s: number }>(
    db,
    "SELECT COALESCE(SUM(amount_cents), 0) AS s FROM payments WHERE invoice_id = ?",
    invoiceId,
  );
  return Number(row?.s ?? 0);
}

export function refreshInvoiceStatus(db: DB, crewId: string, invoiceId: string, at: string): void {
  const invoice = get<{ status: string; total_cents: number }>(
    db,
    "SELECT status, total_cents FROM invoices WHERE id = ? AND crew_id = ?",
    invoiceId,
    crewId,
  );
  if (!invoice) return;
  const next = statusFor(invoice.total_cents, sumPayments(db, invoiceId));
  if (next === invoice.status) return;
  run(db, "UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?", next, at, invoiceId);
  recordEvent(db, crewId, "invoice", invoiceId, invoice.status, next, at);
}

export function recordEvent(
  db: DB,
  crewId: string,
  entity: string,
  entityId: string,
  fromStatus: string | null,
  toStatus: string,
  at: string,
): void {
  run(
    db,
    `INSERT INTO status_events (id, crew_id, entity, entity_id, from_status, to_status, at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    crewId,
    entity,
    entityId,
    fromStatus,
    toStatus,
    at,
  );
}

type QuoteRow = {
  id: string;
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
  updated_at: string;
};

type InvoiceRow = QuoteRow & { quote_id: string | null; scheduled_date: string | null };

export function snapshot(db: DB, crewId: string) {
  const customers = all<{
    id: string;
    name: string;
    phone: string;
    email: string;
    notes: string;
    created_at: string;
    updated_at: string;
  }>(db, "SELECT id, name, phone, email, notes, created_at, updated_at FROM customers WHERE crew_id = ?", crewId).map(
    (row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
  const quotes = all<QuoteRow>(
    db,
    `SELECT id, customer_id, number, status, tax_bps, notes, terms, public_token,
      subtotal_cents, tax_cents, total_cents, created_at, updated_at
     FROM quotes WHERE crew_id = ?`,
    crewId,
  ).map((row) => ({
    ...mapMoneyDoc(row),
    customerId: row.customer_id,
    lines: linesFor(db, "quote_lines", "quote_id", row.id),
    photos: photosFor(db, row.id),
  }));
  const invoices = all<InvoiceRow>(
    db,
    `SELECT id, customer_id, quote_id, number, status, tax_bps, notes, terms, public_token,
      subtotal_cents, tax_cents, total_cents, scheduled_date, created_at, updated_at
     FROM invoices WHERE crew_id = ?`,
    crewId,
  ).map((row) => ({
    ...mapMoneyDoc(row),
    customerId: row.customer_id,
    quoteId: row.quote_id,
    scheduledDate: row.scheduled_date,
    lines: linesFor(db, "invoice_lines", "invoice_id", row.id),
    payments: paymentsFor(db, row.id),
  }));
  const savedItems = all<{
    id: string;
    description: string;
    unit_price_cents: number;
    created_at: string;
    updated_at: string;
  }>(
    db,
    "SELECT id, description, unit_price_cents, created_at, updated_at FROM saved_items WHERE crew_id = ?",
    crewId,
  ).map((row) => ({
    id: row.id,
    description: row.description,
    unitPriceCents: row.unit_price_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
  const events = all<{
    id: string;
    entity: string;
    entity_id: string;
    from_status: string | null;
    to_status: string;
    at: string;
  }>(
    db,
    "SELECT id, entity, entity_id, from_status, to_status, at FROM status_events WHERE crew_id = ? ORDER BY at DESC",
    crewId,
  ).map((row) => ({
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    at: row.at,
  }));
  return { business: businessOf(db, crewId), customers, quotes, invoices, savedItems, events };
}

function mapMoneyDoc(row: QuoteRow) {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    taxBps: row.tax_bps,
    notes: row.notes,
    terms: row.terms,
    publicToken: row.public_token,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function linesFor(db: DB, table: "quote_lines" | "invoice_lines", column: "quote_id" | "invoice_id", id: string) {
  return all<{
    id: string;
    position: number;
    description: string;
    qty_milli: number;
    unit_price_cents: number;
    line_cents: number;
  }>(
    db,
    `SELECT id, position, description, qty_milli, unit_price_cents, line_cents FROM ${table} WHERE ${column} = ? ORDER BY position`,
    id,
  ).map((row) => ({
    id: row.id,
    position: row.position,
    description: row.description,
    qtyMilli: row.qty_milli,
    unitPriceCents: row.unit_price_cents,
    lineCents: row.line_cents,
  }));
}

function photosFor(db: DB, quoteId: string) {
  return all<{ id: string; position: number; mime: string; data_base64: string }>(
    db,
    "SELECT id, position, mime, data_base64 FROM quote_photos WHERE quote_id = ? ORDER BY position",
    quoteId,
  ).map((row) => ({ id: row.id, position: row.position, mime: row.mime, dataBase64: row.data_base64 }));
}

function paymentsFor(db: DB, invoiceId: string) {
  return all<{
    id: string;
    amount_cents: number;
    fee_cents: number;
    method: string;
    stripe_payment_intent: string | null;
    created_at: string;
  }>(
    db,
    `SELECT id, amount_cents, fee_cents, method, stripe_payment_intent, created_at
     FROM payments WHERE invoice_id = ? ORDER BY created_at`,
    invoiceId,
  ).map((row) => ({
    id: row.id,
    invoiceId,
    amountCents: row.amount_cents,
    feeCents: row.fee_cents,
    method: row.method,
    stripePaymentIntent: row.stripe_payment_intent,
    createdAt: row.created_at,
  }));
}

export function businessOf(db: DB, crewId: string) {
  const row = get<{
    name: string;
    phone: string;
    email: string;
    plan: string;
    tax_bps: number;
    terms: string;
    logo_mime: string | null;
    logo_base64: string | null;
    stripe_secret: string | null;
    stripe_publishable: string | null;
  }>(
    db,
    `SELECT name, phone, email, plan, tax_bps, terms, logo_mime, logo_base64, stripe_secret, stripe_publishable
     FROM crews WHERE id = ?`,
    crewId,
  );
  if (!row) return null;
  const test = !!row.stripe_secret && row.stripe_secret.startsWith("sk_test_");
  return {
    name: row.name,
    phone: row.phone,
    email: row.email,
    plan: row.plan,
    taxBps: row.tax_bps,
    terms: row.terms,
    logoMime: row.logo_mime,
    logoBase64: row.logo_base64,
    payments: test ? "test" : "off",
  };
}
