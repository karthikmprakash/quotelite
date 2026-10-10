import { expect, test } from "@playwright/test";
import { settle, signUp, watch } from "./helpers.ts";

test("create a quote, reload, and reuse a saved line", async ({ page }) => {
  const errors = watch(page);
  await signUp(page);
  await page.getByRole("link", { name: "New quote" }).click();
  await page.getByLabel("Customer").fill("Rosa Alvarez");
  await page.getByLabel("Phone").fill("5551212121");
  const line = page.getByRole("group", { name: "Line 1" });
  await line.getByLabel("Description").fill("Replace the kitchen faucet");
  await line.getByLabel("Qty").fill("1");
  await line.getByLabel("Price").fill("10.00");
  await page.getByRole("button", { name: "Save for next quote" }).click();
  await page.getByLabel("Tax %").fill("8.25");
  await page.getByLabel("Notes").fill("Shutoff is under the sink.");
  await page.getByLabel("Photos").setInputFiles({
    name: "tap.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGPo0ecjCTGMahjVMHw1AABbHMkBArVH8wAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Save quote" }).click();
  await expect(page.getByRole("heading", { name: /Q-\d+/ })).toBeVisible();
  await expect(page.getByText("Rosa Alvarez")).toBeVisible();
  await expect(page.getByText("Replace the kitchen faucet")).toBeVisible();
  await expect(page.getByText("Shutoff is under the sink.")).toBeVisible();
  await expect(page.getByText("Tax (8.25%)")).toBeVisible();
  await expect(page.getByText("$10.83")).toBeVisible();
  await expect(page.getByRole("img", { name: "Quote photo 1" })).toBeVisible();
  await settle(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Q-\d+/ })).toBeVisible();
  await expect(page.getByText("Replace the kitchen faucet")).toBeVisible();
  await expect(page.getByText("$10.83")).toBeVisible();
  await expect(page.getByRole("img", { name: "Quote photo 1" })).toBeVisible();
  await page.getByRole("link", { name: "Today" }).click();
  await page.getByRole("link", { name: "New quote" }).click();
  await page.getByRole("button", { name: "Replace the kitchen faucet" }).click();
  await expect(page.getByRole("group", { name: "Line 1" }).getByLabel("Description")).toHaveValue("Replace the kitchen faucet");
  await expect(page.getByRole("group", { name: "Line 1" }).getByLabel("Price")).toHaveValue("10.00");
  expect(errors).toEqual([]);
});
