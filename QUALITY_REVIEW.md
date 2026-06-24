# QUALITY_REVIEW.md — Are the audits worth $249?

A three-way, buyer's-eye quality assessment of 5 **real** audits generated against **realistic** targets:
small, single-location, owner-operated local service businesses with visibly rough Google profiles
(the actual paying customer — not the polished national chains tested earlier). Targets, Place IDs, and
selection rationale are in `JOURNAL.md` (2026-06-24 01:35). The 5 audits live in `sample-audits/`.

The three independent auditors:
1. **Builder's own skeptical review** (this session's operator, Claude Opus 4.8) — harsh, below.
2. **Independent self-auditor subagent** — fresh eyes, given only the 5 audits + a buyer's question,
   free to disagree. Verdict recorded verbatim.
3. **Codex CLI** (external model) — same buyer's question, run independently. Recorded verbatim, or an
   honest note if it could not be invoked.

Nothing here is fabricated. Where a claim needed checking, I checked it against the code/data and say so.

---

## Pre-check: did the engine fabricate any "specific" detail? (two suspicious claims)

Specificity is the product, so precise-sounding claims are exactly where fabrication would hide. I checked
the two most suspicious:

- **Spot On — "the Facebook page returned an HTTP 400 error."** VERIFIED REAL. `website.js` performs a live
  fetch even of social URLs; Facebook genuinely returns **HTTP 400** to the server's user-agent, and the
  code sets `reason: "Homepage returned HTTP 400."` (website.js:89). The model relayed a true status code,
  not an invented one. ✔ Honest.
- **Rimmer — "30–40% of inbound calls go unanswered" (electrical contractors).** NOT in any input data —
  this is an unsourced industry statistic the model introduced. The system prompt permits *general* industry
  context in the missed-call section, and it is framed as industry-wide (not a claim about Rimmer), so it
  does not break the "no fabricated numbers about THIS business" rule. But a precise "30–40%" with no source
  is the single least-defensible sentence in the five audits. ⚠ Flag (see Synthesis).

Net: the engine is **not inventing the business's own data.** The one issue is a precise-but-unsourced
*industry* stat in one audit's weakest section.

---

## AUDITOR 1 — Builder's own skeptical review (harsh)

I scored each audit on the user's questions: real-data specificity vs generic drift; count of genuinely
**non-obvious, actionable** findings (strict — generic "get more reviews / add photos / get a website /
test your voicemail" does NOT count, since a savvy owner or ChatGPT already knows those); what's free from
ChatGPT in 2 minutes; the weakest section; and whether a real owner would feel $249 was justified.

### 1. Rimmer Electric (electrician, Shreveport LA — real but weak website)
- **Real data cited?** Yes, densely: 4.6★/10 reviews, hours 7 AM–4 PM weekdays, phone (318) 221-7490,
  HTTPS, **3 click-to-call links**, **structured data present but no LocalBusiness schema**, **0 contact
  forms**, and a real review anecdote ("called back at 4:30 PM, technician on-site by 7:30 AM"; another
  reviewer noted other electricians were "too busy or uninterested" in small jobs). This is not generic.
- **Genuinely non-obvious, actionable findings: 3.** (a) Missing LocalBusiness JSON-LD despite having other
  structured data — a real, technical catch the owner would never spot. (b) Homepage has click-to-call but
  **no contact form** (form count 0) → losing after-hours, non-calling leads. (c) Turn the specific
  responsiveness story in their own review into positioning. The rest (restart reviews, respond to reviews,
  add photos monthly, track answer rate) is standard best-practice.
- **Free from ChatGPT?** ~40% of it. The schema gap, the form gap, and the review-anecdote leverage are NOT
  — they require actually reading the live site and reviews.
- **Weakest section:** Missed-Call. It's the one carrying the unsourced "30–40%" stat and otherwise repeats
  "call your own number / set up text-back."
- **$249 verdict:** Justified, if borderline. The web-specific catches are real consulting value the owner
  couldn't self-diagnose. A picky owner might say "half of this is stuff I knew."

### 2. Watson Plumbing & Associates (plumber, Macon GA — no website)
- **Real data cited?** Yes: 4.0★/70 reviews, storefront (not service-area), 10+ photos, and the headline
  catch — **no phone number, no hours, no website on the profile.** Review reading is sharp: "three of five
  recent reviews mention responsiveness/quick service; one praises fair pricing vs a competitor's quote; the
  lone 1-star is about a **water-delivery side service** (not core plumbing) and cites office communication."
- **Genuinely non-obvious, actionable findings: 2 (one very high value).** (a) **No phone number on the GBP**
  — a glaring, money-losing gap the owner may not realize is missing/hidden; arguably worth the fee alone.
  (b) The 1-star is mis-attributed to a non-core side service — a nuance that reframes the 4.0 and tells the
  owner exactly what to address. "No hours" is real but obvious once stated.
- **Free from ChatGPT?** The two catches above are impossible without the live GBP + review text. The rest
  (get a website, ask for reviews) is free.
- **Weakest section:** Website — there's no site, so it's two findings of pure hypothetical ("once a website
  is live, make sure the title says Plumber + Macon…"). Also a real miss: the audit calls 70 reviews/**4.0★**
  "solid" and marks the snapshot "good." 4.0 is mediocre for a service trade; the audit under-weights that
  the rating itself is a problem (it can't see the negative reviews behind it — API caps at 5 — but it should
  flag 4.0 as a concern, not praise it).
- **$249 verdict:** Justified. Fixing a missing phone number on a 70-review profile is real revenue.

### 3. Jimmy Lock & Key (locksmith, Wauseon OH — no website)
- **Real data cited?** Yes: 4.9★/17 reviews, **1 photo**, 24/7 weekend hours, phone (419) 784-6846, address
  on a county road. Reviews read specifically: "three of five mention car-key services — 'making car keys,'
  'locked her only set of keys in her car,' 'worked relentlessly trying to get the ignition to fire.'"
- **Genuinely non-obvious, actionable findings: 2.** (a) The **car-key/ignition specialty** surfaced from
  real reviews as a positioning asset. (b) **Service-area vs physical-location**: the rural county-road
  address suggests a mobile op that should hide its address and set a service area — a sophisticated GBP
  nuance most owners don't know. "Only 1 photo" is specific but the fix ("add photos") is obvious.
- **Free from ChatGPT?** The SAB nuance and the car-key positioning are not; the website/photo/review advice
  is.
- **Weakest section:** Website — two near-identical "you have no site, here's what a site should have"
  findings.
- **$249 verdict:** Borderline. The advice is sound and two catches are genuinely smart, but a one-person
  rural locksmith with 17 reviews is the customer most likely to feel $249 is steep for "mostly things I
  half-knew + two good tips."

### 4. Spot On Lawn Care (lawn, Lakeland FL — social-only/Facebook)
- **Real data cited?** Yes: 5.0★/15 reviews, hours 7 AM–7 PM daily, phone (352) 232-8259, **primary category
  = generic "Services,"** **website = a Facebook page that returns HTTP 400**, all 5 reviews ~5 years old.
- **Genuinely non-obvious, actionable findings: 2 (one very high value).** (a) **Primary category is
  "Services," not "Lawn care service"** — a one-click change with outsized relevance impact that the owner
  almost certainly doesn't know matters. (b) The Facebook page is **unreadable/unrankable** — reframes "we
  have a Facebook page" into "Google has nothing to index." The 5-year review staleness is specific but the
  fix is obvious.
- **Free from ChatGPT?** The category catch and the Facebook-unrankable reasoning require the live GBP; not
  free. Review/website advice is free.
- **Weakest section:** Missed-Call (generic) — though it's tighter here than in the others.
- **$249 verdict:** Justified. The category fix alone can change who finds them; that's real, specific value.

### 5. Youngstown HVAC Services (HVAC, Youngstown OH — no website, 0 photos)
- **Real data cited?** Yes: 4.9★/9 reviews, **primary category "General Contractor"** (not HVAC),
  **0 photos**, hours 7 AM–8 PM weekdays, phone (330) 227-1434, review themes ("urgent heating problem,"
  "swiftly fixed," "record time," "accommodating to our schedule").
- **Genuinely non-obvious, actionable findings: 1–2.** (a) **Primary category "General Contractor" instead
  of "HVAC Contractor"** — the standout catch; the business won't surface for HVAC searches. (b) **0 photos**
  is a specific, real gap (fix is obvious, but the diagnosis is concrete).
- **Free from ChatGPT?** The category catch is not; almost everything else is.
- **Weakest section:** Website — fully hypothetical (no site). This is the **thinnest** of the five: only 9
  reviews, no site, no photos means the least raw material, so the audit leans hardest on the one category
  insight wrapped in generic advice. Minor nit: it calls a website "a baseline expectation… in 2025" (it's
  2026) — a small model-staleness tell.
- **$249 verdict:** Borderline / risk of feeling shortchanged. One killer insight (category) + generic
  filler. The buyer with the emptiest profile gets the least specific content — the inverse of what you'd
  want.

### Auditor 1 cross-cutting conclusions
- **Specificity: strong and consistent.** Every audit cites the business's real numbers, real categories,
  real phone/hours state, and real review themes pulled from actual review text. This is a categorical
  improvement over the chain audits, which had nothing to bite on. The engine is honest **and** now specific.
- **Non-obvious value per audit: ~2–3 catches**, wrapped in ~5–6 generic best-practice items. The best
  catches are excellent: two miscategorizations, a missing phone number, a missing schema, a social-only
  blind spot, a service-area nuance, a mis-attributed 1-star.
- **The recurring weak spots are structural, not random:** (1) the **Missed-Call** section is inherently
  speculative (the engine can't measure calls), so it's the most generic and is where the one unsourced
  stat appeared; (2) the **Website** section collapses to hypothetical filler whenever there's no site —
  which is most of this customer base. Together these are ~40–50% of each audit's word count.
- **ChatGPT-in-2-minutes:** roughly half of each audit is replicable for free *if the owner does the data
  entry themselves*. The half that is NOT replicable — the data-grounded catches — is the real product, and
  it lands. The value proposition is "we read your actual profile and reviews and found the specific gaps,"
  not "here's generic SEO advice."
- **Honest overall (builder's view):** Sellable, with caveats. Value-per-dollar is highest when the business
  has more raw material (a website to critique, a miscategory, a reputation wrinkle) and weakest on the
  near-empty profiles (Youngstown), where one good insight floats in generic advice. The single biggest
  quality risk is the **generic Missed-Call + empty-site filler diluting the specific findings** — and, to a
  lesser degree, **precise-but-unsourced industry framing** (Rimmer's 30–40%).

---

## AUDITOR 2 — Independent self-auditor subagent (fresh eyes, verbatim)

_Recorded verbatim below once the independent subagent has run. It was given only the 5 audits and a
buyer's question, with explicit permission to disagree with Auditor 1._

<!-- VERBATIM SUBAGENT VERDICT TO BE INSERTED -->

---

## AUDITOR 3 — Codex CLI (external, verbatim)

_Recorded verbatim below, or an honest note if Codex could not be invoked._

<!-- VERBATIM CODEX VERDICT TO BE INSERTED -->

---

## SYNTHESIS — reconciling the three verdicts

_To be written after Auditors 2 and 3. If and only if all three independently point to the same concrete,
fixable prompt weakness, one conservative prompt-tuning round + regeneration will follow, with before/after
recorded here._

<!-- SYNTHESIS TO BE WRITTEN -->
