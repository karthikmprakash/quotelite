import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChatText, Check, Copy, EnvelopeSimple, ShareNetwork, WhatsappLogo, X } from "@phosphor-icons/react";
import { formatMoney, formatPercent, formatQty } from "../../shared/money.ts";
import type { ShareLinks } from "../../shared/share.ts";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function Banner({
  kind,
  children,
  action,
  onDismiss,
}: {
  kind?: "error" | "ok" | "info";
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
}) {
  const tone = kind === "error" ? "banner banner-error" : kind === "ok" ? "banner banner-ok" : "banner";
  return (
    <div className={tone} role={kind === "error" ? "alert" : "status"}>
      <p className="banner-body">{children}</p>
      {action}
      {onDismiss ? (
        <button className="banner-close" type="button" aria-label="Dismiss" onClick={onDismiss}>
          <X size={16} weight="bold" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

type Tone = "neutral" | "info" | "success" | "warning" | "accent";

const QUOTE_STATUS: Record<string, { label: string; hint: string; tone: Tone }> = {
  draft: { label: "Draft", hint: "Not sent yet", tone: "neutral" },
  sent: { label: "Sent", hint: "Waiting on the customer", tone: "info" },
  approved: { label: "Approved", hint: "Ready to invoice", tone: "success" },
  converted: { label: "Invoiced", hint: "Invoice made", tone: "accent" },
  archived: { label: "Closed", hint: "No longer active", tone: "neutral" },
};

const INVOICE_STATUS: Record<string, { label: string; hint: string; tone: Tone }> = {
  open: { label: "Unpaid", hint: "Nothing paid yet", tone: "warning" },
  partial: { label: "Part paid", hint: "Balance still due", tone: "info" },
  paid: { label: "Paid", hint: "Paid in full", tone: "success" },
  void: { label: "Void", hint: "Cancelled", tone: "neutral" },
};

export function statusInfo(kind: "quote" | "invoice", status: string) {
  const table = kind === "quote" ? QUOTE_STATUS : INVOICE_STATUS;
  return table[status] ?? { label: status, hint: "", tone: "neutral" as Tone };
}

export function StatusPill({ kind, status }: { kind: "quote" | "invoice"; status: string }) {
  const info = statusInfo(kind, status);
  return (
    <span className="pill" data-tone={info.tone}>
      {info.label}
    </span>
  );
}

export function PageHeader({
  title,
  back,
  children,
}: {
  title: ReactNode;
  back?: { to: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      {back ? (
        <Link className="back-link" to={back.to}>
          <ArrowLeft size={16} weight="bold" aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <h1>{title}</h1>
      {children ? <div className="page-meta">{children}</div> : null}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-doc" />
    </div>
  );
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  transfer: "Bank transfer",
  card: "Card",
  other: "Check or other",
};

export const PAYMENT_METHODS = Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }));

export function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

function parseDay(value: string): Date {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
}

export function formatDate(value: string): string {
  const date = parseDay(value);
  if (Number.isNaN(date.getTime())) return value;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}

export function ageLabel(iso: string): string {
  const days = daysSince(iso);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function ShareActions({
  links,
  url,
  title,
  onShare,
  customerName,
}: {
  links: ShareLinks;
  url: string;
  title: string;
  onShare?: () => void;
  customerName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [more, setMore] = useState(false);
  const canShare = typeof navigator.share === "function";
  const first = customerName?.trim().split(/\s+/)[0];
  const textLabel = first ? `Text ${first}` : "Text";

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function copy() {
    void copyText(url).then((ok) => {
      if (!ok) return;
      setCopied(true);
      onShare?.();
    });
  }

  return (
    <div className="share-grid">
      {links.hasPhone ? (
        <a className="btn btn-primary btn-block" href={links.sms} onClick={onShare}>
          <ChatText size={18} weight="bold" aria-hidden="true" />
          {textLabel}
        </a>
      ) : (
        <button className="btn btn-primary btn-block" type="button" aria-live="polite" onClick={copy}>
          {copied ? <Check size={18} weight="bold" aria-hidden="true" /> : <Copy size={18} weight="bold" aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      )}
      <button className="btn btn-ghost btn-sm share-toggle" type="button" aria-expanded={more} onClick={() => setMore((open) => !open)}>
        {more ? "Hide other ways" : "More ways to send"}
      </button>
      {more ? (
        <div className="share-more-list">
          {links.hasPhone ? (
            <a className="btn btn-secondary" href={links.whatsapp} target="_blank" rel="noreferrer" onClick={onShare}>
              <WhatsappLogo size={18} weight="bold" aria-hidden="true" />
              WhatsApp
            </a>
          ) : null}
          {links.hasEmail ? (
            <a className="btn btn-secondary" href={links.mailto} onClick={onShare}>
              <EnvelopeSimple size={18} weight="bold" aria-hidden="true" />
              Email
            </a>
          ) : null}
          {links.hasPhone ? (
            <button className="btn btn-secondary" type="button" aria-live="polite" onClick={copy}>
              {copied ? <Check size={18} weight="bold" aria-hidden="true" /> : <Copy size={18} weight="bold" aria-hidden="true" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          ) : null}
          {canShare ? (
            <button
              className="btn btn-secondary share-more"
              type="button"
              onClick={() => {
                void navigator
                  .share({ title, text: links.message, url })
                  .then(() => onShare?.())
                  .catch(() => undefined);
              }}
            >
              <ShareNetwork size={18} weight="bold" aria-hidden="true" />
              More options
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type ViewLine = {
  description: string;
  qtyMilli: number;
  unitPriceCents: number;
  lineCents: number;
};

export function DocumentView(props: {
  businessName: string;
  number: string;
  customerName: string;
  lines: ViewLine[];
  taxBps: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  notes?: string;
  terms?: string;
  photos?: { dataUrl: string; alt: string }[];
  paidCents?: number;
  balanceCents?: number;
  issued?: string;
}) {
  return (
    <article className="doc">
      <header className="doc-head">
        <div>
          <strong className="doc-business">{props.businessName}</strong>
          <p className="doc-for">
            For <strong>{props.customerName}</strong>
          </p>
        </div>
        <div className="doc-number">
          <span>{props.number}</span>
          {props.issued ? <span className="muted">{props.issued}</span> : null}
        </div>
      </header>
      <div className="doc-lines">
        {props.lines.map((line, index) => (
          <div key={`${line.description}-${index}`} className="doc-line">
            <div className="doc-line-main">
              <span className="doc-line-desc">{line.description}</span>
              <span className="muted doc-line-qty">
                {formatQty(line.qtyMilli)} × {formatMoney(line.unitPriceCents)}
              </span>
            </div>
            <span className="money">{formatMoney(line.lineCents)}</span>
          </div>
        ))}
      </div>
      {props.photos && props.photos.length > 0 && (
        <div className="thumbs">
          {props.photos.map((photo) => (
            <img key={photo.alt} src={photo.dataUrl} alt={photo.alt} />
          ))}
        </div>
      )}
      <div className="totals">
        <div>
          <span>Subtotal</span>
          <span className="money">{formatMoney(props.subtotalCents)}</span>
        </div>
        <div>
          <span>Tax ({formatPercent(props.taxBps)}%)</span>
          <span className="money">{formatMoney(props.taxCents)}</span>
        </div>
        <div className="grand">
          <span>Total</span>
          <span className="money">{formatMoney(props.totalCents)}</span>
        </div>
        {props.paidCents !== undefined && (
          <div>
            <span>Paid</span>
            <span className="money">{formatMoney(props.paidCents)}</span>
          </div>
        )}
        {props.balanceCents !== undefined && (
          <div className="grand">
            <span>Balance</span>
            <span className="money">{formatMoney(props.balanceCents)}</span>
          </div>
        )}
      </div>
      {props.notes ? (
        <div className="doc-note">
          <span className="muted">Notes</span>
          <p>{props.notes}</p>
        </div>
      ) : null}
      {props.terms ? (
        <div className="doc-note">
          <span className="muted">Terms</span>
          <p>{props.terms}</p>
        </div>
      ) : null}
    </article>
  );
}
