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
  reminderAmount?: string;
};

export type ShareLinks = {
  sms: string;
  whatsapp: string;
  mailto: string;
  message: string;
  hasPhone: boolean;
  hasEmail: boolean;
};

export function shareMessage(input: ShareInput): string {
  const label = input.docLabel ?? "quote";
  if (input.reminderAmount) {
    return `Reminder from ${input.business}: ${label} ${input.number} still has ${input.reminderAmount} due. You can view and pay it here: ${input.url}`;
  }
  return `${input.business} sent you ${label} ${input.number}. Open it here: ${input.url}`;
}

export function shareLinks(input: ShareInput): ShareLinks {
  const message = shareMessage(input);
  const phone = (input.phone ?? "").replace(/[^\d]/g, "");
  const email = (input.email ?? "").trim();
  const doc = `${input.docLabel === "invoice" ? "Invoice" : "Quote"} ${input.number}`;
  const subject = input.reminderAmount ? `Reminder: ${doc}` : doc;
  const sms = phone
    ? `sms:${phone}?body=${encodeURIComponent(message)}`
    : `sms:?body=${encodeURIComponent(message)}`;
  const whatsapp = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  return { sms, whatsapp, mailto, message, hasPhone: phone.length > 0, hasEmail: email.length > 0 };
}
