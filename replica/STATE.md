# Build state

Machine-readable truth is `replica/features.json` (run `python3 tools/status.py`).
This file is the human/agent narrative that survives context compaction.

## Current phase
launch written. Deploy was not run.

## Phases
- [x] recon        -> replica/recon-map.md and replica/recon.md
- [x] architect    -> replica/architecture.md, server/schema.sql
- [x] design       -> replica/design/
- [x] build        -> the PWA screens
- [x] backend      -> SQLite, sessions, sync, PDF, Stripe test route
- [x] test         -> e2e and vitest. F8 charge not executed
- [x] diff         -> replica/parity.md 90.6
- [x] entrepreneur -> replica/feedback.md, replica/fixes.md
- [x] brand        -> replica/brand.md. Name stays QuoteLite
- [x] launch       -> landing is the app home. Listing in replica/launch/listing.json
- (deploy: only once the human supplies a domain)

## Last session summary
Nine features verified, F8 blocked on a Stripe test key. The quote, invoice, and cash-paid loop works offline and syncs once.

## Next 3 concrete actions
1. Put a Stripe test secret in the environment and re-run `test/stripe.test.ts`.
2. Do not deploy until that charge is verified and a domain exists.
3. Leave dispatch, pricebook, and memberships out.
