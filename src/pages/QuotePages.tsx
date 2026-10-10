import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { formatDollarsInput, formatPercent } from "../../shared/money.ts";
import { shareLinks } from "../../shared/share.ts";
import { Banner, DocumentView, useTitle } from "../components/ui.tsx";
import { createQuote, invoiceQuote, saveLineItem, setQuoteStatus, type Business } from "../lib/actions.ts";
import { db } from "../lib/db.ts";
import { readPhoto } from "../lib/photos.ts";

type Draft = { description: string; qty: string; price: string };

export function QuoteForm() {
  useTitle("New quote · QuoteLite");
  const navigate = useNavigate();
  const saved = useLiveQuery(() => db.savedItems.toArray(), []);
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  const [lines, setLines] = useState<Draft[]>([{ description: "", qty: "1", price: "" }]);
  const [photos, setPhotos] = useState<{ mime: string; dataBase64: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function addSaved(description: string, unitPriceCents: number) {
    setLines((current) => {
      const next = { description, qty: "1", price: formatDollarsInput(unitPriceCents) };
      if (current.length === 1 && !current[0].description && !current[0].price) return [next];
      return [...current, next];
    });
  }

  async function onPhotos(files: FileList | null) {
    if (!files) return;
    const room = 3 - photos.length;
    if (files.length > room) setError("You can attach 3 photos.");
    const next = [...photos];
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      next.push(await readPhoto(file));
    }
    setPhotos(next.slice(0, 3));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const quote = await createQuote({
        customerName: String(form.get("customer") || ""),
        phone: String(form.get("phone") || ""),
        email: String(form.get("email") || ""),
        lines,
        taxPercent: String(form.get("tax") || ""),
        notes: String(form.get("notes") || ""),
        photos,
      });
      navigate(`/app/quotes/${quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the quote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <h1>New quote</h1>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <label className="field">
        Customer
        <input name="customer" required autoComplete="name" />
      </label>
      <label className="field">
        Phone
        <input name="phone" type="tel" autoComplete="tel" />
      </label>
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" />
      </label>
      {saved && saved.length > 0 ? (
        <div className="chips" aria-label="Saved items">
          {saved.map((item) => (
            <button
              key={item.id}
              className="chip"
              type="button"
              onClick={() => addSaved(item.description, item.unitPriceCents)}
            >
              {item.description}
            </button>
          ))}
        </div>
      ) : null}
      {lines.map((line, index) => (
        <fieldset key={index}>
          <legend>Line {index + 1}</legend>
          <div className="line-grid">
            <label className="field">
              Description
              <input
                value={line.description}
                onChange={(event) =>
                  setLines((current) => current.map((item, i) => (i === index ? { ...item, description: event.target.value } : item)))
                }
              />
            </label>
            <label className="field">
              Qty
              <input
                inputMode="decimal"
                value={line.qty}
                onChange={(event) =>
                  setLines((current) => current.map((item, i) => (i === index ? { ...item, qty: event.target.value } : item)))
                }
              />
            </label>
            <label className="field">
              Price
              <input
                inputMode="decimal"
                value={line.price}
                onChange={(event) =>
                  setLines((current) => current.map((item, i) => (i === index ? { ...item, price: event.target.value } : item)))
                }
              />
            </label>
          </div>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              void saveLineItem(line.description, line.price).catch((err: unknown) =>
                setError(err instanceof Error ? err.message : "Could not save that item."),
              );
            }}
          >
            Save for next quote
          </button>
        </fieldset>
      ))}
      <button className="btn btn-secondary" type="button" onClick={() => setLines((current) => [...current, { description: "", qty: "1", price: "" }])}>
        Add line
      </button>
      <label className="field">
        Tax %
        <input name="tax" inputMode="decimal" defaultValue={business ? formatPercent(business.taxBps) : "0"} />
      </label>
      <label className="field">
        Notes
        <textarea name="notes" />
      </label>
      <label className="field">
        Photos
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            void onPhotos(event.target.files);
          }}
        />
      </label>
      {photos.length > 0 ? (
        <div className="thumbs">
          {photos.map((photo, index) => (
            <img key={index} alt={`Quote photo ${index + 1}`} src={`data:${photo.mime};base64,${photo.dataBase64}`} />
          ))}
        </div>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
        {busy ? "Saving quote" : "Save quote"}
      </button>
    </form>
  );
}

export function QuoteDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const quote = useLiveQuery(() => db.quotes.get(id), [id]);
  const lines = useLiveQuery(() => db.quoteLines.where("parentId").equals(id).sortBy("position"), [id]);
  const photos = useLiveQuery(() => db.quotePhotos.where("quoteId").equals(id).sortBy("position"), [id]);
  const customer = useLiveQuery(async () => (quote ? db.customers.get(quote.customerId) : undefined), [quote?.customerId]);
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  const events = useLiveQuery(() => db.events.where("entityId").equals(id).reverse().sortBy("at"), [id]);
  const invoice = useLiveQuery(() => db.invoices.where("quoteId").equals(id).first(), [id]);
  const [error, setError] = useState("");
  const [visit, setVisit] = useState("");
  useTitle(quote ? `${quote.number} · QuoteLite` : "Quote · QuoteLite");

  if (quote === undefined || lines === undefined || photos === undefined) return <div className="skeleton" />;
  if (!quote) return <p>That quote is not on this phone.</p>;
  const url = `${location.origin}/v/${quote.publicToken}`;
  const links = shareLinks({
    url,
    business: business?.name || "QuoteLite",
    number: quote.number,
    phone: customer?.phone,
    email: customer?.email,
  });
  const activity = events && events.length > 0 ? events : [{ id: "local", fromStatus: null, toStatus: quote.status, at: quote.updatedAt }];

  return (
    <div className="stack">
      <h1>{quote.number}</h1>
      <p className="muted">{quote.status}</p>
      {error ? <Banner kind="error">{error}</Banner> : null}
      <DocumentView
        businessName={business?.name || "QuoteLite"}
        number={quote.number}
        customerName={customer?.name || "Customer"}
        lines={lines}
        taxBps={quote.taxBps}
        subtotalCents={quote.subtotalCents}
        taxCents={quote.taxCents}
        totalCents={quote.totalCents}
        notes={quote.notes}
        terms={quote.terms}
        photos={photos.map((photo, index) => ({
          alt: `Quote photo ${index + 1}`,
          dataUrl: `data:${photo.mime};base64,${photo.dataBase64}`,
        }))}
      />
      <div className="row">
        <a className="btn btn-secondary" href={links.sms} onClick={() => void setQuoteStatus(id, quote.status === "draft" ? "sent" : quote.status)}>
          Text
        </a>
        <a className="btn btn-secondary" href={links.whatsapp} target="_blank" rel="noreferrer" onClick={() => void setQuoteStatus(id, quote.status === "draft" ? "sent" : quote.status)}>
          WhatsApp
        </a>
        <a className="btn btn-secondary" href={links.mailto} onClick={() => void setQuoteStatus(id, quote.status === "draft" ? "sent" : quote.status)}>
          Email
        </a>
      </div>
      <p>
        Customer link{" "}
        <Link to={`/v/${quote.publicToken}`}>{`/v/${quote.publicToken}`}</Link>
      </p>
      <a className="btn btn-secondary" href={`/api/quotes/${quote.id}/pdf`}>
        Download PDF
      </a>
      {quote.status === "draft" || quote.status === "sent" ? (
        <button className="btn btn-secondary" type="button" onClick={() => void setQuoteStatus(id, "approved").catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not approve."))}>
          Mark approved
        </button>
      ) : null}
      {quote.status === "approved" && !invoice ? (
        <>
          <label className="field">
            Visit date
            <input type="date" value={visit} onChange={(event) => setVisit(event.target.value)} />
          </label>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              void invoiceQuote(id, visit)
                .then((created) => navigate(`/app/invoices/${created.id}`))
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not make the invoice."));
            }}
          >
            Make invoice
          </button>
        </>
      ) : null}
      {invoice ? <Link className="btn btn-primary" to={`/app/invoices/${invoice.id}`}>Open invoice {invoice.number}</Link> : null}
      <ol>
        {activity.map((event) => (
          <li key={event.id}>
            {event.fromStatus ? `${event.fromStatus} → ${event.toStatus}` : event.toStatus} · {event.at.slice(0, 10)}
          </li>
        ))}
      </ol>
    </div>
  );
}
