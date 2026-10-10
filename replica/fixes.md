# Fixes from public reviews

Source: 144 recent and most-helpful App Store reviews of Jobber Field Service (id 1014146758), pulled 2026-10-10 from Apple's customer-reviews RSS. One Hacker News search was run; those rows did not survive the theme tool's source count, so they are not used as evidence. Full sheet: `replica/reviews.csv`. Themes: `replica/feedback.md`.

These are research notes. None of the sentences below are for the landing page.

## What we changed because of it

1. **Price.** "This is too expensive and the app doesn’t run well." The product has two labels, $19 and $29, and no code path that counts people or quotes.
2. **Whose card account.** "never EVER use a platform that does not allow you to bring your own payment processor." The pay route uses the crew's own Stripe test secret and refuses a platform fee. It is not verified until a test key exists. See F8 in `BLOCKERS.md`.
3. **Offline.** "No offline cacheing of any kind??" and a request to clock in with no signal and sync later. We did the quote, invoice, and mark-paid loop that way. We did not add a time clock. That is a different product.

## What we will not build from these reviews

- Progress invoicing beyond a partial payment on one invoice. A reviewer asked for it. The PRD leaves deposits and schedules out.
- A dispatch board or GPS because a review likes the schedule. The out-of-scope list stands.
- Their support org, their crash list, or their QuickBooks sync. CSV export is the accounting edge we ship.

## Position

Sell the driveway loop that still works with no signal, at a flat monthly price, on the crew's own card account. Do not sell "cheaper dispatch software."
