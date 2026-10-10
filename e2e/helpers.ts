import { expect, type Page } from "@playwright/test";

export async function ensureControlled(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 3000);
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  });
}

export async function signUp(page: Page) {
  await ensureControlled(page);
  const email = `rosa-${crypto.randomUUID()}@example.com`;
  await page.goto("/start");
  await page.getByLabel("Your name").fill("Rosa Alvarez");
  await page.getByLabel("Business name").fill("Alvarez Plumbing");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-pass-1234");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/app");
  return email;
}

export function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource|net::ERR_|favicon/i.test(text)) return;
    errors.push(text);
  });
  page.on("response", (res) => {
    if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
  });
  return errors;
}

export async function settle(page: Page) {
  await expect(page.getByRole("status")).toHaveText("Synced");
}

export async function armOffline(page: Page) {
  await ensureControlled(page);
}
