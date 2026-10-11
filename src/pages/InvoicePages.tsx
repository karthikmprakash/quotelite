import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle, CloudArrowUp, Eye, FilePdf } from "@phosphor-icons/react";
import { balanceDue, formatDollarsInput, formatMoney, paidTotal, parseDollars } from "../../shared/money.ts";
import { shareLinks } from "../../shared/share.ts";
import {
  Banner,
  DetailSkeleton,
  DocumentView,
  EmptyState,
  PAYMENT_METHODS,
  PageHeader,
  ShareActions,
  StatusPill,
  formatDate,
  methodLabel,
  useTitle,
} from "../components/ui.tsx";
import { markPaid, recordPayment, type Business } from "../lib/actions.ts";
import { db, type Payment } from "../lib/db.ts";

export function InvoiceDetail() {
  const { id = "" } = useParams();
  const invoice = useLiveQuery(async () => (await db.invoices.get(id)) ?? null, [id]);
  const lines = useLiveQuery(() => db.invoiceLines.where("parentId").equals(id).sortBy("position"), [id]);
  const payments = useLiveQuery(() => db.payments.where("invoiceId").equals(id).sortBy("createdAt"), [id]);
  const customer = useLiveQuery(async () => (invoice ? db.customers.get(invoice.customerId) : undefined), [invoice?.customerId]);
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  const unsynced = useLiveQuery(() => db.outbox.where("recordId").equals(id).count(), [id]) ?? 0;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [amount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<Payment["method"]>("cash");
  useTitle(invoice ? `${invoice.number} · QuoteLite` : "Invoice · QuoteLite");

  if (invoice === undefined || !lines || !payments) return <DetailSkeleton />;
  if (!invoice) {
    return (
      <EmptyState
        title="That invoice is not on this phone"
        action={
          <Link className="btn btn-primary" to="/app/unpaid">
            Back to Unpaid
          </Link>
        }
      >
        It may belong to another account, or the link is old.
      </EmptyState>
    );
  }

  const paid = paidTotal(payments.map((payment) => payment.amountCents));
  const due = balanceDue(invoice.totalCents, paid);
  const amountValue = amount ?? formatDollarsInput(due);
  const url = `${location.origin}/i/${invoice.publicToken}`;
  const links = shareLinks({
    url,
    business: business?.name || "QuoteLite",
    number: invoice.number,
    phone: customer?.phone,
    email: customer?.email,
    docLabel: "invoice",
  });
  const fail = (fallback: string) => (err: unknown) => setError(err instanceof Error ? err.message : fallback);

  function onPay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseDollars(amountValue);
    if (cents === null) {
      setError("Enter a payment like 40.00.");
      return;
    }
    setError("");
    setNotice("");
    void recordPayment(id, cents, method)
      .then(() => {
        setAmount(null);
        setNotice(`Recorded ${formatMoney(cents)} (${methodLabel(method).toLowerCase()}).`);
      })
      .catch(fail("Could not record that."));
  }

  return (
    <div className="detail">
      <PageHeader title={invoice.number} back={due > 0 ? { to: "/app/unpaid", label: "Unpaid" } : { to: "/app", label: "Today" }}>
        <StatusPill kind="invoice" status={invoice.status} />
        {customer ? (
          <Link className="text-link" to={`/app/customers/${customer.id}`}>
            {customer.name}
          </Link>
        ) : null}
        {invoice.scheduledDate ? <span className="muted">Visit {formatDate(invoice.scheduledDate)}</span> : null}
      </PageHeader>
      {error ? (
        <Banner kind="error" onDismiss={() => setError("")}>
          {error}
        </Banner>
      ) : null}
      <div className="detail-grid">
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
          issued={formatDate(invoice.createdAt)}
          paidCents={paid}
          balanceCents={due}
        />
        <aside className="detail-side">
          {due > 0 ? (
            <section className="panel panel-primary stack" aria-labelledby="collect-heading">
              <div className="due">
                <h2 id="collect-heading">Collect payment</h2>
                <p className="due-amount money">{formatMoney(due)}</p>
                <p className="muted">{paid > 0 ? `${formatMoney(paid)} paid so far` : "Nothing paid yet"}</p>
              </div>
              {notice ? <Banner kind="ok">{notice}</Banner> : null}
              <form className="stack" onSubmit={onPay}>
                <div className="field-pair">
                  <label className="field">
                    Amount
                    <input name="amount" inputMode="decimal" value={amountValue} onChange={(event) => setAmount(event.target.value)} />
                  </label>
                  <label className="field">
                    Paid by
                    <select value={method} onChange={(event) => setMethod(event.target.value as Payment["method"])}>
                      {PAYMENT_METHODS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="button-pair">
                  <button className="btn btn-secondary" type="submit">
                    Record payment
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => {
                      setError("");
                      void markPaid(id, method)
                        .then(() => setNotice(""))
                        .catch(fail("Could not mark it paid."));
                    }}
                  >
                    Mark paid in full
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <section className="panel panel-success" aria-label="Payment status">
              <p className="paid-banner">
                <CheckCircle size={22} weight="fill" aria-hidden="true" />
                <span>Paid in full.</span>
              </p>
            </section>
          )}

          {payments.length > 0 ? (
            <section className="panel" aria-labelledby="payments-heading">
              <h2 id="payments-heading">Payments</h2>
              <ul className="ledger">
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

          <section className="panel stack" aria-labelledby="send-invoice-heading">
            <h2 id="send-invoice-heading">Send the invoice</h2>
            <ShareActions links={links} url={url} title={`Invoice ${invoice.number}`} />
            {unsynced > 0 ? (
              <p className="hint">
                <CloudArrowUp size={18} weight="duotone" aria-hidden="true" />
                Saved on this phone. The link opens for the customer once this phone syncs.
              </p>
            ) : null}
            <div className="link-row">
              <Link className="text-link" to={`/i/${invoice.publicToken}`} target="_blank" rel="noreferrer">
                <Eye size={16} weight="bold" aria-hidden="true" />
                Preview as customer
              </Link>
              <a className="text-link" href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                <FilePdf size={16} weight="bold" aria-hidden="true" />
                Download PDF
              </a>
            </div>
          </section>
          {invoice.quoteId ? (
            <Link className="text-link" to={`/app/quotes/${invoice.quoteId}`}>
              View the original quote
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
