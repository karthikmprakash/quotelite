import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ChatText, EnvelopeSimple, MagnifyingGlass, Phone, Plus } from "@phosphor-icons/react";
import { balanceDue, formatMoney, paidTotal } from "../../shared/money.ts";
import { Banner, EmptyState, PageHeader, StatusPill, formatDate, methodLabel, useTitle } from "../components/ui.tsx";
import { updateCustomer } from "../lib/actions.ts";
import { db } from "../lib/db.ts";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : "");
}

export function Customers() {
  useTitle("Customers · QuoteLite");
  const [query, setQuery] = useState("");
  const customers = useLiveQuery(() => db.customers.orderBy("nameKey").toArray(), []);
  const quotes = useLiveQuery(() => db.quotes.toArray(), []);
  if (!customers || !quotes) {
    return (
      <div className="stack" aria-busy="true" aria-label="Loading customers…">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-row" />
        <div className="skeleton skeleton-row" />
      </div>
    );
  }
  const needle = query.trim().toLowerCase();
  const digits = needle.replace(/\D/g, "");
  const shown = needle
    ? customers.filter(
        (customer) =>
          customer.nameKey.includes(needle) ||
          customer.email.toLowerCase().includes(needle) ||
          (digits.length > 2 && customer.phone.replace(/\D/g, "").includes(digits)),
      )
    : customers;
  const quoteCount = (id: string) => quotes.filter((quote) => quote.customerId === id).length;

  return (
    <div className="stack-lg">
      <PageHeader title="Customers">
        <span className="muted">
          {customers.length === 0 ? "Saved with each new quote." : `${customers.length} saved`}
        </span>
      </PageHeader>
      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          action={
            <Link className="btn btn-primary" to="/app/quotes/new">
              <Plus size={18} weight="bold" aria-hidden="true" />
              New quote
            </Link>
          }
        >
          Each new name on a quote becomes a customer, with their phone and email saved.
        </EmptyState>
      ) : (
        <>
          <label className="search">
            <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
            <span className="sr-only">Search customers</span>
            <input
              type="search"
              placeholder="Search by name, phone, or email…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {shown.length === 0 ? (
            <p className="muted list-empty">Nobody matches “{query.trim()}”.</p>
          ) : (
            <div className="list-panel">
              {shown.map((customer) => {
                const count = quoteCount(customer.id);
                return (
                  <Link className="list-row" to={`/app/customers/${customer.id}`} key={customer.id}>
                    <span className="avatar" aria-hidden="true">
                      {initials(customer.name)}
                    </span>
                    <span className="row-main">
                      <span className="row-title">{customer.name}</span>
                      <span className="row-meta muted">{customer.phone || customer.email || "No contact details"}</span>
                    </span>
                    <span className="muted row-count">
                      {count} quote{count === 1 ? "" : "s"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CustomerDetail() {
  const { id = "" } = useParams();
  const customer = useLiveQuery(async () => (await db.customers.get(id)) ?? null, [id]);
  const quotes = useLiveQuery(() => db.quotes.where("customerId").equals(id).reverse().sortBy("updatedAt"), [id]);
  const invoices = useLiveQuery(() => db.invoices.where("customerId").equals(id).reverse().sortBy("createdAt"), [id]);
  const payments = useLiveQuery(async () => {
    const rows = await db.invoices.where("customerId").equals(id).toArray();
    const ids = new Set(rows.map((row) => row.id));
    return (await db.payments.toArray()).filter((payment) => ids.has(payment.invoiceId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [id]);
  const [draft, setDraft] = useState({ name: "", phone: "", email: "" });
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useTitle(customer ? `${customer.name} · QuoteLite` : "Customer · QuoteLite");
  useEffect(() => {
    if (!customer) return;
    setDraft({ name: customer.name, phone: customer.phone, email: customer.email });
  }, [customer]);
  if (customer === undefined || !quotes || !invoices || !payments) {
    return (
      <div className="stack" aria-busy="true" aria-label="Loading customer…">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-block" />
      </div>
    );
  }
  if (!customer) {
    return (
      <EmptyState
        title="No customer with that record"
        action={
          <Link className="btn btn-primary" to="/app/customers">
            All customers
          </Link>
        }
      />
    );
  }

  const phone = customer.phone.replace(/[^\d+]/g, "");
  const owed = invoices.reduce((sum, invoice) => {
    const paid = paidTotal(payments.filter((payment) => payment.invoiceId === invoice.id).map((payment) => payment.amountCents));
    return sum + balanceDue(invoice.totalCents, paid);
  }, 0);
  const quoted = quotes.reduce((sum, quote) => sum + quote.totalCents, 0);
  const received = paidTotal(payments.map((payment) => payment.amountCents));

  return (
    <div className="stack-lg">
      <PageHeader title={customer.name} back={{ to: "/app/customers", label: "All customers" }}>
        <span className="muted">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact details yet"}</span>
      </PageHeader>

      {error ? (
        <Banner kind="error" onDismiss={() => setError("")}>
          {error}
        </Banner>
      ) : null}
      {note ? (
        <Banner kind="ok" onDismiss={() => setNote("")}>
          {note}
        </Banner>
      ) : null}

      {editing ? (
        <form
          className="panel stack"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            void updateCustomer(customer.id, draft)
              .then(() => {
                setNote("Saved their contact details.");
                setEditing(false);
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save."))
              .finally(() => setBusy(false));
          }}
        >
          <h2>Contact</h2>
          <label className="field">
            Name
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <div className="field-pair">
            <label className="field">
              Phone
              <input
                type="tel"
                inputMode="tel"
                value={draft.phone}
                onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
              />
            </label>
            <label className="field">
              Email
              <input
                type="email"
                spellCheck={false}
                value={draft.email}
                onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
          </div>
          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? "Saving…" : "Save contact"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="contact-row">
          <button className="btn btn-secondary" type="button" onClick={() => setEditing(true)}>
            Edit contact
          </button>
        {phone ? (
          <a className="btn btn-secondary" href={`tel:${phone}`}>
            <Phone size={18} weight="bold" aria-hidden="true" />
            Call
          </a>
        ) : null}
        {phone ? (
          <a className="btn btn-secondary" href={`sms:${phone}`}>
            <ChatText size={18} weight="bold" aria-hidden="true" />
            Text
          </a>
        ) : null}
        {customer.email ? (
          <a className="btn btn-secondary" href={`mailto:${customer.email}`}>
            <EnvelopeSimple size={18} weight="bold" aria-hidden="true" />
            Email
          </a>
        ) : null}
        <Link className="btn btn-primary" to={`/app/quotes/new?customer=${customer.id}`}>
          <Plus size={18} weight="bold" aria-hidden="true" />
          New quote for {customer.name.split(" ")[0]}
        </Link>
      </div>
      )}

      <div className="stats stats-three">
        <div className="stat">
          <span className="stat-label">Quoted</span>
          <span className="stat-value money">{formatMoney(quoted)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Paid</span>
          <span className="stat-value money">{formatMoney(received)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Still owed</span>
          <span className="stat-value money">{formatMoney(owed)}</span>
        </div>
      </div>

      <section className="stack" aria-labelledby="customer-quotes">
        <h2 id="customer-quotes">Quotes</h2>
        {quotes.length === 0 ? (
          <p className="muted list-empty">No quotes yet.</p>
        ) : (
          <div className="list-panel">
            {quotes.map((quote) => (
              <Link className="list-row" to={`/app/quotes/${quote.id}`} key={quote.id}>
                <span className="row-main">
                  <span className="row-title">{quote.number}</span>
                  <span className="row-meta">
                    <StatusPill kind="quote" status={quote.status} />
                    <span className="muted">{formatDate(quote.updatedAt)}</span>
                  </span>
                </span>
                <span className="money row-amount">{formatMoney(quote.totalCents)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="customer-invoices">
        <h2 id="customer-invoices">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="muted list-empty">No invoices yet.</p>
        ) : (
          <div className="list-panel">
            {invoices.map((invoice) => (
              <Link className="list-row" to={`/app/invoices/${invoice.id}`} key={invoice.id}>
                <span className="row-main">
                  <span className="row-title">{invoice.number}</span>
                  <span className="row-meta">
                    <StatusPill kind="invoice" status={invoice.status} />
                    <span className="muted">{formatDate(invoice.createdAt)}</span>
                  </span>
                </span>
                <span className="money row-amount">{formatMoney(invoice.totalCents)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {payments.length > 0 ? (
        <section className="stack" aria-labelledby="customer-payments">
          <h2 id="customer-payments">Payments</h2>
          <ul className="ledger panel">
            {payments.map((payment) => (
              <li key={payment.id}>
                <span className="money">{formatMoney(payment.amountCents)}</span>
                <span className="muted">
                  {methodLabel(payment.method)} · {formatDate(payment.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
