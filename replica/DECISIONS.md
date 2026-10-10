# Decisions log

Every choice made without asking the human goes here: decision, alternatives, why.
Ambiguity is not a reason to stop; it is a reason to write an entry and continue.

| # | date | decision | alternatives rejected | why |
|---|------|----------|----------------------|-----|
| 1 | 2026-10-10 | Scope is Jobber's quote → approve → invoice → paid loop, for a 1–3 person crew. | Cloning dispatch, pricebook, memberships, or the whole product. | PRD out-of-scope list is the strategy. |
| 2 | 2026-10-10 | No job record between quote and invoice. Optional visit date lives on the invoice. | A job entity plus a schedule board. | The target user texts the address. A job object is how this becomes a dispatch tool. |
| 3 | 2026-10-10 | Vite + React PWA, Dexie on the phone, Hono + SQLite on one Node process. | Next.js and Supabase. | Offline is the wedge. Server-rendered routes fail a reload with no signal. No hosted database credential exists, and the suite has to run unattended. |
| 4 | 2026-10-10 | Screen reads and writes IndexedDB first. An outbox syncs with an op id the server stores once. | Cache-then-network that drops writes, or a server round-trip on every save. | F7 forbids a cache that silently loses writes. |
| 5 | 2026-10-10 | Money is integer cents. Quantity is thousandths. Tax is basis points. Half-up rounding via `Math.round` on positive amounts. | Floating dollar math. | Partial payments and tax have to match to the cent. |
| 6 | 2026-10-10 | Share actions are `sms:`, `https://wa.me/`, and `mailto:` links. Nothing is sent by a gateway. | Twilio, WhatsApp Business API, Resend. | No provider keys, and the acceptance test is the prefilled message. |
| 7 | 2026-10-10 | Customer card pay uses the crew's own Stripe test secret. `application_fee_amount` is never sent. `payments.fee_cents` has a SQL check that it stays 0. Live keys are refused. | Stripe Connect with an application fee, or a platform charge. | PRD: no transaction fee, bring your own merchant account. |
| 8 | 2026-10-10 | Solo ($19) and Crew ($29) are labels only. Both can add people and quotes with no cap. Subscription collection for QuoteLite itself is not built. | A gate that turns features off until a plan is paid. | F9 forbids seat and quote quotas. Charging the crew needs a platform Stripe account we do not have. |
| 9 | 2026-10-10 | 3-day and 7-day chases show up on the unpaid list as text links. No background SMS. | A cron that sends messages. | Same missing provider key. The list still tells the owner who to chase. |
| 10 | 2026-10-10 | Customer match is the normalized name (trim, lowercase, collapsed spaces) inside the crew. | Always creating a new customer row. | F6: two quotes for one person, one record. |
| 11 | 2026-10-10 | Public links are unguessable tokens with no customer login and no phone-digit re-entry. | Copying the reference 24-hour link plus last-four-digits gate. | That gate is a second login. The acceptance test is a clean session with an Approve control and no auth wall. |
| 12 | 2026-10-10 | Palette is warm paper and copper (`#8C2F0E` on `#F3F0E8`). Type is Source Sans 3 then the system stack, no font file downloaded. | The reference green, a CDN font. | Trade dress stays theirs. A font request must not be required for offline first paint. |
| 13 | 2026-10-10 | Styling is the token CSS variables, not Tailwind utilities. | Adding Tailwind. | The tokens are the source of truth and the contrast gate reads them. A second styling system is extra surface to drift. |
| 14 | 2026-10-10 | Product name stays QuoteLite, the name in the PRD. | Renaming in the brand phase. | The harness, spec, and acceptance matrix already use it. It is not the reference product's name. Trademark checks are listed as still to run, not as cleared. |
| 15 | 2026-10-10 | Photos attach to the quote, max 3, resized on the phone. | A line-item image gallery gated to a higher plan, or a pricebook. | F1 asks for up to 3 photos. The reference treats richer images as an upsell. |
| 16 | 2026-10-10 | Card payment is online-only. Offline "mark paid" records cash for the remaining balance. | Pretending a card charge works with the radio off. | Stripe cannot authorize offline. F7 says mark paid, which cash does. |
| 17 | 2026-10-10 | Invoice numbers are `INV-1001` upward per phone. The server rejects a duplicate number. | A central sequence that the phone must call before saving. | A central sequence breaks offline. Collision across two phones is a known weakness. |
