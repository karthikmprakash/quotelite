import { useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { CaretRight, ChatText, Plus } from "@phosphor-icons/react";
import { balanceDue, formatMoney, paidTotal } from "../../shared/money.ts";
import { shareLinks } from "../../shared/share.ts";
import { EmptyState, PageHeader, StatusPill, ageLabel, daysSince, formatDate, useTitle } from "../components/ui.tsx";
import { db, type Invoice, type Payment, type Quote } from "../lib/db.ts";
import type { Business } from "../lib/actions.ts";

type Filter = "all" | Quote["status"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "converted", label: "Invoiced" },
];

const NEXT_JOB: Record<Quote["status"], number> = {
  sent: 0,
  approved: 1,
  draft: 2,
  converted: 3,
  archived: 4,
};

function dueOf(invoice: Invoice, payments: Payment[]): number {
  const paid = paidTotal(payments.filter((payment) => payment.invoiceId === invoice.id).map((payment) => payment.amountCents));
  return balanceDue(invoice.totalCents, paid);
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="stack" aria-busy="true" aria-label={label}>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-block" />
      <div className="skeleton skeleton-row" />
      <div className="skeleton skeleton-row" />
    </div>
  );
}

export function Home() {
  useTitle("Today · QuoteLite");
  const [filter, setFilter] = useState<Filter>("all");
  const quotes = useLiveQuery(() => db.quotes.orderBy("updatedAt").reverse().toArray(), []);
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const payments = useLiveQuery(() => db.payments.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  if (!quotes || !invoices || !payments || !customers) return <ListSkeleton label="Loading today…" />;

  const open = invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "void");
  const due = open.reduce((sum, invoice) => sum + dueOf(invoice, payments), 0);
  const waiting = quotes.filter((quote) => quote.status === "sent").length;
  const ready = quotes.filter((quote) => quote.status === "approved").length;
  const nameOf = (id: string) => customers.find((customer) => customer.id === id)?.name || "Customer";
  const countOf = (value: Filter) => (value === "all" ? quotes.length : quotes.filter((quote) => quote.status === value).length);
  const shown = (filter === "all" ? quotes : quotes.filter((quote) => quote.status === filter))
    .slice()
    .sort((a, b) => {
      if (filter !== "all") return b.updatedAt.localeCompare(a.updatedAt);
      const rank = NEXT_JOB[a.status] - NEXT_JOB[b.status];
      return rank !== 0 ? rank : b.updatedAt.localeCompare(a.updatedAt);
    });
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="stack-lg">
      <PageHeader title="Today">
        <span className="muted">{today}</span>
      </PageHeader>

      <section className="today-hero" aria-label="Unpaid">
        <div className="today-hero-top">
          <div>
            <p className="today-hero-amount money">{formatMoney(due)}</p>
            <Link className="today-hero-link" to="/app/unpaid">
              {open.length === 0 ? "Nothing unpaid" : `${open.length} invoice${open.length === 1 ? "" : "s"} unpaid`}
              <CaretRight size={14} weight="bold" aria-hidden="true" />
            </Link>
          </div>
          <Link className="btn btn-primary today-hero-cta" to="/app/quotes/new">
            <Plus size={18} weight="bold" aria-hidden="true" />
            New quote
          </Link>
        </div>
        <div className={ready > 0 ? "today-pulse" : "today-pulse today-pulse-solo"}>
          <button
            className="pulse"
            type="button"
            data-active={filter === "sent" ? "true" : undefined}
            onClick={() => setFilter("sent")}
            aria-label={`${waiting} waiting on the customer. Show them.`}
          >
            <strong>{waiting}</strong>
            <span>Waiting</span>
          </button>
          {ready > 0 ? (
            <button
              className="pulse"
              type="button"
              data-active={filter === "approved" ? "true" : undefined}
              onClick={() => setFilter("approved")}
              aria-label={`${ready} ready to invoice. Show them.`}
            >
              <strong>{ready}</strong>
              <span>Ready</span>
            </button>
          ) : null}
        </div>
      </section>

      <section className="quotes-board" aria-labelledby="quotes-heading">
        <div className="quotes-board-head">
          <h2 id="quotes-heading">Quotes</h2>
          {quotes.length > 0 ? (
            <div className="filter-row" role="group" aria-label="Filter quotes">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="filter-chip"
                  aria-pressed={filter === item.value}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                  <span className="filter-count">{countOf(item.value)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {quotes.length === 0 ? (
          <EmptyState title="No quotes yet">Write the first one from the job. It takes about a minute.</EmptyState>
        ) : shown.length === 0 ? (
          <p className="muted list-empty">None in this group.</p>
        ) : (
          <div className="list-panel">
            {shown.map((quote) => (
              <Link className="list-row" to={`/app/quotes/${quote.id}`} key={quote.id}>
                <span className="row-main">
                  <span className="row-title">{nameOf(quote.customerId)}</span>
                  <span className="row-meta">
                    <StatusPill kind="quote" status={quote.status} />
                    <span className="muted">{quote.number}</span>
                    <span className="muted">{formatDate(quote.updatedAt)}</span>
                  </span>
                </span>
                <span className="money row-amount">{formatMoney(quote.totalCents)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function Unpaid() {
  useTitle("Unpaid · QuoteLite");
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const payments = useLiveQuery(() => db.payments.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  if (!invoices || !payments || !customers) return <ListSkeleton label="Loading unpaid invoices…" />;

  const open = invoices
    .filter((invoice) => invoice.status !== "paid" && invoice.status !== "void")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const total = open.reduce((sum, invoice) => sum + dueOf(invoice, payments), 0);

  return (
    <div className="stack-lg">
      <PageHeader title="Unpaid">
        <span className="muted">
          {open.length === 0 ? "Nothing waiting." : `${formatMoney(total)} · ${open.length} invoice${open.length === 1 ? "" : "s"}`}
        </span>
      </PageHeader>
      {open.length === 0 ? (
        <EmptyState
          title="All caught up"
          action={
            <Link className="btn btn-secondary" to="/app">
              Back to Today
            </Link>
          }
        >
          Open invoices stay here until they are paid.
        </EmptyState>
      ) : null}
      <div className="unpaid-list">
        {open.map((invoice) => {
          const customer = customers.find((item) => item.id === invoice.customerId);
          const due = dueOf(invoice, payments);
          const age = daysSince(invoice.createdAt);
          const links = shareLinks({
            url: `${location.origin}/i/${invoice.publicToken}`,
            business: business?.name || "QuoteLite",
            number: invoice.number,
            phone: customer?.phone,
            email: customer?.email,
            docLabel: "invoice",
            reminderAmount: formatMoney(due),
          });
          return (
            <article className="card unpaid-card" key={invoice.id} data-overdue={age >= 7 ? "true" : undefined}>
              <Link className="unpaid-main" to={`/app/invoices/${invoice.id}`}>
                <span className="row-main">
                  <span className="row-title">{customer?.name || "Customer"}</span>
                  <span className="row-meta">
                    <StatusPill kind="invoice" status={invoice.status} />
                    <span className="muted">{invoice.number}</span>
                    <span className={age >= 7 ? "age age-late" : "age"}>Sent {ageLabel(invoice.createdAt)}</span>
                  </span>
                </span>
                <span className="money row-amount">{formatMoney(due)}</span>
              </Link>
              {links.hasPhone ? (
                <a className="btn btn-secondary btn-block" href={links.sms}>
                  <ChatText size={18} weight="bold" aria-hidden="true" />
                  Text reminder
                </a>
              ) : customer ? (
                <Link className="btn btn-secondary btn-block" to={`/app/customers/${customer.id}`}>
                  Add a phone to remind them
                </Link>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
