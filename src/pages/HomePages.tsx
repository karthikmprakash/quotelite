import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { balanceDue, formatMoney, paidTotal } from "../../shared/money.ts";
import { shareLinks } from "../../shared/share.ts";
import { useTitle } from "../components/ui.tsx";
import { db } from "../lib/db.ts";
import type { Business } from "../lib/actions.ts";

export function Home() {
  useTitle("Today · QuoteLite");
  const quotes = useLiveQuery(() => db.quotes.orderBy("updatedAt").reverse().toArray(), []);
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const payments = useLiveQuery(() => db.payments.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  if (!quotes || !invoices || !payments || !customers) {
    return (
      <div aria-busy="true">
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }
  const open = invoices.filter((invoice) => invoice.status !== "paid");
  const due = open.reduce((sum, invoice) => {
    const paid = paidTotal(payments.filter((payment) => payment.invoiceId === invoice.id).map((payment) => payment.amountCents));
    return sum + balanceDue(invoice.totalCents, paid);
  }, 0);
  const nameOf = (id: string) => customers.find((customer) => customer.id === id)?.name || "Customer";
  return (
    <div className="stack">
      <h1>Today</h1>
      <Link className="btn btn-primary btn-block" to="/app/quotes/new">
        New quote
      </Link>
      <article className="card">
        <p className="muted">Still unpaid</p>
        <p className="price money">{formatMoney(due)}</p>
      </article>
      {quotes.length === 0 ? (
        <p className="empty">No quotes yet. The first one takes about a minute.</p>
      ) : (
        <div className="stack">
          {quotes.map((quote) => (
            <article className="card spread" key={quote.id}>
              <Link to={`/app/quotes/${quote.id}`}>
                {quote.number}
                <span className="muted"> · {nameOf(quote.customerId)}</span>
              </Link>
              <span className="money">{formatMoney(quote.totalCents)}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function Unpaid() {
  useTitle("Unpaid · QuoteLite");
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const payments = useLiveQuery(() => db.payments.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  if (!invoices || !payments || !customers) return <div className="skeleton" />;
  const open = invoices.filter((invoice) => invoice.status !== "paid");
  return (
    <div className="stack">
      <h1>Unpaid</h1>
      {open.length === 0 ? <p className="empty">Nobody owes you right now.</p> : null}
      {open.map((invoice) => {
        const customer = customers.find((item) => item.id === invoice.customerId);
        const paid = paidTotal(payments.filter((payment) => payment.invoiceId === invoice.id).map((payment) => payment.amountCents));
        const due = balanceDue(invoice.totalCents, paid);
        const age = Math.floor((Date.now() - Date.parse(invoice.createdAt)) / 86400000);
        const chase = age >= 7 ? "7-day reminder" : age >= 3 ? "3-day reminder" : "";
        const url = `${location.origin}/i/${invoice.publicToken}`;
        const links = shareLinks({
          url,
          business: business?.name || "QuoteLite",
          number: invoice.number,
          phone: customer?.phone,
          email: customer?.email,
          docLabel: "invoice",
        });
        return (
          <article className="card stack" key={invoice.id}>
            <div className="spread">
              <Link to={`/app/invoices/${invoice.id}`}>{invoice.number}</Link>
              <span className="money">{formatMoney(due)}</span>
            </div>
            <p className="muted">
              {customer?.name} · {age} days
              {chase ? ` · ${chase}` : ""}
            </p>
            <a className="btn btn-secondary" href={links.sms}>
              Text
            </a>
          </article>
        );
      })}
    </div>
  );
}
