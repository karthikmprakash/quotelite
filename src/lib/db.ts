import Dexie, { type EntityTable } from "dexie";

export type Customer = {
  id: string;
  name: string;
  nameKey: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedItem = {
  id: string;
  description: string;
  unitPriceCents: number;
  createdAt: string;
  updatedAt: string;
};

export type Quote = {
  id: string;
  customerId: string;
  number: string;
  status: "draft" | "sent" | "approved" | "converted" | "archived";
  taxBps: number;
  notes: string;
  terms: string;
  publicToken: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
};

export type Invoice = {
  id: string;
  customerId: string;
  quoteId: string | null;
  number: string;
  status: "open" | "partial" | "paid" | "void";
  taxBps: number;
  notes: string;
  terms: string;
  publicToken: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  scheduledDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Line = {
  id: string;
  parentId: string;
  position: number;
  description: string;
  qtyMilli: number;
  unitPriceCents: number;
  lineCents: number;
};

export type Photo = {
  id: string;
  quoteId: string;
  position: number;
  mime: string;
  dataBase64: string;
};

export type Payment = {
  id: string;
  invoiceId: string;
  amountCents: number;
  feeCents: number;
  method: "cash" | "card" | "transfer" | "other";
  stripePaymentIntent: string | null;
  createdAt: string;
};

export type StatusEvent = {
  id: string;
  entity: string;
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  at: string;
};

export type OutboxOp = {
  id: string;
  recordId: string;
  entity: "customer" | "saved_item" | "quote" | "invoice" | "payment" | "business";
  at: string;
  payload: Record<string, unknown>;
};

export type MetaRow = { id: string; value: unknown };

const db = new Dexie("quotelite") as Dexie & {
  meta: EntityTable<MetaRow, "id">;
  customers: EntityTable<Customer, "id">;
  savedItems: EntityTable<SavedItem, "id">;
  quotes: EntityTable<Quote, "id">;
  quoteLines: EntityTable<Line, "id">;
  quotePhotos: EntityTable<Photo, "id">;
  invoices: EntityTable<Invoice, "id">;
  invoiceLines: EntityTable<Line, "id">;
  payments: EntityTable<Payment, "id">;
  events: EntityTable<StatusEvent, "id">;
  outbox: EntityTable<OutboxOp, "id">;
};

db.version(1).stores({
  meta: "id",
  customers: "id, nameKey",
  savedItems: "id",
  quotes: "id, customerId, status, updatedAt",
  quoteLines: "id, parentId",
  quotePhotos: "id, quoteId",
  invoices: "id, customerId, quoteId, status",
  invoiceLines: "id, parentId",
  payments: "id, invoiceId",
  events: "id, entityId",
  outbox: "id, recordId, at",
});

export { db };
