import { describe, expect, it } from "vitest";
import { shareLinks } from "../shared/share.ts";

describe("share links", () => {
  const links = shareLinks({
    url: "https://pay.example/v/abc",
    business: "Alvarez Plumbing",
    number: "Q-1001",
    phone: "(555) 121-2121",
    email: "rosa@example.com",
  });

  it("builds a text, WhatsApp, and email link that each carry the quote url", () => {
    expect(links.sms.startsWith("sms:5551212121?body=")).toBe(true);
    expect(decodeURIComponent(links.sms)).toContain("https://pay.example/v/abc");
    expect(decodeURIComponent(links.sms)).toContain("Alvarez Plumbing");
    expect(decodeURIComponent(links.sms)).toContain("Q-1001");
    expect(links.whatsapp.startsWith("https://wa.me/5551212121?text=")).toBe(true);
    expect(decodeURIComponent(links.whatsapp)).toContain("https://pay.example/v/abc");
    expect(links.mailto.startsWith("mailto:rosa%40example.com?subject=")).toBe(true);
    expect(decodeURIComponent(links.mailto)).toContain("https://pay.example/v/abc");
    expect(decodeURIComponent(links.mailto)).toContain("Quote Q-1001");
    expect(links.hasPhone).toBe(true);
    expect(links.hasEmail).toBe(true);
  });

  it("hides WhatsApp and email when those contacts are missing", () => {
    const bare = shareLinks({
      url: "https://pay.example/v/abc",
      business: "Alvarez Plumbing",
      number: "Q-1001",
    });
    expect(bare.hasPhone).toBe(false);
    expect(bare.hasEmail).toBe(false);
  });

  it("words a reminder with the amount still due", () => {
    const reminder = shareLinks({
      url: "https://pay.example/i/abc",
      business: "Alvarez Plumbing",
      number: "INV-1002",
      docLabel: "invoice",
      reminderAmount: "$165.00",
      email: "rosa@example.com",
    });
    expect(reminder.message).toContain("Reminder from Alvarez Plumbing");
    expect(reminder.message).toContain("$165.00 due");
    expect(decodeURIComponent(reminder.mailto)).toContain("Reminder: Invoice INV-1002");
  });
});
