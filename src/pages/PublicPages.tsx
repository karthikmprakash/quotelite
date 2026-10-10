import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Banner, DocumentView, useTitle } from "../components/ui.tsx";

type PublicQuote = {
  number: string;
  status: string;
  customerName: string;
  businessName: string;
  notes: string;
  terms: string;
  taxBps: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lines: { description: string; qtyMilli: number; unitPriceCents: number; lineCents: number }[];
  photos: { alt: string; dataUrl: string }[];
};

type PublicInvoice = PublicQuote & {
  paidCents: number;
  balanceCents: number;
  cardPayments: "test" | "off";
  status: string;
};

export function PublicQuote() {
  const { token = "" } = useParams();
  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useTitle(quote ? `${quote.number} · ${quote.businessName}` : "Quote");

  useEffect(() => {
    void fetch(`/api/public/quotes/${token}`)
      .then(async (res) => {
        const data = (await res.json()) as PublicQuote & { error?: string };
        if (!res.ok) throw new Error(data.error || "Quote not found.");
        setQuote(data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Quote not found."));
  }, [token]);

  async function approve() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/public/quotes/${token}/approve`, { method: "POST" });
    const data = (await res.json()) as PublicQuote & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not approve.");
      return;
    }
    setQuote(data);
  }

  if (error && !quote) {
    return (
      <main className="content">
        <Banner kind="error">{error}</Banner>
      </main>
    );
  }
  if (!quote) {
    return (
      <main className="content" aria-busy="true">
        <div className="skeleton" />
      </main>
    );
  }
  const approved = quote.status === "approved" || quote.status === "converted";
  return (
    <main className="content stack">
      <h1>{quote.businessName}</h1>
      {error ? <Banner kind="error">{error}</Banner> : null}
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
      />
      {approved ? (
        <p className="banner banner-ok">Approved. The shop has the go-ahead.</p>
      ) : (
        <button className="btn btn-primary btn-block" type="button" onClick={() => void approve()} disabled={busy}>
          Approve
        </button>
      )}
      <a href={`/api/public/quotes/${token}/pdf`}>Download PDF</a>
    </main>
  );
}

export function PublicInvoice() {
  const { token = "" } = useParams();
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useTitle(invoice ? `${invoice.number} · ${invoice.businessName}` : "Invoice");

  useEffect(() => {
    void fetch(`/api/public/invoices/${token}`)
      .then(async (res) => {
        const data = (await res.json()) as PublicInvoice & { error?: string };
        if (!res.ok) throw new Error(data.error || "Invoice not found.");
        setInvoice(data);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Invoice not found."));
  }, [token]);

  async function pay() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/public/invoices/${token}/pay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId: crypto.randomUUID(), paymentMethod: "pm_card_visa" }),
    });
    const data = (await res.json()) as PublicInvoice & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "The card did not go through.");
      return;
    }
    setInvoice(data);
  }

  if (error && !invoice) {
    return (
      <main className="content">
        <Banner kind="error">{error}</Banner>
      </main>
    );
  }
  if (!invoice) {
    return (
      <main className="content" aria-busy="true">
        <div className="skeleton" />
      </main>
    );
  }
  return (
    <main className="content stack">
      <h1>{invoice.businessName}</h1>
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
      />
      {invoice.balanceCents > 0 && invoice.cardPayments === "test" ? (
        <button className="btn btn-primary btn-block" type="button" onClick={() => void pay()} disabled={busy}>
          Pay with test card
        </button>
      ) : null}
      {invoice.balanceCents > 0 && invoice.cardPayments === "off" ? (
        <p className="muted">Ask the shop to take payment. This invoice is still open.</p>
      ) : null}
      {invoice.balanceCents <= 0 ? <p className="banner banner-ok">Paid in full.</p> : null}
    </main>
  );
}
