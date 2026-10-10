# Bugs

No S1 or S2 bug was reproduced in `npm test` on 2026-10-10.

## To check

- Card pay with a real `sk_test_` key. The route is written. stripe-mock does not confirm `pm_card_visa` (status stays `requires_payment_method`). This is F8, not a guessed failure.
- Two phones offline at once can mint the same `INV-` number. The server rejects the second. Not exercised with two browsers.
