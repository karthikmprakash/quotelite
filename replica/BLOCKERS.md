# Blockers

A blocker never stops the run. Record it, mark the feature `blocked` via tools/record.py,
and move to the next actionable feature.

| feature | what is blocked | what was tried | what the human must supply |
|---------|-----------------|----------------|----------------------------|
| F8 | A confirmed test-card charge on the crew's own Stripe account, with no platform fee | The pay route, the fee check constraint, and the live-key refusal are in the repo and covered by `test/stripe.test.ts`. The environment has no `STRIPE_SECRET_KEY` and no `.env.local`. stripe-mock 0.206.0 was started locally; creating a PaymentIntent with `pm_card_visa` returned status `requires_payment_method`, so it does not prove a succeeded charge. | A Stripe test secret beginning with `sk_test_` and a matching `pk_test_` publishable key, in the environment as `STRIPE_SECRET_KEY` (not committed). Then run `npx vitest run test/stripe.test.ts`. |
