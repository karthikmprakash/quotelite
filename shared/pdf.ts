import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { formatMoney, formatPercent, formatQty } from "./money.ts";

export type PdfLine = {
  description: string;
  qtyMilli: number;
  unitPriceCents: number;
  lineCents: number;
};

export type PdfDoc = {
  kind: "quote" | "invoice";
  businessName: string;
  number: string;
  issuedLabel: string;
  customerName: string;
  lines: PdfLine[];
  subtotalCents: number;
  taxBps: number;
  taxCents: number;
  totalCents: number;
  notes: string;
  terms: string;
  logoBytes?: Uint8Array;
  paidCents?: number;
  balanceCents?: number;
};

export type Drawn = { text: string; x: number; y: number; size: number };

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const INK = rgb(28 / 255, 25 / 255, 21 / 255);
const MUTED = rgb(74 / 255, 69 / 255, 62 / 255);
const ACCENT = rgb(140 / 255, 47 / 255, 14 / 255);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  const pushWord = (word: string) => {
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      return;
    }
    let buf = "";
    for (const ch of word) {
      const next = buf + ch;
      if (font.widthOfTextAtSize(next, size) > maxWidth && buf) {
        lines.push(buf);
        buf = ch;
      } else {
        buf = next;
      }
    }
    current = buf;
  };
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      pushWord(word);
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function renderDocumentPdf(doc: PdfDoc): Promise<{ bytes: Uint8Array; layout: Drawn[] }> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo: PDFImage | undefined;
  if (doc.logoBytes && doc.logoBytes.byteLength > 0) {
    logo = doc.logoBytes[0] === 0x89 ? await pdf.embedPng(doc.logoBytes) : await pdf.embedJpg(doc.logoBytes);
  }
  const layout: Drawn[] = [];
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const draw = (target: PDFPage, text: string, x: number, baseline: number, size: number, face: PDFFont, color = INK) => {
    target.drawText(text, { x, y: baseline, size, font: face, color });
    layout.push({ text, x: Math.round(x), y: Math.round(baseline), size });
  };

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: ACCENT });
  };

  const ensure = (height: number) => {
    if (y - height < MARGIN + 24) newPage();
  };

  page.drawRectangle({ x: 0, y: PAGE_H - 8, width: PAGE_W, height: 8, color: ACCENT });
  y -= 8;

  if (logo) {
    page.drawImage(logo, { x: MARGIN, y: y - 36, width: 36, height: 36 });
  }
  const titleX = logo ? MARGIN + 48 : MARGIN;
  draw(page, doc.businessName, titleX, y - 16, 18, bold);
  const kind = doc.kind === "quote" ? "QUOTE" : "INVOICE";
  const kindWidth = bold.widthOfTextAtSize(kind, 14);
  draw(page, kind, PAGE_W - MARGIN - kindWidth, y - 14, 14, bold, ACCENT);
  draw(page, doc.number, titleX, y - 36, 11, font, MUTED);
  const dateWidth = font.widthOfTextAtSize(doc.issuedLabel, 11);
  draw(page, doc.issuedLabel, PAGE_W - MARGIN - dateWidth, y - 36, 11, font, MUTED);
  y -= 56;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: rgb(227 / 255, 220 / 255, 208 / 255),
  });
  y -= 22;
  draw(page, "For", MARGIN, y, 10, bold, MUTED);
  y -= 16;
  draw(page, doc.customerName, MARGIN, y, 13, bold);
  y -= 28;

  draw(page, "Description", MARGIN, y, 9, bold, MUTED);
  draw(page, "Qty", 360, y, 9, bold, MUTED);
  draw(page, "Price", 420, y, 9, bold, MUTED);
  const amountHeader = "Amount";
  draw(page, amountHeader, PAGE_W - MARGIN - bold.widthOfTextAtSize(amountHeader, 9), y, 9, bold, MUTED);
  y -= 16;

  for (const line of doc.lines) {
    const descLines = wrap(line.description, font, 11, 290);
    const rowHeight = Math.max(1, descLines.length) * 14 + 8;
    ensure(rowHeight);
    descLines.forEach((text, index) => {
      draw(page, text, MARGIN, y - index * 14, 11, font);
    });
    draw(page, formatQty(line.qtyMilli), 360, y, 11, font);
    const price = formatMoney(line.unitPriceCents);
    draw(page, price, 420, y, 11, font);
    const amount = formatMoney(line.lineCents);
    draw(page, amount, PAGE_W - MARGIN - font.widthOfTextAtSize(amount, 11), y, 11, font);
    y -= rowHeight;
  }

  y -= 8;
  ensure(78);
  const right = PAGE_W - MARGIN;
  const row = (label: string, value: string, face = font, size = 11) => {
    draw(page, label, 360, y, size, face);
    draw(page, value, right - face.widthOfTextAtSize(value, size), y, size, face);
    y -= 16;
  };
  row("Subtotal", formatMoney(doc.subtotalCents));
  row(`Tax (${formatPercent(doc.taxBps)}%)`, formatMoney(doc.taxCents));
  row("Total", formatMoney(doc.totalCents), bold, 13);
  if (doc.kind === "invoice") {
    row("Paid", formatMoney(doc.paidCents ?? 0));
    row("Balance", formatMoney(doc.balanceCents ?? doc.totalCents), bold, 12);
  }

  const block = (label: string, body: string) => {
    if (!body.trim()) return;
    y -= 8;
    ensure(36);
    draw(page, label, MARGIN, y, 10, bold, MUTED);
    y -= 16;
    for (const text of wrap(body, font, 11, PAGE_W - MARGIN * 2)) {
      ensure(16);
      draw(page, text, MARGIN, y, 11, font);
      y -= 14;
    }
  };
  block("Notes", doc.notes);
  block("Terms", doc.terms);

  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    const label = `Page ${index + 1} of ${pages.length}`;
    item.drawText(label, {
      x: MARGIN,
      y: 28,
      size: 9,
      font,
      color: MUTED,
    });
    layout.push({ text: label, x: MARGIN, y: 28, size: 9 });
  });

  const bytes = await pdf.save();
  return { bytes, layout };
}
