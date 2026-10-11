import {
  db,
  type Customer,
  type Invoice,
  type Line,
  type OutboxOp,
  type Payment,
  type Photo,
  type Quote,
  type SavedItem,
  type StatusEvent,
} from "./db.ts";

type Business = {
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

export type SyncIssue = { kind: "auth" | "rejected"; message: string };

class AuthExpired extends Error {}

let running = false;
let again = false;

export async function syncNow(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    let rounds = 0;
    do {
      again = false;
      await flush();
      await pull();
      rounds += 1;
    } while (again && rounds < 5);
    const current = (await db.meta.get("syncIssue"))?.value as SyncIssue | undefined;
    if (current?.kind === "auth") await db.meta.delete("syncIssue");
  } catch (err) {
    if (err instanceof AuthExpired) {
      const issue: SyncIssue = { kind: "auth", message: "Your login has expired. Log in again so your changes can sync." };
      await db.meta.put({ id: "syncIssue", value: issue });
    }
  } finally {
    running = false;
  }
}

export async function dismissSyncIssue(): Promise<void> {
  await db.meta.delete("syncIssue");
}

function labelOf(op: OutboxOp | undefined): string {
  if (!op) return "A change";
  const number = String(op.payload.number || "");
  if (op.entity === "quote") return number ? `Quote ${number}` : "A quote";
  if (op.entity === "invoice") return number ? `Invoice ${number}` : "An invoice";
  if (op.entity === "payment") return "A payment";
  if (op.entity === "customer") return op.payload.name ? `Customer ${String(op.payload.name)}` : "A customer";
  if (op.entity === "saved_item") return "A saved item";
  return "Business settings";
}

async function flush(): Promise<void> {
  const pending = await db.outbox.orderBy("at").toArray();
  if (pending.length === 0) return;
  const res = await fetch("/api/sync", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ops: pending.map((op) => ({
        id: op.id,
        entity: op.entity,
        action: "upsert",
        recordId: op.recordId,
        at: op.at,
        payload: op.payload,
      })),
    }),
  });
  if (res.status === 401) throw new AuthExpired();
  if (!res.ok) throw new Error("sync failed");
  const body = (await res.json()) as {
    acked: string[];
    rejected: { id: string; error: string; permanent: boolean }[];
  };
  const byId = new Map(pending.map((op) => [op.id, op]));
  await db.transaction("rw", db.outbox, db.meta, async () => {
    for (const id of body.acked) await db.outbox.delete(id);
    const dropped = body.rejected.filter((item) => item.permanent);
    for (const item of dropped) await db.outbox.delete(item.id);
    if (dropped.length > 0) {
      const first = dropped[0];
      const more = dropped.length > 1 ? ` (and ${dropped.length - 1} more)` : "";
      const issue: SyncIssue = {
        kind: "rejected",
        message: `${labelOf(byId.get(first.id))} did not sync: ${first.error}${more}`,
      };
      await db.meta.put({ id: "syncIssue", value: issue });
    }
  });
}

async function pull(): Promise<void> {
  const res = await fetch("/api/sync", { credentials: "include" });
  if (res.status === 401) throw new AuthExpired();
  if (!res.ok) throw new Error("pull failed");
  const snap = (await res.json()) as {
    business: Business | null;
    customers: Array<Omit<Customer, "nameKey">>;
    quotes: Array<Quote & { lines: Line[]; photos: Photo[] }>;
    invoices: Array<Invoice & { lines: Line[]; payments: Payment[] }>;
    savedItems: SavedItem[];
    events: StatusEvent[];
  };
  const pending = await db.outbox.toArray();
  const pendingIds = new Set(pending.map((op) => op.recordId));
  const pendingInvoicePayments = new Set(
    pending.filter((op) => op.entity === "payment").map((op) => String(op.payload.invoiceId || "")),
  );
  await db.transaction(
    "rw",
    [db.meta, db.customers, db.quotes, db.quoteLines, db.quotePhotos, db.invoices, db.invoiceLines, db.payments, db.savedItems, db.events],
    async () => {
      if (snap.business && !pendingIds.has(await crewId())) {
        await db.meta.put({ id: "business", value: snap.business });
      }
      for (const customer of snap.customers) {
        if (pendingIds.has(customer.id)) continue;
        await db.customers.put({ ...customer, nameKey: customer.name.trim().toLowerCase().replace(/\s+/g, " ") });
      }
      for (const quote of snap.quotes) {
        if (pendingIds.has(quote.id)) continue;
        const { lines, photos, ...rest } = quote;
        await db.quotes.put(rest);
        await db.quoteLines.where("parentId").equals(quote.id).delete();
        await db.quoteLines.bulkPut(lines.map((line) => ({ ...line, parentId: quote.id })));
        await db.quotePhotos.where("quoteId").equals(quote.id).delete();
        await db.quotePhotos.bulkPut(photos.map((photo) => ({ ...photo, quoteId: quote.id })));
      }
      for (const invoice of snap.invoices) {
        if (pendingIds.has(invoice.id) || pendingInvoicePayments.has(invoice.id)) continue;
        const { lines, payments, ...rest } = invoice;
        await db.invoices.put(rest);
        await db.invoiceLines.where("parentId").equals(invoice.id).delete();
        await db.invoiceLines.bulkPut(lines.map((line) => ({ ...line, parentId: invoice.id })));
        await db.payments.where("invoiceId").equals(invoice.id).delete();
        await db.payments.bulkPut(payments);
      }
      for (const item of snap.savedItems) {
        if (!pendingIds.has(item.id)) await db.savedItems.put(item);
      }
      await db.events.clear();
      await db.events.bulkPut(snap.events);
    },
  );
}

async function crewId(): Promise<string> {
  const session = await db.meta.get("session");
  const value = session?.value as { crewId?: string } | undefined;
  return value?.crewId || "";
}
