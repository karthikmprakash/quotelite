import { useEffect, useState, type FormEvent } from "react";
import { Link, useMatch, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Camera, Check, CloudArrowUp, Eye, FilePdf, Plus, Trash, X } from "@phosphor-icons/react";
import {
  computeTotals,
  formatDollarsInput,
  formatMoney,
  formatPercent,
  formatQty,
  lineCents,
  parseDollars,
  parseQty,
  parseTaxPercent,
} from "../../shared/money.ts";
import { normalizeName, shareLinks } from "../../shared/share.ts";
import {
  Banner,
  DetailSkeleton,
  DocumentView,
  EmptyState,
  PageHeader,
  ShareActions,
  StatusPill,
  formatDate,
  statusInfo,
  useTitle,
} from "../components/ui.tsx";
import { createQuote, invoiceQuote, saveLineItem, setQuoteStatus, updateCustomer, updateQuote, type Business } from "../lib/actions.ts";
import { db, type StatusEvent } from "../lib/db.ts";
import { readPhoto } from "../lib/photos.ts";

type Draft = { key: string; description: string; qty: string; price: string; saved?: boolean };

const NEW_QUOTE_DRAFT = "quotelite.new-quote";

type StoredDraft = {
  customer: { name: string; phone: string; email: string };
  lines: Draft[];
  tax: string | null;
  notes: string;
};

function readStoredDraft(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(NEW_QUOTE_DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function blankLine(partial: Partial<Draft> = {}): Draft {
  return { key: crypto.randomUUID(), description: "", qty: "1", price: "", ...partial };
}

function priceOf(line: Draft): number {
  const qty = parseQty(line.qty);
  const price = parseDollars(line.price);
  return qty !== null && price !== null ? lineCents(qty, price) : 0;
}

export function QuoteForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editMatch = useMatch("/app/quotes/:id/edit");
  const editId = editMatch?.params.id;
  const existing = useLiveQuery(async () => (editId ? ((await db.quotes.get(editId)) ?? null) : undefined), [editId]);
  const existingLines = useLiveQuery(async () => (editId ? db.quoteLines.where("parentId").equals(editId).sortBy("position") : []), [editId]);
  const existingPhotos = useLiveQuery(async () => (editId ? db.quotePhotos.where("quoteId").equals(editId).sortBy("position") : []), [editId]);
  const existingCustomer = useLiveQuery(async () => (existing ? db.customers.get(existing.customerId) : undefined), [existing?.customerId]);
  useTitle(editId ? `Edit quote · QuoteLite` : "New quote · QuoteLite");
  const saved = useLiveQuery(() => db.savedItems.toArray(), []);
  const customers = useLiveQuery(() => db.customers.orderBy("nameKey").toArray(), []);
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "" });
  const [lines, setLines] = useState<Draft[]>(() => [blankLine()]);
  const [tax, setTax] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ mime: string; dataBase64: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!editId) return;
    if (existing === null) return;
    if (!existing || !existingLines || !existingPhotos || !existingCustomer) return;
    if (existing.status !== "draft") {
      navigate(`/app/quotes/${editId}`, { replace: true });
      return;
    }
    if (hydrated) return;
    setCustomer({ name: existingCustomer.name, phone: existingCustomer.phone, email: existingCustomer.email });
    setLines(
      existingLines.length > 0
        ? existingLines.map((line) =>
            blankLine({
              description: line.description,
              qty: formatQty(line.qtyMilli),
              price: formatDollarsInput(line.unitPriceCents),
            }),
          )
        : [blankLine()],
    );
    setTax(formatPercent(existing.taxBps));
    setNotes(existing.notes);
    setPhotos(existingPhotos.map((photo) => ({ mime: photo.mime, dataBase64: photo.dataBase64 })));
    setHydrated(true);
  }, [editId, existing, existingLines, existingPhotos, existingCustomer, hydrated, navigate]);

  const preset = params.get("customer");
  useEffect(() => {
    if (editId) return;
    if (preset && customers === undefined) return;
    if (hydrated) return;
    const match = preset ? customers?.find((item) => item.id === preset) : undefined;
    if (match) {
      setCustomer({ name: match.name, phone: match.phone, email: match.email });
      setHydrated(true);
      return;
    }
    const stored = readStoredDraft();
    if (!stored) {
      setHydrated(true);
      return;
    }
    setCustomer(stored.customer);
    setLines(stored.lines?.length ? stored.lines.map((line) => blankLine(line)) : [blankLine()]);
    setTax(stored.tax);
    setNotes(stored.notes || "");
    if (stored.notes || stored.tax) setShowDetails(true);
    setHydrated(true);
  }, [preset, customers, editId, hydrated]);

  useEffect(() => {
    if (editId || !hydrated) return;
    const timer = window.setTimeout(() => {
      const payload: StoredDraft = { customer, lines, tax, notes };
      try {
        localStorage.setItem(NEW_QUOTE_DRAFT, JSON.stringify(payload));
      } catch {
        /* storage full */
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [editId, hydrated, customer, lines, tax, notes]);

  const taxValue = tax ?? (business ? formatPercent(business.taxBps) : "0");
  const taxBps = parseTaxPercent(taxValue) ?? 0;
  const lineTotals = lines.map(priceOf);
  const totals = computeTotals(lineTotals.map((cents) => ({ lineCents: cents })), taxBps);
  const known = customers?.find((item) => item.nameKey === normalizeName(customer.name));
  const hasWork = lines.some((line) => line.description.trim().length > 0);
  const detailsOpen = showDetails || hasWork || notes.length > 0 || photos.length > 0;

  function onCustomerName(value: string) {
    const match = customers?.find((item) => item.nameKey === normalizeName(value));
    setCustomer((current) => ({
      name: value,
      phone: match && !current.phone ? match.phone : current.phone,
      email: match && !current.email ? match.email : current.email,
    }));
  }

  function updateLine(index: number, patch: Partial<Draft>) {
    setLines((current) => current.map((item, i) => (i === index ? { ...item, ...patch, saved: patch.saved ?? false } : item)));
  }

  function addSaved(description: string, unitPriceCents: number) {
    setLines((current) => {
      const next = blankLine({ description, price: formatDollarsInput(unitPriceCents), saved: true });
      if (current.length === 1 && !current[0].description && !current[0].price) return [next];
      return [...current, next];
    });
  }

  async function onPhotos(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0) return;
    const room = 3 - photos.length;
    setError(files.length > room ? "A quote can carry 3 photos. The extra ones were left off." : "");
    const next = [...photos];
    for (const file of files.slice(0, Math.max(0, room))) {
      try {
        next.push(await readPhoto(file));
      } catch {
        setError("Could not read one of those photos. Try a JPEG or PNG.");
      }
    }
    setPhotos(next.slice(0, 3));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const payload = {
      customerName: customer.name,
      phone: customer.phone,
      email: customer.email,
      lines,
      taxPercent: taxValue,
      notes,
      photos,
    };
    try {
      const quote = editId ? await updateQuote(editId, payload) : await createQuote(payload);
      if (!editId) localStorage.removeItem(NEW_QUOTE_DRAFT);
      navigate(`/app/quotes/${quote.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the quote.");
    } finally {
      setBusy(false);
    }
  }

  if (editId && existing === undefined) return <DetailSkeleton />;
  if (editId && existing === null) {
    return (
      <EmptyState
        title="That quote is not on this phone"
        action={
          <Link className="btn btn-primary" to="/app">
            Back to Today
          </Link>
        }
      />
    );
  }

  return (
    <form className="quote-form" onSubmit={onSubmit} noValidate>
      <PageHeader
        title={editId && existing ? `Edit ${existing.number}` : "New quote"}
        back={editId ? { to: `/app/quotes/${editId}`, label: existing?.number || "Quote" } : { to: "/app", label: "Today" }}
      />

      <section className="panel stack" aria-labelledby="customer-heading">
        <h2 id="customer-heading">Customer</h2>
        <label className="field">
          <span className="sr-only">Name</span>
          <input
            name="customer"
            required
            autoComplete="off"
            list="customer-options"
            placeholder="Name of the person paying…"
            aria-describedby={known ? "customer-hint" : undefined}
            value={customer.name}
            onChange={(event) => onCustomerName(event.target.value)}
          />
          {known ? (
            <span id="customer-hint" className="field-hint">
              Existing customer. Their details are filled in.
            </span>
          ) : null}
        </label>
        <datalist id="customer-options">
          {customers?.map((item) => (
            <option key={item.id} value={item.name}>
              {item.phone || item.email}
            </option>
          ))}
        </datalist>
        <div className="field-pair">
          <label className="field">
            Phone
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="555-0100…"
              value={customer.phone}
              onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>
          <label className="field">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="customer@example.com…"
              value={customer.email}
              onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
        </div>
      </section>

      <section className="panel stack" aria-labelledby="work-heading">
        <h2 id="work-heading">Work</h2>
        {saved && saved.length > 0 ? (
          <div className="stack-tight">
            <span className="field-hint">Tap a saved item to add it</span>
            <div className="chips" aria-label="Saved items">
              {saved.map((item) => (
                <button key={item.id} className="chip" type="button" onClick={() => addSaved(item.description, item.unitPriceCents)}>
                  {item.description}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {lines.map((line, index) => (
          <fieldset key={line.key} className="line">
            <legend>Line {index + 1}</legend>
            <div className="line-grid">
              <label className="field line-desc">
                Description
                <input
                  value={line.description}
                  placeholder="Drain clear…"
                  onChange={(event) => updateLine(index, { description: event.target.value })}
                />
              </label>
              <label className="field">
                Qty
                <input
                  inputMode="decimal"
                  value={line.qty}
                  placeholder="1…"
                  onChange={(event) => updateLine(index, { qty: event.target.value })}
                />
              </label>
              <label className="field">
                Price
                <input
                  inputMode="decimal"
                  value={line.price}
                  placeholder="95.00…"
                  onChange={(event) => updateLine(index, { price: event.target.value })}
                />
              </label>
            </div>
            <div className="line-foot">
              <div className="line-actions">
                {line.description.trim() ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    disabled={line.saved}
                    onClick={() => {
                      void saveLineItem(line.description, line.price)
                        .then(() => updateLine(index, { saved: true }))
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save that item."));
                    }}
                  >
                    {line.saved ? <Check size={16} weight="bold" aria-hidden="true" /> : null}
                    {line.saved ? "Saved for next time" : "Save for next quote"}
                  </button>
                ) : null}
                {lines.length > 1 ? (
                  <button
                    className="btn btn-ghost btn-sm btn-quiet-danger"
                    type="button"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash size={16} weight="bold" aria-hidden="true" />
                    Remove
                  </button>
                ) : null}
              </div>
              <span className="money line-total">{formatMoney(lineTotals[index])}</span>
            </div>
          </fieldset>
        ))}
        <button className="btn btn-secondary" type="button" onClick={() => setLines((current) => [...current, blankLine()])}>
          <Plus size={18} weight="bold" aria-hidden="true" />
          Add line
        </button>
      </section>

      {detailsOpen ? (
      <section className="panel stack" aria-labelledby="details-heading">
        <h2 id="details-heading">Details</h2>
        <label className="field field-narrow">
          Tax %
          <input
            name="tax"
            inputMode="decimal"
            aria-describedby="tax-hint"
            value={taxValue}
            onChange={(event) => setTax(event.target.value)}
          />
          <span id="tax-hint" className="field-hint">
            Your default comes from Settings.
          </span>
        </label>
        <label className="field">
          Notes
          <textarea
            name="notes"
            placeholder="Access notes, materials, timing…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="field">
          <span>
            Photos <span className="muted">({photos.length} of 3)</span>
          </span>
          <div className="photo-tray">
            {photos.map((photo, index) => (
              <div className="photo-thumb" key={`${index}-${photo.dataBase64.length}`}>
                <img alt={`Quote photo ${index + 1}`} src={`data:${photo.mime};base64,${photo.dataBase64}`} />
                <button
                  type="button"
                  className="photo-remove"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                >
                  <X size={14} weight="bold" aria-hidden="true" />
                </button>
              </div>
            ))}
            {photos.length < 3 ? (
              <label className="photo-add">
                <Camera size={22} weight="duotone" aria-hidden="true" />
                <span>Add photo</span>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  aria-label="Photos"
                  onChange={(event) => void onPhotos(event.currentTarget)}
                />
              </label>
            ) : null}
          </div>
        </div>
      </section>
      ) : (
        <button className="btn btn-ghost" type="button" onClick={() => setShowDetails(true)}>
          Add tax, notes, or photos
        </button>
      )}

      <div className="form-bar">
        {error ? (
          <p className="form-bar-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-bar-row">
          <div className="form-bar-total">
            <span className="muted">{taxBps > 0 ? `Total with ${formatPercent(taxBps)}% tax` : "Total"}</span>
            <strong className="money">{formatMoney(totals.totalCents)}</strong>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : editId ? "Save changes" : "Save quote"}
          </button>
        </div>
      </div>
    </form>
  );
}

function eventLabel(event: Pick<StatusEvent, "fromStatus" | "toStatus">): string {
  if (!event.fromStatus) return event.toStatus === "draft" ? "Created" : `Created as ${statusInfo("quote", event.toStatus).label.toLowerCase()}`;
  if (event.toStatus === "sent") return "Sent to the customer";
  if (event.toStatus === "approved") return "Approved";
  if (event.toStatus === "converted") return "Invoice made";
  return statusInfo("quote", event.toStatus).label;
}

export function QuoteDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const quote = useLiveQuery(async () => (await db.quotes.get(id)) ?? null, [id]);
  const lines = useLiveQuery(() => db.quoteLines.where("parentId").equals(id).sortBy("position"), [id]);
  const photos = useLiveQuery(() => db.quotePhotos.where("quoteId").equals(id).sortBy("position"), [id]);
  const customer = useLiveQuery(async () => (quote ? db.customers.get(quote.customerId) : undefined), [quote?.customerId]);
  const business = useLiveQuery(async () => (await db.meta.get("business"))?.value as Business | undefined, []);
  const events = useLiveQuery(() => db.events.where("entityId").equals(id).sortBy("at"), [id]);
  const invoice = useLiveQuery(() => db.invoices.where("quoteId").equals(id).first(), [id]);
  const unsynced = useLiveQuery(() => db.outbox.where("recordId").equals(id).count(), [id]) ?? 0;
  const [error, setError] = useState("");
  const [visit, setVisit] = useState("");
  const [busy, setBusy] = useState(false);
  const [contact, setContact] = useState({ phone: "", email: "" });
  const [contactReady, setContactReady] = useState(false);
  const [editContact, setEditContact] = useState(false);
  useTitle(quote ? `${customer?.name || quote.number} · QuoteLite` : "Quote · QuoteLite");

  useEffect(() => {
    if (!customer || contactReady) return;
    setContact({ phone: customer.phone, email: customer.email });
    setContactReady(true);
  }, [customer, contactReady]);

  if (quote === undefined || lines === undefined || photos === undefined) return <DetailSkeleton />;
  if (!quote) {
    return (
      <EmptyState
        title="That quote is not on this phone"
        action={
          <Link className="btn btn-primary" to="/app">
            Back to Today
          </Link>
        }
      >
        It may belong to another account, or the link is old.
      </EmptyState>
    );
  }

  const url = `${location.origin}/v/${quote.publicToken}`;
  const links = shareLinks({
    url,
    business: business?.name || "QuoteLite",
    number: quote.number,
    phone: customer?.phone,
    email: customer?.email,
  });
  const info = statusInfo("quote", quote.status);
  const activity = events && events.length > 0 ? events : [{ id: "local", fromStatus: null, toStatus: quote.status, at: quote.createdAt }];
  const sendable = quote.status === "draft" || quote.status === "sent";
  const fail = (fallback: string) => (err: unknown) => setError(err instanceof Error ? err.message : fallback);

  return (
    <div className="detail">
      <PageHeader title={customer?.name || quote.number} back={{ to: "/app", label: "Today" }}>
        <StatusPill kind="quote" status={quote.status} />
        <span>{quote.number}</span>
        <span>{info.hint}</span>
        {quote.status === "draft" ? (
          <Link className="btn btn-secondary btn-sm" to={`/app/quotes/${id}/edit`}>
            Edit quote
          </Link>
        ) : null}
      </PageHeader>
      {error ? (
        <Banner kind="error" onDismiss={() => setError("")}>
          {error}
        </Banner>
      ) : null}
      <div className="detail-grid">
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
          issued={formatDate(quote.createdAt)}
          photos={photos.map((photo, index) => ({
            alt: `Quote photo ${index + 1}`,
            dataUrl: `data:${photo.mime};base64,${photo.dataBase64}`,
          }))}
        />
        <aside className="detail-side">
          {sendable ? (
            <section className="panel panel-primary stack" aria-labelledby="send-heading">
              <h2 id="send-heading">{customer?.name ? `Send to ${customer.name}` : quote.status === "draft" ? "Send it to the customer" : "Send it again"}</h2>
              <p>They open the link and tap Approve. No account needed.</p>
              {!links.hasPhone && !links.hasEmail ? (
                <p className="hint">Add their phone or email so Text opens to them.</p>
              ) : null}
              {customer && (editContact || (!links.hasPhone && !links.hasEmail)) ? (
                <form
                  className="contact-edit"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void updateCustomer(customer.id, contact)
                      .then(() => {
                        setError("");
                        setEditContact(false);
                      })
                      .catch(fail("Could not save their contact."));
                  }}
                >
                  <div className="field-pair">
                    <label className="field">
                      Phone
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={contact.phone}
                        onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                    <label className="field">
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        spellCheck={false}
                        value={contact.email}
                        onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>
                  </div>
                  {contact.phone !== customer.phone || contact.email !== customer.email ? (
                    <button className="btn btn-secondary btn-sm" type="submit">
                      Save contact
                    </button>
                  ) : null}
                </form>
              ) : customer ? (
                <button className="btn btn-ghost btn-sm contact-toggle" type="button" onClick={() => setEditContact(true)}>
                  Change number or email
                </button>
              ) : null}
              <ShareActions
                links={links}
                url={url}
                title={`Quote ${quote.number}`}
                customerName={customer?.name}
                onShare={() => {
                  if (quote.status === "draft") void setQuoteStatus(id, "sent").catch(fail("Could not mark it sent."));
                }}
              />
              {unsynced > 0 ? (
                <p className="hint">
                  <CloudArrowUp size={18} weight="duotone" aria-hidden="true" />
                  Saved on this phone. The link opens for the customer once this phone syncs.
                </p>
              ) : null}
              <Link className="text-link" to={`/v/${quote.publicToken}`} target="_blank" rel="noreferrer">
                <Eye size={16} weight="bold" aria-hidden="true" />
                Preview as customer
              </Link>
              <button
                className="btn btn-secondary btn-block"
                type="button"
                onClick={() => {
                  const who = customer?.name || "the customer";
                  if (!window.confirm(`${who} said yes in person. Mark this quote approved?`)) return;
                  void setQuoteStatus(id, "approved").catch(fail("Could not approve."));
                }}
              >
                Mark approved
              </button>
            </section>
          ) : null}

          {quote.status === "approved" && !invoice ? (
            <section className="panel panel-primary stack" aria-labelledby="invoice-heading">
              <h2 id="invoice-heading">Approved. Make the invoice.</h2>
              <p className="muted">Lines and prices copy over, so there is nothing to retype.</p>
              <label className="field">
                Visit date (optional)
                <input type="date" value={visit} onChange={(event) => setVisit(event.target.value)} />
              </label>
              <button
                className="btn btn-primary btn-block"
                type="button"
                disabled={busy}
                aria-busy={busy}
                onClick={() => {
                  setBusy(true);
                  void invoiceQuote(id, visit)
                    .then((created) => navigate(`/app/invoices/${created.id}`))
                    .catch(fail("Could not make the invoice."))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Making invoice…" : "Make invoice"}
              </button>
            </section>
          ) : null}

          {invoice ? (
            <Link className="btn btn-primary btn-block" to={`/app/invoices/${invoice.id}`}>
              Open invoice {invoice.number}
            </Link>
          ) : null}

          <section className="panel stack" aria-labelledby="files-heading">
            <h2 id="files-heading">Files</h2>
            <a className="btn btn-secondary btn-block" href={`/api/quotes/${quote.id}/pdf`} target="_blank" rel="noreferrer">
              <FilePdf size={18} weight="bold" aria-hidden="true" />
              Download PDF
            </a>
          </section>

          <section className="panel" aria-labelledby="activity-heading">
            <h2 id="activity-heading">Activity</h2>
            <ol className="timeline">
              {[...activity].reverse().map((event) => (
                <li key={event.id}>
                  <span>{eventLabel(event)}</span>
                  <span className="muted">{formatDate(event.at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
