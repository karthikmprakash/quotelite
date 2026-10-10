# Build log

| screen | date | state | note |
| --- | --- | --- | --- |
| S01 Landing | 2026-10-10 | done | Flat prices, original sentences. |
| S02 Start | 2026-10-10 | done | Plan label does not gate. |
| S03 Log in | 2026-10-10 | done | |
| S04 Today | 2026-10-10 | done | Unpaid total and the new-quote button. |
| S05 Quote editor | 2026-10-10 | done | Lines, tax, notes, 3 photos, saved chips. |
| S06 Quote detail | 2026-10-10 | done | Share links, approve, invoice. |
| S07 Public quote | 2026-10-10 | done | No account. Approve. |
| S08 Invoice | 2026-10-10 | done | Partial, mark paid, overpay error. |
| S09 Public invoice | 2026-10-10 | partial | Pay button exists. Charge needs a test key. |
| S10 Customers | 2026-10-10 | done | |
| S11 Customer | 2026-10-10 | done | Quotes, invoices, payments. |
| S12 Unpaid | 2026-10-10 | done | 3- and 7-day text links. |
| S13 Settings | 2026-10-10 | done | Business, people, test keys, CSV. |
| S14 Primitives | 2026-10-10 | done | `/design`. |

Harder than it looked: a service worker that claims the page will abort a reload if `index.html` was cached as the wrong content type. The static server now sends `text/html` for it.
