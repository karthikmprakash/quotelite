import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { ArrowsClockwise, CheckCircle, CreditCard, EnvelopeSimple, FilePdf, Phone } from "@phosphor-icons/react";
import { formatMoney } from "../../shared/money.ts";
import { Banner, DocumentView, formatDate, methodLabel, useTitle } from "../components/ui.tsx";

type PublicDoc = {
  number: string;
  status: string;
  customerName: string;
  businessName: string;
  businessPhone?: string;
  businessEmail?: string;
  logoDataUrl?: string | null;
  issuedLabel?: string;
  notes: string;
  terms: string;
  taxBps: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lines: { description: string; qtyMilli: number; unitPriceCents: number; lineCents: number }[];
  photos?: { alt: string; dataUrl: string }[];
};

type PublicInvoiceDoc = PublicDoc & {
  paidCents: number;
  balanceCents: number;
  cardPayments: "test" | "off";
  scheduledDate?: string | null;
  payments?: { amountCents: number; method: string; createdAt: string }[];
};

function usePublicDoc<T>(path: string, missing: string) {
  const [doc, setDoc] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    void fetch(path)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as T & { error?: string };
        if (!res.ok) throw new Error(data.error || missing);
        setDoc(data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : missing))
      .finally(() => setLoading(false));
  }, [path, missing]);

  useEffect(() => load(), [load]);
  return { doc, setDoc, error, setError, loading, reload: load };
}

function PublicShell({ doc, children, bar }: { doc: PublicDoc; children: ReactNode; bar?: ReactNode }) {
  const phone = (doc.businessPhone || "").replace(/[^\d+]/g, "");
  return (
    <div className="public">
      <header className="public-head">
        <div className="public-brand">
          {doc.logoDataUrl ? (
            <img src={doc.logoDataUrl} alt="" className="public-logo" />
          ) : (
            <span className="public-logo public-logo-empty" aria-hidden="true">
              {doc.businessName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="public-name">{doc.businessName}</span>
        </div>
        <div className="public-contact">
          {phone ? (
            <a className="btn btn-ghost btn-sm" href={`tel:${phone}`}>
              <Phone size={16} weight="bold" aria-hidden="true" />
              <span>{doc.businessPhone}</span>
            </a>
          ) : null}
          {doc.businessEmail ? (
            <a className="btn btn-ghost btn-sm public-email" href={`mailto:${doc.businessEmail}`}>
              <EnvelopeSimple size={16} weight="bold" aria-hidden="true" />
              <span>Email</span>
            </a>
          ) : null}
        </div>
      </header>
      <main id="main" className="public-main">
        {children}
      </main>
      {bar ? <div className="public-bar">{bar}</div> : null}
    </div>
  );
}

function NotReady({ kind, onRetry, loading }: { kind: "quote" | "invoice"; onRetry: () => void; loading: boolean }) {
  return (
    <main className="public public-missing">
      <div className="panel stack">
        <h1>This {kind} is not ready yet</h1>
        <p className="muted">
          If it was just sent, the sender's phone may still be syncing it. Try again in a minute, or ask them to send the
          link again.
        </p>
        <button className="btn btn-primary" type="button" onClick={onRetry} disabled={loading} aria-busy={loading}>
          <ArrowsClockwise size={18} weight="bold" aria-hidden="true" />
          {loading ? "Checking…" : "Try again"}
        </button>
      </div>
    </main>
  );
}

function Loading() {
  return (
    <main className="public public-missing" aria-busy="true" aria-label="Loading…">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-doc" />
    </main>
  );
}

export function PublicQuote() {
  const { token = "" } = useParams();
  const { doc: quote, setDoc, error, setError, loading, reload } = usePublicDoc<PublicDoc>(`/api/public/quotes/${token}`, "Quote not found.");
  const [busy, setBusy] = useState(false);
  useTitle(quote ? `Quote ${quote.number} · ${quote.businessName}` : "Quote");

  async function approve() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/quotes/${token}/approve`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as PublicDoc & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not approve.");
      setDoc(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!quote && loading) return <Loading />;
  if (!quote) return <NotReady kind="quote" onRetry={reload} loading={loading} />;
  const approved = quote.status === "approved" || quote.status === "converted";
  const closed = quote.status === "archived";

  return (
    <PublicShell
      doc={quote}
      bar={
        approved ? (
          <p className="paid-banner">
            <CheckCircle size={22} weight="fill" aria-hidden="true" />
            <span>Approved. The shop has the go-ahead.</span>
          </p>
        ) : closed ? (
          <p className="muted">This quote is closed.</p>
        ) : (
          <>
            <div className="public-bar-total">
              <span className="muted">Total</span>
              <strong className="money">{formatMoney(quote.totalCents)}</strong>
            </div>
            <button className="btn btn-primary btn-lg" type="button" onClick={() => void approve()} disabled={busy} aria-busy={busy}>
              {busy ? "Approving…" : "Approve"}
            </button>
          </>
        )
      }
    >
      <div className="public-title">
        <h1>Quote {quote.number}</h1>
        <p className="muted">
          For {quote.customerName}
          {quote.issuedLabel ? ` · ${quote.issuedLabel}` : ""}
        </p>
      </div>
      {error ? <Banner kind="error">{error}</Banner> : null}
      {!approved && !closed ? (
        <p className="public-lede">Check the work and price below. Tap Approve to give {quote.businessName} the go-ahead.</p>
      ) : null}
      <DocumentView
        businessName={quote.businessName}
        number={quote.number}
        customerName={quote.customerName}
        lines={quote.lines}
        taxBps={quote.taxBps}
        subtotalCents={quote.subtotalCents}
        taxCents={quote.taxCents}
        totalCents={quote.totalCents}
        notes={quote.notes}
        terms={quote.terms}
        photos={quote.photos}
        issued={quote.issuedLabel}
      />
      <a className="btn btn-secondary public-pdf" href={`/api/public/quotes/${token}/pdf`} target="_blank" rel="noreferrer">
        <FilePdf size={18} weight="bold" aria-hidden="true" />
        Download PDF
      </a>
    </PublicShell>
  );
}

export function PublicInvoice() {
  const { token = "" } = useParams();
  const { doc: invoice, setDoc, error, setError, loading, reload } = usePublicDoc<PublicInvoiceDoc>(
    `/api/public/invoices/${token}`,
    "Invoice not found.",
  );
  const [busy, setBusy] = useState(false);
  useTitle(invoice ? `Invoice ${invoice.number} · ${invoice.businessName}` : "Invoice");

  async function pay() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/public/invoices/${token}/pay`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), paymentMethod: "pm_card_visa" }),
      });
      const data = (await res.json().catch(() => ({}))) as PublicInvoiceDoc & { error?: string };
      if (!res.ok) throw new Error(data.error || "The card did not go through.");
      setDoc(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The card did not go through.");
    } finally {
      setBusy(false);
    }
  }

  if (!invoice && loading) return <Loading />;
  if (!invoice) return <NotReady kind="invoice" onRetry={reload} loading={loading} />;
  const paidUp = invoice.balanceCents <= 0;

  return (
    <PublicShell
      doc={invoice}
      bar={
        paidUp ? (
          <p className="paid-banner">
            <CheckCircle size={22} weight="fill" aria-hidden="true" />
            <span>Paid in full. Thank you.</span>
          </p>
        ) : invoice.cardPayments === "test" ? (
          <>
            <div className="public-bar-total">
              <span className="muted">Balance due</span>
              <strong className="money">{formatMoney(invoice.balanceCents)}</strong>
            </div>
            <button className="btn btn-primary btn-lg" type="button" onClick={() => void pay()} disabled={busy} aria-busy={busy}>
              <CreditCard size={18} weight="bold" aria-hidden="true" />
              {busy ? "Paying…" : "Pay with test card"}
            </button>
          </>
        ) : (
          <>
            <div className="public-bar-total">
              <span className="muted">Balance due</span>
              <strong className="money">{formatMoney(invoice.balanceCents)}</strong>
            </div>
            <p className="muted public-bar-note">Pay {invoice.businessName} directly. They will mark it paid.</p>
          </>
        )
      }
    >
      <div className="public-title">
        <h1>Invoice {invoice.number}</h1>
        <p className="muted">
          For {invoice.customerName}
          {invoice.issuedLabel ? ` · ${invoice.issuedLabel}` : ""}
          {invoice.scheduledDate ? ` · Visit ${formatDate(invoice.scheduledDate)}` : ""}
        </p>
      </div>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <DocumentView
        businessName={invoice.businessName}
        number={invoice.number}
        customerName={invoice.customerName}
        lines={invoice.lines}
        taxBps={invoice.taxBps}
        subtotalCents={invoice.subtotalCents}
        taxCents={invoice.taxCents}
        totalCents={invoice.totalCents}
        notes={invoice.notes}
        terms={invoice.terms}
        paidCents={invoice.paidCents}
        balanceCents={invoice.balanceCents}
        issued={invoice.issuedLabel}
      />
      {invoice.payments && invoice.payments.length > 0 ? (
        <section className="panel" aria-labelledby="public-payments">
          <h2 id="public-payments">Payments received</h2>
          <ul className="ledger">
            {invoice.payments.map((payment, index) => (
              <li key={`${payment.createdAt}-${index}`}>
                <span className="money">{formatMoney(payment.amountCents)}</span>
                <span className="muted">
                  {methodLabel(payment.method)} · {formatDate(payment.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <a className="btn btn-secondary public-pdf" href={`/api/public/invoices/${token}/pdf`} target="_blank" rel="noreferrer">
        <FilePdf size={18} weight="bold" aria-hidden="true" />
        Download PDF
      </a>
    </PublicShell>
  );
}
