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
  });
});
