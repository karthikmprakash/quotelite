# Recon map: Jobber (web + mobile), slice rebuilt as QuoteLite

Scope: the quote → customer approval → invoice → paid loop for a 1–3 person trade crew. Not the dispatch board, pricebook, memberships, or marketing suite.
For: owner-operators (handyman, plumber, electrician, landscaper, cleaner, painter) who send a quote from a phone in a driveway.
Date: 2026-10-10
Platform observed: Jobber's public help centre and pricing (web app + client hub). Secondary: Housecall Pro, Markate, Kickserv, Decker public pricing and marketing. No trial login was available, so nothing behind a login was opened.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Jobber help: Quote Basics | https://help.getjobber.com/en/articles/quote-basics/ | Updated 2026-07-27. Create, line items, tax, discount, client message, disclaimer, PDF, statuses, send by email or text. |
| 2 | Jobber help: Quote Approvals | https://help.getjobber.com/en/articles/quote-approvals/ | Client hub link, approve, request changes, deposit. Link expires 24h then last-4 phone gate. |
| 3 | Jobber help: Converting a Quote to a Job | https://help.getjobber.com/en/articles/converting-a-quote-to-a-job/ | Approved quote → job copies line items. Job is the scheduling object. Invoice comes after. |
| 4 | Jobber help: Client Hub guide | https://help.getjobber.com/en/articles/a-guide-for-your-clients-how-to-navigate-client-hub/ | Customer opens a link from email or text. No account of their own to start. View quote, approve, view invoice, pay. |
| 5 | Jobber help: Progress invoicing | https://getjobber.zendesk.com/hc/en-us/articles/26297232277527-Progress-Invoicing | Deposits and payment schedules on a quote. Out of our v1 except partial payments on the invoice. |
| 6 | Jobber pricing (as reported from the live page, Aug–Sep 2026) | https://www.getjobber.com/pricing | Core $49/mo (1 user), Connect $139, Grow $199, Plus from $499. Extra users $29/mo. Annual prepaid lower. Photos-on-quotes and advanced quote options are described as Grow. |
| 7 | Housecall Pro pricing | https://www.housecallpro.com/pricing/ | Basic from $59/mo annual (1 user), Essentials, MAX. Extra users priced. Quotes, invoices, payments on the entry plan; dispatch and add-ons stacked above. |
| 8 | Markate pricing | https://www.markate.com/pricing | Owner-operator about $49.95/mo plus $5 per additional employee. Estimates and invoices. |
| 9 | Kickserv pricing (reported 2026-10-08 from kickserv.com/pricing) | https://www.kickserv.com/pricing | Start / Run / Scale seat caps, from about $75/mo monthly. |
| 10 | Decker marketing | https://getdecker.app/jobber-alternative/ | Flat founding price $19/mo. Quotes, invoices, Stripe, WhatsApp. Occupies the same price point. Not offline-first. |
| 11 | PRD competitor table | PRD.md | ServiceTitan, Workiz, FieldPulse, Yardbook, QuoteIQ. Used for what we will not build. |

Reading was limited to public pages. No app bundles, no private APIs, no accounts that are not ours.

## Core loop

A crew member builds a short quote on the phone, the customer opens a link and approves it without creating an account, the crew turns that quote into an invoice without retyping, and the balance moves to paid as money comes in.

Jobber inserts a **job** (schedule, assignment) between quote and invoice. The PRD says dispatch is out of scope and the target user texts helpers the address. QuoteLite goes quote → invoice and keeps an optional visit date on the invoice. That is a deliberate cut, recorded in `replica/DECISIONS.md`.

## What the reference gates behind price

From the public pricing writeups and Quote Basics (Grow is called out for line-item images and advanced quote options):

- Entry tier still includes quotes, invoices, and online payment.
- Automated follow-up, reminders, and accounting sync sit on the next tier up.
- Richer quote presentation (images, optional lines) is described as a higher tier.
- Adding a second person costs another seat ($29 on Jobber, about $5 on Markate, a tier jump on Housecall Pro Basic).

The wedge is not "cheaper quotes." It is: the whole loop on one flat price, unlimited people, and the loop still works with no signal. Decker already sells the flat price, so price alone is not the product.

## Screens

These IDs are QuoteLite's screens, shaped by the flows above. Layout is ours. Reference screenshots were not saved: the product UI is behind login, and marketing images are not the same state.

| ID | screen | route / how to reach | purpose | key components | states seen / to build |
| --- | --- | --- | --- | --- | --- |
| S01 | Marketing home | `/` | Say what it does and the flat price | price cards, primary link | filled |
| S02 | Sign up | `/start` | Open a crew in one screen | form, plan label (not a gate) | empty, error, submitting |
| S03 | Log in | `/login` | Return to an existing crew | form | empty, error |
| S04 | Today | `/app` | Unpaid total, new quote, chases | primary button, list, sync status | empty, filled, offline |
| S05 | Quote editor | `/app/quotes/new`, `/app/quotes/:id/edit` | Build the quote with one thumb | customer field, line editor, tax, notes, photos, saved-item chips | empty, filled, validation error, 3-photo cap |
| S06 | Quote detail | `/app/quotes/:id` | Review, share, approve, invoice | totals, share links, activity, PDF | draft, sent, approved, converted, offline |
| S07 | Public quote | `/v/:token` | Customer reads and approves, no account | document, Approve | loading, ready, approved, missing |
| S08 | Invoice detail | `/app/invoices/:id` | Balance, partial payment, mark paid | money summary, payment form | open, partial, paid, overpay error |
| S09 | Public invoice | `/i/:token` | Customer pays the balance | document, Pay | open, paid, payments off |
| S10 | Customers | `/app/customers` | Find a person | search, list | empty, filled |
| S11 | Customer | `/app/customers/:id` | Quotes, invoices, payments | history lists | filled, empty history |
| S12 | Unpaid | `/app/unpaid` | Who owes money, 3- and 7-day chase | list, text link | empty, due, overdue |
| S13 | Settings | `/app/settings` | Business, logo, tax, terms, team, Stripe test key, CSV | forms | disconnected, connected, forbidden live key |
| S14 | Primitives | `/design` | Buttons, fields, banners | design system | all states |

## Flows

```
F01 Driveway quote
    S04 Today -> S05 Quote editor -> S06 Quote detail -> share
    happy path taps: New quote, customer, one line, Save, Text. Target under 60 seconds.
    edge: no signal, duplicate customer name, 4th photo, empty line, very long description, reload mid-draft after save

F02 Customer approves
    message link -> S07 Public quote -> Approve
    happy path taps: 1 (Approve)
    edge: already approved, bad token, incognito with no session, second tap

F03 Quote becomes an invoice
    S06 (approved) -> Make invoice -> S08
    happy path taps: 1
    edge: convert twice (same invoice), convert before approval, line items must match with no re-entry

F04 Get paid
    S08 record a partial amount -> balance updates -> Mark paid
    or S09 Pay with test card -> status paid, fee 0
    edge: overpayment, zero amount, declined card, double submit

F05 Who owes me
    S04 or S12 Unpaid -> open invoice or text a reminder
    edge: nothing unpaid, invoice younger than 3 days, paid invoices absent

F06 Offline day
    S04..S08 with the radio off -> S04 when the radio returns
    edge: reload while offline, replay the same sync, two crews never see each other

F07 Add a helper
    S13 add a person -> they log in on S03 and see the same crew
    edge: no cap at 2, 3, or 5 people
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, hover, focus-visible, disabled, loading | all |
| Text field | text, tel, email, password, number, date | default, focus, error, disabled | S02 S03 S05 S08 S13 |
| Textarea | notes, terms | default, focus | S05 S13 |
| Chip | saved line item | default, pressed | S05 |
| Card | document, list row, price | default | S01 S04 S06 S07 S08 |
| Banner | error, offline, success | visible | all app screens |
| Sync status | synced, waiting, on this phone | live | app shell |
| Line editor | one row | filled, invalid | S05 |
| Photo tray | up to 3 | empty, filled, capped | S05 S06 S07 |
| Totals | subtotal, tax, total, paid, balance | open, partial, paid | S06 S07 S08 S09 |
| Share links | sms, whatsapp, mailto | href only, no send-from-server | S06 S08 S12 |
| Activity list | status events | empty, filled | S06 |
| Bottom nav / sidebar | today, quotes via home, unpaid, customers, settings | current | app shell |
| Empty state | short sentence + one action | empty | S04 S10 S12 |
| Skeleton | list | loading | S04 S10 |

## Inferred data model

```
Crew        id, name, phone, email, plan label (solo|crew, not a permission),
            tax rate, terms, logo, stripe test keys
            evidence: pricing pages (plan), Quote Basics (tax, disclaimer, PDF logo/settings)
            confidence: high

User        id, crew_id, name, email, password hash, role (owner|helper)
            evidence: Jobber "salesperson" and per-user pricing; our cut is unlimited users
            confidence: high

Customer    id, crew_id, name, phone, email, notes
            evidence: Quote Basics "select a client"; client profile quotes tab
            confidence: high

SavedItem   id, crew_id, description, unit price
            evidence: Quote Basics line items from a products list; we keep a short reuse list, not a pricebook
            confidence: high

Quote       id, crew_id, customer_id, number, status (draft|sent|approved|converted|archived),
            tax, notes, terms, public token, money totals, timestamps
            evidence: Quote Basics statuses and totals
            confidence: high

QuoteLine   description, quantity, unit price, line total, position
            evidence: Quote Basics required name/qty/price
            confidence: high

QuotePhoto  up to 3 images on the quote (not a Grow upsell)
            evidence: F1 acceptance; Jobber line-item images are a higher tier
            confidence: high for "photos exist", medium for "on the quote vs on the line" — we attach them to the quote

Invoice     id, quote_id, customer_id, number, status (open|partial|paid|void),
            same lines and tax, public token, optional visit date
            evidence: client hub invoices; PRD one-tap convert. Visit date replaces the job scheduler.
            confidence: high

Payment     amount, method (cash|card|transfer|other), fee always 0, stripe payment intent id
            evidence: client hub pay; PRD partial payments and bring-your-own Stripe
            confidence: high

StatusEvent entity, from, to, at
            evidence: Quote Basics history feed
            confidence: high

SyncOp      client id, entity, payload, applied once
            evidence: our offline requirement, not a Jobber feature
            confidence: high (design, not observed)
```

Relationships: Crew 1-n User, Crew 1-n Customer, Customer 1-n Quote, Quote 1-n QuoteLine, Quote 0-3 QuotePhoto, Quote 0-1 Invoice, Invoice 1-n InvoiceLine, Invoice 1-n Payment.

No Job entity. No Request entity. No pricebook catalogue.

## Feature matrix

See `replica/features.csv`. Must-haves are the ten acceptance features. Skip rows are the PRD out-of-scope list.

## Out of scope (cannot or should not be cloned)

- Jobber's client list, review graph, and marketplace apps. Those are their network.
- Their logo, colour, copy, screenshots, fonts, and illustration.
- Wisetack consumer financing (a partner deal).
- Dispatch board, GPS, route optimisation.
- A thousands-row pricebook, memberships, marketing automation, payroll, job costing.
- QuickBooks/Xero sync (CSV only).
- Native App Store binary (PWA).
- Their 24-hour link expiry plus last-4-digits client-hub login. We use an unguessable link and no customer account. The phone-digit gate is a second login; we will not copy it.

## Size

Screens 14, flows 7, entities 11. Hard parts: offline sync with exactly-once writes, Stripe test-mode charges on the crew's own account, PDF layout. Size: M.
