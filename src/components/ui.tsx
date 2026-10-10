import { useEffect, type ReactNode } from "react";
import { formatMoney, formatPercent, formatQty } from "../../shared/money.ts";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export function Banner({ kind, children }: { kind?: "error" | "ok"; children: ReactNode }) {
  return (
    <p className={kind === "error" ? "banner banner-error" : "banner"} role={kind === "error" ? "alert" : undefined}>
      {children}
    </p>
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
}) {
  return (
    <article className="doc">
      <div className="spread">
        <strong>{props.businessName}</strong>
        <span className="muted">{props.number}</span>
      </div>
      <p>
        For <strong>{props.customerName}</strong>
      </p>
      <div className="stack">
        {props.lines.map((line, index) => (
          <div key={`${line.description}-${index}`} className="spread">
            <span>
              {line.description}
              <span className="muted">
                {" "}
                · {formatQty(line.qtyMilli)} × {formatMoney(line.unitPriceCents)}
              </span>
            </span>
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
        <p>
          <span className="muted">Notes</span>
          <br />
          {props.notes}
        </p>
      ) : null}
      {props.terms ? (
        <p>
          <span className="muted">Terms</span>
          <br />
          {props.terms}
        </p>
      ) : null}
    </article>
  );
}
