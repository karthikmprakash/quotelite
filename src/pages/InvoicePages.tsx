import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { balanceDue, formatMoney, paidTotal, parseDollars } from "../../shared/money.ts";
import { shareLinks } from "../../shared/share.ts";
import { Banner, DocumentView, useTitle } from "../components/ui.tsx";
import { markPaid, recordPayment, type Business } from "../lib/actions.ts";
import { db } from "../lib/db.ts";

export function InvoiceDetail() {
  const { id = "" } = useParams();
  const invoice = useLiveQuery(() => db.invoices.get(id), [id]);
  const lines = useLiveQuery(() => db.invoiceLines.where("parentId").equals(id).sortBy("position"), [id]);
  const payments = useLiveQuery(() => db.payments.where("invoiceId").equals(id).toArray(), [id]);
  const customer = useLiveQuery(async () => (invoice ? db.customers.get(invoice.customerId) : undefined), [invoice?.customerId]);
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  const [error, setError] = useState("");
  useTitle(invoice ? `${invoice.number} · QuoteLite` : "Invoice · QuoteLite");

  if (!invoice || !lines || !payments) return <div className="skeleton" />;
  const paid = paidTotal(payments.map((payment) => payment.amountCents));
  const due = balanceDue(invoice.totalCents, paid);
  const url = `${location.origin}/i/${invoice.publicToken}`;
  const links = shareLinks({
    url,
    business: business?.name || "QuoteLite",
    number: invoice.number,
    phone: customer?.phone,
    email: customer?.email,
    docLabel: "invoice",
  });

  function onPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parseDollars(String(new FormData(event.currentTarget).get("amount") || ""));
    if (amount === null) {
      setError("Enter a payment like 40.00.");
      return;
    }
    setError("");
    void recordPayment(id, amount, "cash").catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not record that."));
  }

  return (
    <div className="stack">
      <h1>{invoice.number}</h1>
      <p className="muted">{invoice.status}{invoice.scheduledDate ? ` · visit ${invoice.scheduledDate}` : ""}</p>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <DocumentView
        businessName={business?.name || "QuoteLite"}
        number={invoice.number}
        customerName={customer?.name || "Customer"}
        lines={lines}
        taxBps={invoice.taxBps}
        subtotalCents={invoice.subtotalCents}
        taxCents={invoice.taxCents}
        totalCents={invoice.totalCents}
        notes={invoice.notes}
        terms={invoice.terms}
        paidCents={paid}
        balanceCents={due}
      />
      {payments.length > 0 ? (
        <ul>
          {payments.map((payment) => (
            <li key={payment.id}>
              {formatMoney(payment.amountCents)} {payment.method}
              {payment.feeCents === 0 ? "" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {due > 0 ? (
        <form className="stack" onSubmit={onPay}>
          <label className="field">
            Amount
            <input name="amount" inputMode="decimal" defaultValue="" />
          </label>
          <button className="btn btn-secondary" type="submit">
            Record payment
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setError("");
              void markPaid(id).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not mark it paid."));
            }}
          >
            Mark paid
          </button>
        </form>
      ) : (
        <p className="banner banner-ok">Paid in full.</p>
      )}
      <div className="row">
        <a className="btn btn-secondary" href={links.sms}>Text</a>
        <a className="btn btn-secondary" href={links.whatsapp}>WhatsApp</a>
        <a className="btn btn-secondary" href={links.mailto}>Email</a>
      </div>
      <p>
        Customer link <Link to={`/i/${invoice.publicToken}`}>{`/i/${invoice.publicToken}`}</Link>
      </p>
      <a className="btn btn-secondary" href={`/api/invoices/${invoice.id}/pdf`}>Download PDF</a>
    </div>
  );
}
