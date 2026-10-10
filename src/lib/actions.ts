import { normalizeName } from "../../shared/share.ts";
import {
  assertCanPay,
  balanceDue,
  computeTotals,
  lineCents,
  paidTotal,
  parseDollars,
  parseQty,
  parseTaxPercent,
  statusFor,
} from "../../shared/money.ts";
import { db, type Customer, type Invoice, type Line, type Payment, type Quote } from "./db.ts";
import { syncNow } from "./sync.ts";

const DEFAULT_TERMS = "Payment is due when the work is done. This quote is good for 30 days.";

export type SessionUser = {
  id: string;
  crewId: string;
  name: string;
  email: string;
  role: "owner" | "helper";
  businessName: string;
};

export type Business = {
  name: string;
  phone: string;
  email: string;
  plan: string;
  taxBps: number;
  terms: string;
  logoMime: string | null;
  logoBase64: string | null;
  payments: "test" | "off";
};

async function clearAll(): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}

export async function rememberSession(user: SessionUser, business?: Business): Promise<void> {
  await clearAll();
  await db.meta.put({ id: "session", value: user });
  await db.meta.put({
    id: "business",
    value: business ?? {
      name: user.businessName,
      phone: "",
      email: user.email,
      plan: "solo",
      taxBps: 0,
      terms: DEFAULT_TERMS,
      logoMime: null,
      logoBase64: null,
      payments: "off",
    },
  });
  await syncNow();
}

export async function logoutLocal(): Promise<void> {
  await clearAll();
}

async function nextNumber(kind: "quote" | "invoice"): Promise<number> {
  const key = `counter-${kind}`;
  return db.transaction("rw", db.meta, async () => {
    const row = await db.meta.get(key);
    const current = typeof row?.value === "number" ? row.value : 1000;
    const next = current + 1;
    await db.meta.put({ id: key, value: next });
    return next;
  });
}

async function enqueue(
  entity: "customer" | "saved_item" | "quote" | "invoice" | "payment" | "business",
  recordId: string,
  payload: Record<string, unknown>,
  at: string,
): Promise<void> {
  await db.outbox.put({ id: crypto.randomUUID(), recordId, entity, at, payload });
}

async function businessOf(): Promise<Business> {
  const row = await db.meta.get("business");
  return (
    (row?.value as Business) || {
      name: "QuoteLite",
      phone: "",
      email: "",
      plan: "solo",
      taxBps: 0,
      terms: DEFAULT_TERMS,
      logoMime: null,
      logoBase64: null,
      payments: "off",
    }
  );
}

export type DraftLine = { description: string; qty: string; price: string; save?: boolean };

export async function createQuote(input: {
  customerName: string;
  phone: string;
  email: string;
  lines: DraftLine[];
  taxPercent: string;
  notes: string;
  photos: { mime: string; dataBase64: string }[];
}): Promise<Quote> {
  const name = input.customerName.trim();
  const nameKey = normalizeName(name);
  if (!nameKey) throw new Error("Add a customer name.");
  const taxBps = parseTaxPercent(input.taxPercent);
  if (taxBps === null) throw new Error("Tax should be a percent, like 8.25.");
  const priced = priceDraft(input.lines);
  const totals = computeTotals(priced, taxBps);
  const now = new Date().toISOString();
  const existing = await db.customers.where("nameKey").equals(nameKey).first();
  const customer: Customer = existing
    ? {
        ...existing,
        phone: input.phone.trim() || existing.phone,
        email: input.email.trim() || existing.email,
        updatedAt: now,
      }
    : {
        id: crypto.randomUUID(),
        name,
        nameKey,
        phone: input.phone.trim(),
        email: input.email.trim(),
        notes: "",
        createdAt: now,
        updatedAt: now,
      };
  const business = await businessOf();
  const number = await nextNumber("quote");
  const quote: Quote = {
    id: crypto.randomUUID(),
    customerId: customer.id,
    number: `Q-${number}`,
    status: "draft",
    taxBps,
    notes: input.notes.trim(),
    terms: business.terms,
    publicToken: crypto.randomUUID().replace(/-/g, ""),
    ...totals,
    createdAt: now,
    updatedAt: now,
  };
  const lines = priced.map((line, position) => ({ ...line, id: crypto.randomUUID(), parentId: quote.id, position }));
  const photos = input.photos.slice(0, 3).map((photo, position) => ({
    id: crypto.randomUUID(),
    quoteId: quote.id,
    position,
    mime: photo.mime,
    dataBase64: photo.dataBase64,
  }));
  const saves = input.lines
    .map((line, index) => ({ line, priced: priced[index] }))
    .filter((item) => item.line.save);
  await db.transaction("rw", [db.customers, db.quotes, db.quoteLines, db.quotePhotos, db.savedItems, db.outbox], async () => {
    await db.customers.put(customer);
    await db.quotes.put(quote);
    await db.quoteLines.bulkPut(lines);
    await db.quotePhotos.bulkPut(photos);
    await enqueue("customer", customer.id, { ...customer }, now);
    await enqueue("quote", quote.id, { ...quote, lines, photos }, now);
    for (const item of saves) {
      if (!item.priced) continue;
      const saved = {
        id: crypto.randomUUID(),
        description: item.priced.description,
        unitPriceCents: item.priced.unitPriceCents,
        createdAt: now,
        updatedAt: now,
      };
      await db.savedItems.put(saved);
      await enqueue("saved_item", saved.id, saved, now);
    }
  });
  void syncNow();
  return quote;
}

export async function saveLineItem(description: string, price: string): Promise<void> {
  const unitPriceCents = parseDollars(price);
  const text = description.trim();
  if (!text || unitPriceCents === null) throw new Error("Add a description and a price before saving the item.");
  const now = new Date().toISOString();
  const saved = { id: crypto.randomUUID(), description: text, unitPriceCents, createdAt: now, updatedAt: now };
  await db.transaction("rw", [db.savedItems, db.outbox], async () => {
    await db.savedItems.put(saved);
    await enqueue("saved_item", saved.id, saved, now);
  });
  void syncNow();
}

function priceDraft(lines: DraftLine[]): { description: string; qtyMilli: number; unitPriceCents: number; lineCents: number }[] {
  const priced = lines.map((line) => {
    const description = line.description.trim();
    const qtyMilli = parseQty(line.qty);
    const unitPriceCents = parseDollars(line.price);
    if (!description) throw new Error("Each line needs a description.");
    if (qtyMilli === null) throw new Error("Each line needs a quantity.");
    if (unitPriceCents === null) throw new Error("Each line needs a price like 12.50.");
    return { description, qtyMilli, unitPriceCents, lineCents: lineCents(qtyMilli, unitPriceCents) };
  });
  if (priced.length === 0) throw new Error("Add at least one line.");
  return priced;
}

async function putQuote(quote: Quote): Promise<void> {
  const lines = await db.quoteLines.where("parentId").equals(quote.id).toArray();
  const photos = await db.quotePhotos.where("quoteId").equals(quote.id).toArray();
  const at = quote.updatedAt;
  await db.transaction("rw", [db.quotes, db.outbox], async () => {
    await db.quotes.put(quote);
    await enqueue("quote", quote.id, { ...quote, lines, photos }, at);
  });
  void syncNow();
}

export async function setQuoteStatus(id: string, status: Quote["status"]): Promise<void> {
  const quote = await db.quotes.get(id);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status === status) return;
  await putQuote({ ...quote, status, updatedAt: new Date().toISOString() });
}

export async function invoiceQuote(quoteId: string, scheduledDate: string): Promise<Invoice> {
  const quote = await db.quotes.get(quoteId);
  if (!quote) throw new Error("Quote not found.");
  if (quote.status !== "approved") throw new Error("Approve the quote first.");
  const existing = await db.invoices.where("quoteId").equals(quoteId).first();
  if (existing) return existing;
  const source = await db.quoteLines.where("parentId").equals(quoteId).sortBy("position");
  const now = new Date().toISOString();
  const number = await nextNumber("invoice");
  const invoice: Invoice = {
    id: crypto.randomUUID(),
    customerId: quote.customerId,
    quoteId: quote.id,
    number: `INV-${number}`,
    status: "open",
    taxBps: quote.taxBps,
    notes: quote.notes,
    terms: quote.terms,
    publicToken: crypto.randomUUID().replace(/-/g, ""),
    subtotalCents: quote.subtotalCents,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    scheduledDate: scheduledDate || null,
    createdAt: now,
    updatedAt: now,
  };
  const lines: Line[] = source.map((line, position) => ({
    id: crypto.randomUUID(),
    parentId: invoice.id,
    position,
    description: line.description,
    qtyMilli: line.qtyMilli,
    unitPriceCents: line.unitPriceCents,
    lineCents: line.lineCents,
  }));
  const updatedQuote: Quote = { ...quote, status: "converted", updatedAt: now };
  await db.transaction("rw", [db.quotes, db.invoices, db.invoiceLines, db.quoteLines, db.quotePhotos, db.outbox], async () => {
    await db.quotes.put(updatedQuote);
    await db.invoices.put(invoice);
    await db.invoiceLines.bulkPut(lines);
    const photos = await db.quotePhotos.where("quoteId").equals(quoteId).toArray();
    const quoteLines = await db.quoteLines.where("parentId").equals(quoteId).toArray();
    await enqueue("quote", quote.id, { ...updatedQuote, lines: quoteLines, photos }, now);
    await enqueue("invoice", invoice.id, { ...invoice, lines }, now);
  });
  void syncNow();
  return invoice;
}

export async function recordPayment(invoiceId: string, amountCents: number, method: Payment["method"]): Promise<void> {
  const invoice = await db.invoices.get(invoiceId);
  if (!invoice) throw new Error("Invoice not found.");
  const payments = await db.payments.where("invoiceId").equals(invoiceId).toArray();
  const paid = paidTotal(payments.map((payment) => payment.amountCents));
  assertCanPay(invoice.totalCents, paid, amountCents);
  const now = new Date().toISOString();
  const payment: Payment = {
    id: crypto.randomUUID(),
    invoiceId,
    amountCents,
    feeCents: 0,
    method,
    stripePaymentIntent: null,
    createdAt: now,
  };
  const next = statusFor(invoice.totalCents, paid + amountCents);
  await db.transaction("rw", [db.payments, db.invoices, db.outbox], async () => {
    await db.payments.put(payment);
    await db.invoices.put({ ...invoice, status: next, updatedAt: now });
    await enqueue("payment", payment.id, { ...payment }, now);
  });
  void syncNow();
}

export async function markPaid(invoiceId: string): Promise<void> {
  const invoice = await db.invoices.get(invoiceId);
  if (!invoice) throw new Error("Invoice not found.");
  const payments = await db.payments.where("invoiceId").equals(invoiceId).toArray();
  const due = balanceDue(invoice.totalCents, paidTotal(payments.map((payment) => payment.amountCents)));
  await recordPayment(invoiceId, due, "cash");
}

export async function saveBusiness(next: Business): Promise<void> {
  const session = await db.meta.get("session");
  const crewId = (session?.value as SessionUser | undefined)?.crewId;
  if (!crewId) throw new Error("Sign in required.");
  const now = new Date().toISOString();
  await db.transaction("rw", [db.meta, db.outbox], async () => {
    await db.meta.put({ id: "business", value: next });
    await enqueue("business", crewId, { ...next, updatedAt: now }, now);
  });
  void syncNow();
}
