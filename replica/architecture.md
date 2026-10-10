# Architecture: QuoteLite (a rebuild of Jobber's quote-to-paid loop)

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Vite + React + TypeScript, installable PWA | One phone-first codebase. A service worker can cache the shell, which a server-rendered app fights. |
| styling | CSS variables from `replica/design/tokens.css` | Tokens stay the only colours. No second palette in components. |
| database | SQLite via Node's built-in `node:sqlite` | Tests and the app run with no hosted database account. Schema is plain SQL with text ids and UTC timestamps so a later move to Postgres is a port, not a rewrite. |
| local data | Dexie (IndexedDB) is the copy the screen reads | Writes land on the phone first. The server is the sync target, not the thing the driveway waits on. |
| API | Hono on Node | Small, one process, serves the built PWA and the API together. |
| auth | Email + password, scrypt, httpOnly session cookie | No auth vendor account required. Helpers are rows on the same crew. |
| payments | Stripe test mode on the crew's own secret key | Platform fee is never set. Live keys are refused. |
| email / SMS | `sms:`, `https://wa.me/`, `mailto:` links | Sending real messages needs a provider key we will not invent. The share body is the product for F3. |
| jobs | None running in the background | 3- and 7-day chases are computed when the unpaid list opens. |
| files | Quote photos and the logo as base64 in SQLite and IndexedDB | Three small images. No object-storage account. |
| hosting | Not deployed | `replica-deploy` waits for a domain. |

One process, one database file, no microservices.

## Schema

Tables: 12. Access rules: every crew-owned query in the data layer takes `crew_id` from the session. There is no row-level security because this is SQLite, not Supabase. A second crew's id never matches. Public quote and invoice routes are the exception: they look up an unguessable token and return that one document.

SQL: `server/schema.sql` (same statements as `replica/schema.sql`).

Money is integer cents. Quantities are integer thousandths (`qty_milli` 1500 = 1.5). Tax is basis points (825 = 8.25%). Times are ISO-8601 UTC text.

## API

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET /api/health | process up | anyone | — | `{ok}` | ops |
| POST /api/auth/signup | create crew, owner, session | anyone | name, business, email, password, plan label | user | F07 |
| POST /api/auth/login | session cookie | anyone | email, password | user | F07 |
| POST /api/auth/logout | clear cookie | session | — | ok | — |
| GET /api/auth/me | current user | session | — | user | boot |
| POST /api/team | add a helper, no cap | owner | name, email, password | user | F07 |
| GET /api/team | list people | session | — | users | F07 |
| POST /api/sync | apply ops once | session | `{ops}` | `{acked, rejected}` | F06 |
| GET /api/sync | full crew snapshot | session | — | customers, quotes, invoices, payments, events | F06 |
| PUT /api/settings/business | name, tax, terms, logo | session | business fields | business | settings |
| PUT /api/settings/stripe | store a test key | owner | `sk_test_`, `pk_test_` | `{payments:'test'}` | F04 |
| GET /api/settings | public-safe settings | session | — | business, payments flag, no secret | settings |
| GET /api/export.csv | invoice CSV | session | — | csv | tax time |
| GET /api/quotes/:id/pdf | quote PDF | session | — | application/pdf | F10 |
| GET /api/invoices/:id/pdf | invoice PDF | session | — | application/pdf | F10 |
| GET /api/public/quotes/:token | customer view | anyone with token | — | document, no other customers | F02 |
| POST /api/public/quotes/:token/approve | set approved | anyone with token | — | status | F02 |
| GET /api/public/quotes/:token/pdf | customer PDF | anyone with token | — | pdf | F10 |
| GET /api/public/invoices/:token | customer invoice | anyone with token | — | document + payments flag | F04 |
| POST /api/public/invoices/:token/pay | confirm test card, fee 0 | anyone with token | request id | invoice paid | F04 |
| GET /api/public/invoices/:token/pdf | customer PDF | anyone with token | — | pdf | F10 |

Webhooks in: none. Card confirmation is a synchronous test-mode PaymentIntent, so we do not depend on a public webhook URL. Webhooks out: none.
Jobs: unpaid age is derived from `created_at` when the list is read. No cron.

## The parts that bite

- Time zones: timestamps stored in UTC. Visit date is a calendar date (`YYYY-MM-DD`) with no time, so daylight saving does not move it.
- Idempotency: `sync_ops.id` is the client op id, inserted in the same transaction as the write. A replay acks and does not insert again. Card pay uses the payment id as the Stripe idempotency key.
- Races: two phones can mint the same invoice number offline. The server unique index `(crew_id, number)` rejects the second. Known weakness for a single-phone crew it does not come up. See the final report.
- Rate limits: none in v1.
- File size: photos resized on the phone to a max edge of 1280px before they are stored. Server drops a photo over about 2MB rather than failing the whole quote.
- Search: customer name match is normalized (trim, lowercase, collapse spaces) on the phone.
- Realtime: none. Sync on write, on reconnect, and every few seconds while online.
- Offline: IndexedDB is the screen's database. The outbox holds writes until the server acks them. A failed fetch does not clear the outbox.
- Email deliverability: we do not send mail.
- Multi-tenancy: `crew_id` on every owned row, checked in the query.
- GDPR deletion: not built. Weakness.

## Build order

1. Vertical slice: S02, S04, S05, S06, S07, S08. Tables crews, users, customers, quotes, quote_lines, invoices, invoice_lines, payments, sync_ops. Routes signup, sync, public quote, public approve.
2. Must-haves: photos, saved items, share links, partial pay, offline service worker, Stripe test pay, PDF, no quotas.
3. Should-haves: unpaid chase list, team, CSV, visit date, settings.
4. Fixes from later research: keep the flat price honest, keep offline as the headline, do not add a dispatch board.

## Risks

1. Offline service worker plus a reload is the flakiest test. The loop has to pass with `context.setOffline(true)`.
2. Stripe test mode needs a real `sk_test_` key or Stripe's mock server. A fake payment in process memory does not count.
3. SQLite in Node is still marked experimental on this runtime. It works; the warning is suppressed at startup.
