# Build state

Machine-readable truth is `replica/features.json` (run `python3 tools/status.py`).
This file is the human/agent narrative that survives context compaction.

## Current phase
recon (not started)

## Phases
- [ ] recon        -> replica/recon-map.md
- [ ] architect    -> replica/architecture.md
- [ ] design       -> replica/design/tokens.json + tokens.css
- [ ] build        -> screens from the recon map
- [ ] backend      -> auth, db, payments, integrations
- [ ] test         -> e2e specs green
- [ ] diff         -> parity score recorded
- [ ] entrepreneur -> what users of the reference app hate, fixed in ours
- [ ] brand        -> name + identity (no copied assets)
- [ ] launch       -> landing page + store listing
- (deploy: only once the human supplies a domain)

## Last session summary
(none yet)

## Next 3 concrete actions
1. Run replica-recon against the reference app per replica/features.json -> reference.recon_from
2. Write replica/recon-map.md and replica/architecture.md
3. Start F1 via tools/record.py
