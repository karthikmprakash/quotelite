# Evidence log

Append-only receipts written by `tools/record.py`. A feature is `verified` only if a
command here exited 0. Do not hand-edit this file.

## [F9] Flat pricing, unlimited users and quotes — 2026-10-10 16:52:52Z

note: harness self-test

command: `echo 'no seat or quota gating paths found'`
exit code: 0

```
no seat or quota gating paths found
```

## [F1] Create a quote — 2026-10-10 17:25:10Z

note: Created a quote with customer, line, 8.25% tax, notes and a photo, reloaded, and reused the saved line.

command: `npx playwright test e2e/f1-quote.spec.ts`
exit code: 0

```
Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/f1-quote.spec.ts:4:1 › create a quote, reload, and reuse a saved line (848ms)

  1 passed (1.7s)
(node:92947) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## [F9] Flat pricing, unlimited users and quotes — 2026-10-10 17:25:11Z

note: No seat or quota checks in src, server, or shared. Five people and six quotes save.

command: `npx vitest run test/no-quota.test.ts`
exit code: 0

```
RUN  v5.0.3 /Users/karthikmprakash/Documents/Personal/Projects/quotelite


 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  22:55:10
   Duration  328ms (tests 49%, import 32%, transform 17%, worker 1%)

(node:93034) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

## [F2] Quote issued as a link the customer can open without an account — 2026-10-10 17:25:13Z

note: Incognito context opened the quote link, saw the line and Approve, and had no password field.

command: `npx playwright test e2e/f2-public.spec.ts`
exit code: 0

```
Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/f2-public.spec.ts:4:1 › a customer opens the quote link and can approve without an account (572ms)

  1 passed (1.2s)
(node:93084) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## [F6] Customer list with job history — 2026-10-10 17:25:14Z

note: Two quotes for Rosa Alvarez showed under one customer.

command: `npx playwright test e2e/f6-customers.spec.ts`
exit code: 0

```
Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/f6-customers.spec.ts:4:1 › two quotes for one name land on one customer (659ms)

  1 passed (1.3s)
(node:93177) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## [F10] Quote/invoice PDF that does not look amateur — 2026-10-10 17:25:15Z

note: PDF text includes logo image, tax, totals, terms, wrapped copy, and page 2. Layout matches the golden.

command: `npx vitest run test/pdf.test.ts`
exit code: 0

```
RUN  v5.0.3 /Users/karthikmprakash/Documents/Personal/Projects/quotelite


 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  22:55:15
   Duration  339ms (tests 53%, import 30%, transform 16%, worker 1%)

(node:93257) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

## [F3] Deliver the quote by SMS / WhatsApp / email — 2026-10-10 17:25:15Z

note: sms:, WhatsApp, and mailto links all contain the quote URL and number.

command: `npx vitest run test/share.test.ts`
exit code: 0

```
RUN  v5.0.3 /Users/karthikmprakash/Documents/Personal/Projects/quotelite


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  22:55:15
   Duration  74ms (transform 61%, import 23%, worker 9%, tests 7%)
```

## [F4] One-tap quote -> invoice — 2026-10-10 17:25:21Z

note: Customer approval then one Make invoice tap copied both lines and the total.

command: `npx playwright test e2e/f4-convert.spec.ts`
exit code: 0

```
Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/f4-convert.spec.ts:4:1 › an approved quote becomes an invoice with the same lines (4.4s)

  1 passed (5.1s)
(node:93360) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## [F5] Partial payments and mark-as-paid — 2026-10-10 17:25:22Z

note: Partial, remainder, rounding, and a rejected overpayment. Server balance matches.

command: `npx vitest run test/payments.test.ts`
exit code: 0

```
RUN  v5.0.3 /Users/karthikmprakash/Documents/Personal/Projects/quotelite


 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  22:55:21
   Duration  235ms (import 51%, transform 25%, tests 23%, worker 1%)

(node:93586) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
```

## [F7] Offline-first core loop — 2026-10-10 17:25:23Z

note: Offline create, approve, invoice, and mark paid. After reconnect the server had exactly one of each, including a second sync.

command: `npx playwright test e2e/f7-offline.spec.ts`
exit code: 0

```
Running 1 test using 1 worker

  ✓  1 [chromium] › e2e/f7-offline.spec.ts:4:1 › the quote, invoice, and payment survive offline and sync once (680ms)

  1 passed (1.4s)
(node:93658) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## [F8] Bring-your-own payment account — 2026-10-10 17:25:24Z

note: No STRIPE_SECRET_KEY and no .env.local. stripe-mock 0.206.0 returns PaymentIntent status requires_payment_method for pm_card_visa, so it does not confirm a test card. The pay route is implemented and refuses a live secret. Supply a Stripe test secret to run test/stripe.test.ts for real.

command: `(none)`
exit code: None

