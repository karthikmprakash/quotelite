import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMoney } from "../../shared/money.ts";
import { useTitle } from "../components/ui.tsx";
import { db } from "../lib/db.ts";

export function Customers() {
  useTitle("Customers · QuoteLite");
  const customers = useLiveQuery(() => db.customers.orderBy("nameKey").toArray(), []);
  if (!customers) return <div className="skeleton" />;
  return (
    <div className="stack">
      <h1>Customers</h1>
      {customers.length === 0 ? <p className="empty">Customers show up when you save a quote.</p> : null}
      {customers.map((customer) => (
        <article className="card" key={customer.id}>
          <Link to={`/app/customers/${customer.id}`}>{customer.name}</Link>
          {customer.phone ? <p className="muted">{customer.phone}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function CustomerDetail() {
  const { id = "" } = useParams();
  const customer = useLiveQuery(() => db.customers.get(id), [id]);
  const quotes = useLiveQuery(() => db.quotes.where("customerId").equals(id).toArray(), [id]);
  const invoices = useLiveQuery(() => db.invoices.where("customerId").equals(id).toArray(), [id]);
  const payments = useLiveQuery(async () => {
    const rows = await db.invoices.where("customerId").equals(id).toArray();
    const all = await db.payments.toArray();
    const ids = new Set(rows.map((row) => row.id));
    return all.filter((payment) => ids.has(payment.invoiceId));
  }, [id]);
  useTitle(customer ? `${customer.name} · QuoteLite` : "Customer · QuoteLite");
  if (customer === undefined || !quotes || !invoices || !payments) return <div className="skeleton" />;
  if (!customer) return <p>No customer with that record.</p>;
  return (
    <div className="stack">
      <h1>{customer.name}</h1>
      <p className="muted">{[customer.phone, customer.email].filter(Boolean).join(" · ")}</p>
      <h2>Quotes</h2>
      {quotes.length === 0 ? <p className="empty">No quotes yet.</p> : null}
      {quotes.map((quote) => (
        <article className="card spread" key={quote.id}>
          <Link to={`/app/quotes/${quote.id}`}>{quote.number}</Link>
          <span>{formatMoney(quote.totalCents)}</span>
        </article>
      ))}
      <h2>Invoices</h2>
      {invoices.length === 0 ? <p className="empty">No invoices yet.</p> : null}
      {invoices.map((invoice) => (
        <article className="card spread" key={invoice.id}>
          <Link to={`/app/invoices/${invoice.id}`}>{invoice.number}</Link>
          <span>{invoice.status}</span>
        </article>
      ))}
      <h2>Payments</h2>
      {payments.length === 0 ? <p className="empty">No payments yet.</p> : null}
      <ul>
        {payments.map((payment) => (
          <li key={payment.id}>
            {formatMoney(payment.amountCents)} · {payment.method}
          </li>
        ))}
      </ul>
    </div>
  );
}
