# Final report

Date: 2026-10-10. Nine features verified, one blocked. `python3 tools/status.py` reports 10/10 resolved.

## 1. Status per feature

| ID | Name | Status | Verify command |
| --- | --- | --- | --- |
| F1 | Create a quote | verified | `npx playwright test e2e/f1-quote.spec.ts` |
| F2 | Quote issued as a link the customer can open without an account | verified | `npx playwright test e2e/f2-public.spec.ts` |
| F3 | Deliver the quote by SMS / WhatsApp / email | verified | `npx vitest run test/share.test.ts` |
| F4 | One-tap quote → invoice | verified | `npx playwright test e2e/f4-convert.spec.ts` |
| F5 | Partial payments and mark-as-paid | verified | `npx vitest run test/payments.test.ts` |
| F6 | Customer list with job history | verified | `npx playwright test e2e/f6-customers.spec.ts` |
| F7 | Offline-first core loop | verified | `npx playwright test e2e/f7-offline.spec.ts` |
| F8 | Bring-your-own payment account | blocked | Needs `STRIPE_SECRET_KEY`. See below. |
| F9 | Flat pricing, unlimited users and quotes | verified | `npx vitest run test/no-quota.test.ts` |
| F10 | Quote/invoice PDF | verified | `npx vitest run test/pdf.test.ts` |

## 2. Evidence

Receipts, including the failing stripe-mock attempt that was not marked verified, are in `replica/EVIDENCE.md`.

## 3. Blocked

**F8.** The pay route is in the app. It accepts only a Stripe test secret, confirms `pm_card_visa`, and the payments table rejects any fee other than 0. Nothing in this environment could finish a succeeded charge.

What the human must supply: a Stripe test secret (`sk_test_...`) and a matching publishable key (`pk_test_...`). Put the secret in the environment as `STRIPE_SECRET_KEY`. Do not commit it. Then run `npx vitest run test/stripe.test.ts`. Paste the keys in Settings only in a local database, which is gitignored.

stripe-mock 0.206.0 was tried. It left the PaymentIntent at `requires_payment_method`. That is not a succeeded test-card payment, so F8 stays blocked.

## 4. Deviations from the PRD

- There is no job between the quote and the invoice. An optional visit date sits on the invoice. Dispatch stays out.
- Solo ($19) and Crew ($29) are labels. The app does not charge either one. There is no platform Stripe account to bill the crew.
- Text, WhatsApp, and email are prefilled links. No SMS gateway sends the 3-day and 7-day chases. The unpaid list shows them as text links.
- The database is SQLite in the Node process, not hosted Postgres. Tests can run with no account.
- Public links do not expire and do not ask for the last four digits of a phone number.
- Photos sit on the quote, up to three, not on each line.
- Layout diff against the reference was not scored. Its UI is behind a login, and this run did not open an account.

## 5. How to run it

```bash
npm install
npx playwright install chromium
npm test
npm start
```

`npm start` builds the PWA and listens on `http://127.0.0.1:8787`. The database file is `data/quotelite.sqlite`, created on first launch. Sign up in the browser. There is no seed password in the repo.

`npm test` is the unit tests, a production build, and the Playwright suite. `bash tools/verify.sh --strict` is the whole gate.

## 6. Known weaknesses

- Card pay is unproven against Stripe. The button is on the public invoice and will 400 until a test key is saved.
- Two phones offline can pick the same invoice number. The server rejects the duplicate. The first phone keeps it. The second sees a permanent sync error and that write is dropped from the outbox.
- The service worker must be installed while online before a cold start works with no signal. A phone that has never opened the app cannot.
- Photos and the logo are base64 in SQLite and IndexedDB. Fine for three small images. It will get heavy if someone attaches large jobs every day.
- Subscription billing for QuoteLite itself is not built. The prices on the landing page are not collected.
- Node's built-in SQLite is still marked experimental on this runtime.
- Apple review links in `replica/reviews.csv` use the review id as a fragment on the app's reviews page. The body text is the RSS `content` field, copied as returned.
- A full-repo brand sweep flags `PRD.md` and `AGENT-BUILD-PROMPT.md` because those files name the reference on purpose. `src`, `server`, `shared`, `public`, and `index.html` are clean.

## 7. What to build next

1. Finish F8 with a real Stripe test key, then a card form that is not hard-wired to `pm_card_visa`.
2. Invoice numbers that cannot collide across two phones offline.
3. A real text reminder at day 3 and day 7, once a messaging key exists. Not a dispatch board.
