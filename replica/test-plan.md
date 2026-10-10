# Test plan

Automated cases live in `e2e/` and `test/`. `npm test` runs both.

| id | path | expect |
| --- | --- | --- |
| F01-H1 | Sign up, new quote, line, tax, notes, photo, save, reload | Fields and photo still there |
| F01-E1 | Save a line, open a second quote, tap the chip | Description and price fill in |
| F02-H1 | Open the customer link in a clean context | Quote visible, Approve present, no password field |
| F02-H2 | Tap Approve | "Approved" and the button is gone |
| F03-H1 | Text, WhatsApp, and email hrefs | Each body contains the quote URL |
| F04-H1 | Approve, then Make invoice | Both lines and the total match |
| F05-H1 | Partial, then the rest | Status goes partial, then paid |
| F05-N1 | Amount over the balance | Rejected, no extra row |
| F06-H1 | Two quotes, same customer name | One customer, two quotes |
| F07-H1 | Radio off: quote, approve, invoice, mark paid | On this phone, then exactly one of each after sync |
| F07-E1 | Sync again | Counts stay at one |
| F08-N1 | Live secret | Refused and not stored |
| F08-H1 | Test card charge | Blocked until a test secret exists |
| F09-H1 | Four helpers and six quotes | All save |
| F10-H1 | PDF of a long description | Full sentence, tax, terms, logo, golden layout |

Not automated: a real Stripe test card, a second phone minting the same invoice number, store review by a person.
