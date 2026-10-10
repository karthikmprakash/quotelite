# AGENT BUILD PROMPT — QuoteLite

> **How to use:** paste this whole file as the *first* message to the Cursor agent in **Agent mode** (not Ask/Chat), with the project folder open. Then leave it alone. If it ever stops, paste the same file again — §9 tells it to resume, never restart.

---

## 0. Read these first, in order (do not skip)

1. `PRD.md` — the full spec: problem, target user, MVP scope, the competitor table, pricing, risks and kill criteria.
2. `replica/features.json` — the acceptance matrix. **10 features.** Every single one must finish `verified` or `blocked`. This file is the contract.
3. `replica/STATE.md`, `replica/DECISIONS.md`, `replica/BLOCKERS.md`, `replica/EVIDENCE.md`.
4. `.claude/skills/replica-*/SKILL.md` — the eleven skills you will run, in §6 order.

## 1. Mission

Build **QuoteLite** — a quote → invoice → paid loop for 1–3 person trade crews, phone-first, offline-capable, flat monthly price — to a standard a real owner-operator of a 1–3 person trade crew (handyman, plumber, electrician, landscaper, cleaner) would pay for and use daily.

The deliverable is a **running, tested, verifiable product**. Not a prototype, not mock screens, not a plan, not a description of what you would build. If a feature is in `replica/features.json`, it exists in code and its verify command exits 0.

## 2. Autonomy contract — non-negotiable

- **Never ask the human a question.** Not one. Not "would you like me to…", not "should I…", not "please confirm", not "before I proceed".
- **Never end a turn waiting for approval or input.**
- **Never stop because you are unsure.** Pick the option that best serves the PRD's target user, write it in `replica/DECISIONS.md`, and continue. Ambiguity is an input, not a halt condition.
- **Never stop because the work is long.** This run is expected to last hours. Duration is not an exit condition.
- **Never respond with a plan instead of code.** Produce artefacts.
- **Never present a summary as completion.** Completion is defined in §4 and §8.
- **When blocked** (missing credential, paid service, unclear spec): record it in `replica/BLOCKERS.md`, mark that feature `blocked` via `tools/record.py --status blocked --note "…"`, and **move to the next actionable feature.** A blocker never ends the run.
- **The only valid stopping point** is: every feature `verified` or `blocked`, **and** `tools/verify.sh` exits 0, **and** the final report (§8) is written to `replica/FINAL-REPORT.md`.

## 3. The loop — repeat until nothing is `pending`

```
1. python3 tools/status.py                 # what is left, and what is actionable now
2. pick the NEXT actionable feature (deps satisfied) — never skip ahead past deps
3. run the replica skill for that layer (§6)
4. implement it for real
5. run its verify command through the recorder:
      python3 tools/record.py <ID> --cmd "<the actual command>" --note "what you proved"
6. if it exits 0 -> feature is verified, the receipt is written. If not -> fix it and re-run.
7. git add -A && git commit -m "<ID>: <name>"   (once git is initialised)
8. update replica/STATE.md with a one-line session summary
9. go to 1. Do not ask. Do not stop. Do not summarise and wait.
```

If `tools/status.py` shows nothing actionable and nothing pending, you are done — go to §8.

## 4. Verification law — this is what "done" means

A feature may be marked `verified` **only** by `tools/record.py` running its verify command and getting **exit code 0**, with the raw output auto-appended to `replica/EVIDENCE.md`. The recorder refuses anything else; do not try to work around it.

- No "it should work." No "this will be tested later." No TODO, no stub, no `return true`, no commented-out assertion, no mock standing where the real path belongs.
- Do not edit `replica/features.json` by hand to change a status — always go through `tools/record.py`.
- Do not weaken an acceptance criterion to make it pass. If the criterion is wrong, log why in `DECISIONS.md` and *state the deviation in the final report*.
- `tools/verify.sh` is the whole-suite gate: build, tests, typecheck, lint, design contrast, and a committed-secrets scan. It must exit 0 before you call any phase complete.
- "Hours-long runs" means the **test suite** runs unattended, not that you skip tests. Every feature needs executed proof.

## 5. Reference app and clean-room rules

**Reference to recon: Jobber.** Secondary references: Housecall Pro, Markate, Kickserv, Decker (the $19/mo flat entrant), QuoteIQ.

Recon them from: public marketing and pricing pages, public help centre and docs, App Store / Play Store listings, and your own trial account if one exists.

**Observe and rebuild FEATURES and FLOWS only.** This is clean-room.

- **Never** copy code, logo, brand, copy, images, icons, fonts, illustrations, audio or content from any product.
- **Never** scrape behind a login, and never use anyone else's account or credentials.
- If a flow cannot be observed publicly, design your own and log the decision.
- Rebuild the *job* it does, in your own design system, with your own assets and your own words.
- `Pay particular attention to the recon of **per-user pricing walls and the tier-jump upsell** — the PRD's entire wedge is that Jobber's Connect/Grow tiers and $29/user fee are what churn customers out.`

## 6. Skill order

Run these in order; each writes artefacts under `replica/`.

| # | skill | output |
|---|-------|--------|
| 1 | `.claude/skills/replica-recon/SKILL.md` | `replica/recon-map.md` — screens, flows, components, data model |
| 2 | `replica-architect` | `replica/architecture.md` — stack, schema, API |
| 3 | `replica-design` | `replica/design/tokens.json`, `tokens.css`, `components.md` |
| 4 | `replica-build` | screens, built from the recon map |
| 5 | `replica-backend` | auth, database, payments, integrations |
| 6 | `replica-test` | e2e specs — these are the verify commands in features.json |
| 7 | `replica-diff` | parity score vs the reference, recorded |
| 8 | `replica-entrepreneur` | what the reference app's users hate, fixed in ours |
| 9 | `replica-brand` | name, identity, own assets — nothing copied |
| 10 | `replica-launch` | landing page + store listing |

Do **not** run `replica-deploy`. Deployment waits for the human to supply a domain.

Python helpers are stdlib-only: `python3 .claude/skills/replica-design/contrast.py replica/design/tokens.json`.

## 7. Guardrails

- **Never type, generate or store passwords, card numbers, or live API keys.** Write `.env.example` with variable names and no values. The human fills `.env.local` (already gitignored).
- Use **test mode** for every payment provider. Never send real emails, SMS or charges to real people.
- Keep all generated artefacts under `replica/`.
- `**Offline-first is the differentiator, not a nice-to-have.** F7 must genuinely work with the network disabled. Never fake it with a cache that silently loses writes.`
- Prefer boring, well-supported choices over novel ones. You are optimising for a product that survives, not a demo that impresses.

## 8. Final report — write `replica/FINAL-REPORT.md`

Only after every feature is resolved and `tools/verify.sh` exits 0. Include:

1. **Status per feature** — table of ID, name, status, and the verify command that proved it.
2. **Evidence index** — pointer to `replica/EVIDENCE.md`.
3. **What is blocked and why** — from `BLOCKERS.md`, with exactly what the human must supply.
4. **Deviations from the PRD** — anything you changed or could not hit, stated plainly.
5. **How to run it** — install, migrate, seed, test, start. Real commands.
6. **Known weaknesses** — be specific and unsentimental. A report claiming everything is perfect is a failed report.
7. **What you would build next** — the top 3 items, in order.

## 9. Resume protocol (context compaction, crash, or a new session)

Re-read, in order: `replica/features.json` → `replica/STATE.md` → `replica/DECISIONS.md` → `replica/BLOCKERS.md` → `replica/EVIDENCE.md`. Then run `python3 tools/status.py`. Then **continue the loop from the first actionable `pending` feature.**

**Never restart from scratch. Never re-scaffold. Never delete work because you lost the thread.** Verified features stay verified — the receipts in `EVIDENCE.md` are the memory that survives you.

## 10. Anti-patterns that will be treated as failure

- Ending a turn with a question, a plan, or a status update instead of continuing the loop.
- Marking a feature verified without an exit-0 receipt in `EVIDENCE.md`.
- Stubbing, mocking or faking a feature to make its check pass.
- Doing phase 1 and stopping "to check in".
- Editing `features.json` to lower the bar.
- Copying anything protected from the reference app.
- Adding a feature to `features.json` that the PRD explicitly puts out of scope — the **out-of-scope list in the PRD is the strategy**. Respect it; those omissions are the product.
