import { expect, test } from "@playwright/test";
import { signUp, watch } from "./helpers.ts";

test("two quotes for one name land on one customer", async ({ page }) => {
  const errors = watch(page);
  await signUp(page);
  for (const [description, price] of [
    ["Replace the kitchen faucet", "10.00"],
    ["Unclog the bath drain", "85.00"],
  ] as const) {
    await page.getByRole("link", { name: "Today" }).click();
    await page.getByRole("link", { name: "New quote" }).click();
    await page.getByLabel("Customer").fill("Rosa Alvarez");
    const line = page.getByRole("group", { name: "Line 1" });
    await line.getByLabel("Description").fill(description);
    await line.getByLabel("Qty").fill("1");
    await line.getByLabel("Price").fill(price);
    await page.getByRole("button", { name: "Save quote" }).click();
    await expect(page.getByRole("heading", { name: /Q-\d+/ })).toBeVisible();
  }
  await page.getByRole("link", { name: "Customers" }).click();
  await expect(page.getByRole("link", { name: "Rosa Alvarez" })).toHaveCount(1);
  await page.getByRole("link", { name: "Rosa Alvarez" }).click();
  await expect(page.getByRole("heading", { name: "Rosa Alvarez" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Q-\d+/ })).toHaveCount(2);
  expect(errors).toEqual([]);
});
