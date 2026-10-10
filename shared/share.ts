export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export type ShareInput = {
  url: string;
  business: string;
  number: string;
  phone?: string;
  email?: string;
  docLabel?: string;
};

export type ShareLinks = {
  sms: string;
  whatsapp: string;
  mailto: string;
  message: string;
};

export function shareMessage(input: ShareInput): string {
  const label = input.docLabel ?? "quote";
  return `${input.business} sent you ${label} ${input.number}. Open it here: ${input.url}`;
}

export function shareLinks(input: ShareInput): ShareLinks {
  const message = shareMessage(input);
  const phone = (input.phone ?? "").replace(/[^\d]/g, "");
  const email = (input.email ?? "").trim();
  const subject = `${input.docLabel === "invoice" ? "Invoice" : "Quote"} ${input.number}`;
  const sms = phone
    ? `sms:${phone}?body=${encodeURIComponent(message)}`
    : `sms:?body=${encodeURIComponent(message)}`;
  const whatsapp = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  return { sms, whatsapp, mailto, message };
}
