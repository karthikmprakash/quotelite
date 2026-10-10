## Parity: 90.6 / 100

features 90.6  (34 counted, must-haves 20 of 22 done)

Not shippable yet: 2 must-have features are not done.

## By area, weakest first
- payments                      50.0  (2 features)
- quote                         86.7  (13 features)
- invoice                       96.3  (11 features)
- customers                    100.0  (2 features)
- offline                      100.0  (2 features)
- pricing                      100.0  (1 features)
- pdf                          100.0  (1 features)
- team                         100.0  (1 features)
- settings                     100.0  (1 features)

## Missing, in build order
- [must] payments: Connect the crew's own Stripe test account, partial  (F8 code is in; charge not run without a test secret)
- [must] payments: Pay an invoice with a test card and add no platform fee, partial  (F8 blocked on a Stripe test key)
- [could] invoice: Automatic SMS from a gateway, no  (needs a provider key)
- [could] quote: Customer requests changes on the link, no  (not in v1)
- [could] quote: Deposit due at approval, no  (not in v1)
- [could] quote: Discount on a quote, no  (not in v1)
- [could] quote: Quote title only the crew sees, no  (not in v1)

## Left out on purpose (not scored)
- Dispatch board: PRD out of scope
- GPS tracking: PRD out of scope
- Route optimisation: PRD out of scope
- Pricebook with thousands of items: PRD out of scope
- Memberships and recurring plans: PRD out of scope
- Marketing automation: PRD out of scope
- Payroll: PRD out of scope
- Job costing: PRD out of scope
- Native iOS app: PWA on purpose
- Consumer financing partner: their partner deal not ours

## Behaviour

No same-state screenshots of the reference product were taken. The product UI is behind a login, and this run did not use an account. Layout diff was not scored. The feature score above is the parity number.

| flow | reference | this app | call |
| --- | --- | --- | --- |
| Quote to invoice | Quote becomes a job, then an invoice. | Approved quote becomes an invoice in one tap. Visit date is optional. | Keep. Dispatch is out of scope. |
| Customer opens the link | Link, then a phone-digit gate after a day. | Unguessable link, Approve, no account. | Keep. |
| Card payment | Their processor, with their fee structure. | The crew's own Stripe test account, fee forced to 0. Not executed here. | Blocked on a test key. |
| Offline | Reviewers describe no real offline cache. | Quote, invoice, and cash paid work with the radio off and sync once. | Keep. This is the wedge. |

