# PRD — "QuoteLite": field-service lite for 1–3 person crews

**Target price:** $19–29/mo flat, unlimited users
**Status:** researched hypothesis · **Evidence strength:** strongest of the three verticals
**One-line:** a quote → invoice → paid loop that works from a phone in a customer's driveway, with zero setup and no per-user pricing.

---

## 1. Problem & evidence

The complaint is not "we lack features". It is that the software is built for companies five times the size and priced per head.

- A crew that cancelled ServiceTitan: *"way too much software for a 3 person crew doing residential work. Half the features we never opened… the per tech pricing was insane for our size."* Their stated need: *"Estimates, invoices, payments, and customer info. Dispatching would be nice but not mandatory since I just text my guys where to go anyway. Don't need memberships, marketing automation, or a pricebook with 5000 items."*[29]
- A solo plumber, one year in: *"Currently I type up quotes in the Notes app on my phone and text them to customers, which I know looks unprofessional but it's fast. Looked into Jobber and ServiceTitan but honestly I don't need scheduling, dispatching, GPS tracking, or any of that. I just need to send a clean looking quote."*[86]
- A handyman on onboarding: *"an app and it was 40 minutes long just for the initial setup… I just need to send quotes, convert them to invoices, and collect payments and thats it. No CRM, no project…"*[87]
- The cost escalation is documented by an operator who left after *"paying over $700/month for Jobber"*.[89] Second-order pain: *"You sign up for one monthly rate, then realize you need 3+ third-party apps just to do the basics… paying more, clicking more, and double-entering everything."*[90]
- Landscaping version, quoted verbatim earlier: a 2-man crew with an uncle *"losing track of invoices"* who needs *"to send professional quotes from his phone while standing in the client's yard."*[33]

**Why this is structural, not temporary:** the industry's pricing model is per-user or per-tech, so the smallest operators subsidise enterprise features they never open. ServiceTitan quoted one 9-tech shop *"$3800 to migrate ESC and then $345/mo per tech for 2 years"*.[2]

---

## 2. Target user

| Attribute | Definition |
|---|---|
| Who | Owner-operator or owner + 1–3 helpers: handyman, plumber, electrician, landscaper, cleaner, pressure washer, painter, pest control |
| Revenue | $50k–$400k/yr, mostly residential |
| Today's stack | Phone Notes app, texts, Word/Excel, a paper pad, maybe Square for card payments |
| Tech comfort | Low-moderate. Android-heavy. Will not read documentation. |
| Trigger to buy | Lost/forgotten invoices, a customer complaining about an unprofessional quote, or a Jobber price rise |
| Budget reality | Already balking at $30/user/mo[28] |

**Anti-persona:** HVAC shops with 8+ techs, anyone wanting dispatch boards, pricebooks, memberships, or marketing automation. Selling to them is how this becomes Jobber.

---

## 3. Jobs to be done

1. **When I'm standing in front of the customer**, produce a clean, branded quote in under 60 seconds and send it by text/WhatsApp/email before I drive away.
2. **When the estimate is approved**, turn it into an invoice in one tap — no re-typing.
3. **When the customer pays**, mark it paid and have a record I can find later at tax time.
4. **When I forget who owes me money**, see a single "unpaid" list without building a report.

---

## 4. MVP scope

**In:**
- Create quote: line items, quantity/price, tax, notes, photos; save-and-reuse line items
- Send as a PDF link via SMS/WhatsApp/email; customer can view without an account
- One-tap convert quote → invoice; partial payments; mark paid
- Customer list with job history (auto-created from quotes)
- Offline-first: full function with no signal, sync when back on network
- Payment: connect your own Stripe/Square (bring your own merchant account)
- Single flat price, unlimited users, unlimited quotes

**Explicitly out (v1 and probably forever):**
- Dispatch board, route optimisation, GPS tracking
- Pricebook with thousands of items
- Memberships, recurring service plans, marketing automation
- Payroll, job costing, accounting sync beyond CSV export
- Native iOS app (PWA first — one codebase, no app-store tax)

---

## 5. Core flows

**Quote (primary):** open app → "New quote" → customer name (search or type) → add line items from recent list → optional photo → review → Send. Target: **under 60 seconds, one thumb**.

**Approval:** customer opens link, taps Approve → owner gets push/SMS → one tap to convert to invoice with a scheduled date.

**Collection:** invoice link with Pay button → customer pays card/transfer → status flips to Paid automatically.

**Chase:** unpaid invoices list + automatic reminder at 3 and 7 days (SMS is the channel that works for this audience, not email).

---

## 6. Pricing & packaging

| Plan | Price | Rationale |
|---|---|---|
| Solo | **$19/mo flat** | Undercuts Jobber's entry tier; matches the incumbent price-cutter |
| Crew | **$29/mo flat** | Unlimited users — the entire pitch versus $29/user[6] |
| Annual | $180 / $290 (2 months free) | Reduces churn in a seasonal business |

**No transaction fees, ever.** Payment processing goes through the customer's own Stripe/Square account. This is a deliberate differentiator: the vertical's second-biggest resentment after per-user pricing is systems that take a cut of payments.

⚠️ **Price is not a moat here.** See §7 — a $19/mo flat competitor already exists.

---

## 7. Competitive landscape

| Product | Published price | Positioning | Weakness you can attack |
|---|---|---|---|
| **Jobber** | Tiers to $399–699/mo; **+$29/user**; entry "Core" ~$39 | Category leader, SMB→mid | Tier jumps are the #1 complaint; cheapest tier keeps losing features upward[6][89][90] |
| **Housecall Pro** | $79–$299/mo; **+$35/user** past 8 | Prosumer field service | Per-user cost, upsell-heavy |
| **ServiceTitan** | Quote-only; operator quoted **$345/mo per tech** + $3,800 migration | Enterprise | Massive overkill; onboarding measured in months[2][8] |
| **Workiz** | Pricing pulled from public site in 2026; historically $225–325/mo; new capped "Lite" plan | Mid-market | Per-member costs raised ~20% in 2026[92] |
| **FieldPulse** | **$99 per user/mo**, plus $100–200/mo add-on modules (phone, AI, forms, fleet $30/vehicle) | Feature-stuffed | Add-on stacking makes real cost far higher[72] |
| **Kickserv** | $60 / $119 / $199 per month | SMB | Still 3–10× the target price[73] |
| **Markate** | $49.95/mo + **$5 per employee** | Low-cost CRM | Per-employee model; feature-limited[74] |
| **JobTread** | $199/mo + $20/internal user | Construction-leaning | Wrong shape for service calls[75] |
| **Yardbook** | **Free tier** | Lawn care | Free floor in one sub-vertical[26] |
| **Decker** | **$19/mo flat** | *"The Honest Jobber Alternative"* | ⚠️ **Already occupies the exact price point proposed here**[91] |
| **QuoteIQ** | Positioned "way cheaper than Jobber and Housecall Pro" | Pressure washing, lawn care | Trade-specific[3][89] |

### The honest read

**The "cheaper Jobber" wedge is already being executed — by at least four companies, one of them at exactly $19/mo flat.**[91][74][3] Price undercutting is therefore table stakes, not a strategy. Any new entrant needs a second axis.

---

## 8. Differentiation — pick one, not all

1. **Offline-first as the headline.** ~7% of 9,363 opportunity posts wanted offline/privacy-focused tools,[27] and this trade is full of basements, crawlspaces, rural jobs and truck cabs. An app that fully works with no signal is a demo-able, memorable claim. Competing products are cloud-round-trip apps.
2. **Zero-onboarding.** The quantified complaint is the 40-minute setup.[87] A "you can send your first quote 90 seconds after signing up, no tutorial" promise is a positioning no incumbent can credibly copy without breaking their upsell funnel.
3. **One trade, deep.** A generic lite tool fights everyone. A pressure-washing or cleaning-specific tool with measured-area quoting (as QuoteIQ proved)[89] competes on relevance instead of price.

**Do not** try to win on "it's cheaper" alone, and **do not** build a dispatch board on day one.

---

## 9. Risks & kill criteria

| Risk | Severity | Mitigation / kill criterion |
|---|---|---|
| Price race to the bottom ($19 flat already exists)[91] | **High** | Differentiate on offline + zero-onboarding, not price |
| Support burden from low-tech users | High | PWA, no setup, WhatsApp/SMS support; if support tickets > 15% of revenue, the model breaks |
| Seasonal churn (landscaping, pressure washing) | Medium | Annual plans; measure 12-month retention, not monthly |
| Incumbent copies the flat price | Medium | They can't without cannibalising per-user revenue — but watch for a "Solo" tier |
| Building in a crowded, loud market means paid acquisition costs are high | Medium | Distribution must be community/SEO/trade-specific, not ads |

**Kill the project if:** after 60 days of pre-sales outreach in two trade subreddits, fewer than 10 operators will put a card down at $19/mo.

---

## 10. Metrics that matter

- **Activation:** % of signups who send a quote within 24h (target >60%)
- **Core loop:** quotes→invoices conversion per account per month
- **Retention:** 12-month logo retention (the only one that matters in a seasonal trade)
- **Unit economics:** monthly support minutes per account (target <10)
- **Positioning proof:** % of churned-competitor users who cite price *and* per-user fees

---

## 11. Validation plan before writing code

1. Read the last 30 comments of every "cancelled Jobber/ServiceTitan" thread and extract the exact feature list churners state — that's the spec.[29][89][90]
2. Interview 10 owner-operators in **one** trade. Ask what they paid last month and what they'd cancel.
3. Ship a one-page "send a quote in 60s, works offline, $19 flat" landing page and drive it from the trade subreddit.
4. Pre-sell 10 annual plans. An upvote is free; a card is the only real signal.

---

## 12. Sources

## 11. Sources

## Sources

[2] https://www.reddit.com/r/ProHVACR/comments/1ovdgnn/have_outgrown_legacy_esc_desco_software
[3] https://www.reddit.com/r/WhichCRM/comments/1lm3byf/whats_the_best_crm_for_pressure_washing_lawn_care
[6] https://www.getjobber.com/pricing
[8] https://www.servicetitan.com/pricing
[26] https://www.yardbook.com/pricing
[27] https://www.reddit.com/r/SaaS/comments/1q5lfur/i_analyzed_9300_i_wish_there_was_an_app_for_this
[28] https://www.reddit.com/r/smallbusiness/comments/1shm3fz/managing_employee_tasks_without_spending
[29] https://www.reddit.com/r/Construction/comments/1snrdtf/servicetitan_alternative_for_small_residential
[33] https://www.reddit.com/r/landscaping/comments/1pansti/helping_my_uncle_with_his_landscaping_paperwork
[72] https://www.fieldpulse.com/pricing
[73] https://www.kickserv.com/pricing
[74] https://markate.com/pricing
[75] https://www.jobtread.com/pricing
[86] https://www.reddit.com/r/Plumbing/comments/1sr32k5/solo_guys_how_are_you_sending_quotes_to_customers
[87] https://www.reddit.com/r/HandymanBusiness/comments/1ryngdm/where_can_i_find_simple_contractor_software_that
[89] https://www.reddit.com/r/PressureWashingGrowth/comments/1mxkw2x/why_i_left_jobber_crm_review
[90] https://www.reddit.com/r/WhichCRM/comments/1mfoydr/jobber_alternatives_no_more_duct_tape
[91] https://getdecker.app/jobber-alternative
[92] https://pricingsaas.com/companies/workiz/diffs/2026W21
