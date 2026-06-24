# Proposals (owner approval required before building)

These are ideas surfaced while building the core pipeline that I deliberately **did not build**,
because they expand scope beyond "turn a payment into a delivered audit." The core stays finished
and clean; you decide which (if any) of these are worth a future session. Ordered by my view of
value-for-effort.

Legend — Effort: S (≤1 session) · M (1–2 sessions) · L (multi-session). Each lists what it depends on.

---

### P1 — Webhook idempotency (dedupe Stripe events)  · Effort: S
- **Idea:** Persist processed Stripe `event.id`s so a retried or duplicated webhook can't generate
  and email the same audit twice.
- **Why it helps:** Stripe delivers events at-least-once; today a rare duplicate could send a paying
  customer two identical audit emails. Harmless but unprofessional. Idempotency makes fulfillment
  exactly-once.
- **Depends on:** A tiny external store (Netlify Blobs, Upstash Redis, or a 1-table DB). The store
  is why this is a proposal, not a silent add — the scope fence explicitly calls out "a database."
- **Note:** Current mitigation = the work is fast and single-shot; impact of a dupe is one extra
  identical email. Low real-world frequency.

### P2 — Async background worker for model latency  · ✅ IMPLEMENTED THIS SESSION
- **Done:** A code review flagged that a slow model could exceed Netlify's ~10s synchronous-function
  ceiling and silently drop a paid order. Because Netlify background functions are available on all
  plans (including Free, with a 15-minute budget), this was implemented as core reliability, not a
  later add: the webhook verifies the Stripe signature (→ 400 on invalid) then hands off to
  `netlify/functions/audit-worker-background.js`, signed with `STRIPE_WEBHOOK_SECRET` (no new secret).
  If the hand-off ever fails, the webhook fulfills inline as a fallback. Left here for the record.

### P3 — Maintenance upsell automation ($149/mo)  · Effort: M
- **Idea:** Automate the existing $149/month maintenance offer: monthly GBP-post drafts, review-
  response drafts, and a re-check email — triggered by a recurring Stripe subscription.
- **Why it helps:** Recurring revenue per customer; the brief notes one maintenance customer plus a
  few audits clears the monthly target. This was **explicitly out of scope for this session.**
- **Depends on:** A recurring Stripe product (HANDOFF already documents creating it), a scheduler
  (Netlify scheduled functions / cron), and a place to store each subscriber's Place ID.

### P4 — Hosted audit page + PDF, in addition to the email  · Effort: M
- **Idea:** Also publish each audit to a private unguessable URL and/or attach a PDF.
- **Why it helps:** Some buyers want a shareable/printable artifact. Increases perceived value.
- **Depends on:** Storage/hosting for the generated HTML, a PDF renderer (e.g. Puppeteer in a
  function or an HTML→PDF API). The brief intentionally scoped the deliverable to the email only,
  so this is a second deliverable type → fenced.

### P5 — Light competitor context in the audit  · Effort: M  · ⭐ TOP-VALIDATED GAP (2026-06-24 review)
- **Idea:** Use Places "search nearby/text" to find a few same-trade businesses in the same city and
  show how the buyer's review count / rating / photo count compares to the local field.
- **Why it helps:** "You have 14 reviews; nearby plumbers that show up have 60–200" is a powerful,
  concrete motivator and a real differentiator vs. generic audits.
- **Validated:** The three-way quality review (QUALITY_REVIEW.md, 2026-06-24) independently surfaced this
  as the **single biggest thing standing between "the $249 feels okay" and "the $249 is clearly justified."**
  Both the independent subagent and Codex flagged that the audits offload competitive research back onto the
  buyer ("search these terms yourself"). This is the #1 candidate if you want to raise perceived value.
- **Depends on:** More Places API calls (cost + latency) and very careful prompt guardrails to avoid
  fabrication or naming/disparaging specific competitors. Real risk of crossing the no-fabrication
  line, so it needs deliberate design + your sign-off — not a silent add.

### P6 — Conversion analytics on the free scorecard → paid  · Effort: S–M
- **Idea:** Privacy-light tracking of scorecard completions and buy-button clicks to learn the
  free→paid funnel.
- **Why it helps:** Tells you whether outreach or the offer is the bottleneck.
- **Depends on:** An analytics endpoint/tool (analytics infra is fenced). Could be as light as a
  Netlify function logging events, but it's still new infra.

### P7 — 30-day re-audit / progress check  · Effort: M
- **Idea:** Email buyers ~30 days later offering a free or cheap re-scan to show movement on the
  fixes they made.
- **Why it helps:** Natural bridge into the maintenance subscription; demonstrates value delivered.
- **Depends on:** Storing buyer + Place ID + purchase date, and a scheduler. Overlaps with P3.

### P8 — Swap the demo sample targets to owner-operated SMBs  · ✅ DONE THIS SESSION (2026-06-24)
- **Done:** Generated 5 real audits against genuinely rough, single-location, owner-operated locals
  (Rimmer Electric, Watson Plumbing, Jimmy Lock & Key, Spot On Lawn Care, Youngstown HVAC) covering 5
  trades and all three website states. The 3 chain audits were archived to
  `sample-audits/archive-national-chains/`. These messy profiles surfaced exactly the high-impact findings
  the chains couldn't (wrong category ×2, missing phone on a 70-review plumber, social-only/unreadable site,
  missing schema). Target list + rationale in JOURNAL 2026-06-24; quality assessed in QUALITY_REVIEW.md.
  **Model default unchanged** (`anthropic/claude-sonnet-4.5`). Left here for the record.

### P9 — "Done-for-you" assets inside the audit  · Effort: M
- **Idea:** Instead of only telling the owner what to fix, ship ready-to-paste artifacts: a filled-in
  LocalBusiness JSON-LD snippet (their NAP/hours/areas), a 2-line review-request SMS/email template, a
  suggested GBP business-description paragraph, and a homepage `<title>` string — all pre-populated from
  the data the audit already has.
- **Why it helps:** Codex's review (QUALITY_REVIEW.md, 2026-06-24) named the absence of "schema snippets,
  review-request templates, website copy, or any implementation" as a key reason $249 can feel steep.
  Generating these from data already in hand is cheap and converts "homework" into "done." Likely the
  highest value-per-effort lever after P5.
- **Depends on:** Only prompt + render changes (no new data source), but it adds a new output surface and
  changes the deliverable's shape, so it's a deliberate product decision, not a silent add. Guardrail: the
  generated schema/copy must stay strictly within verified data (no invented hours/areas).

---

If you want any of these, say which and I'll spec + build it in a focused session. Until then the
core (pay → audit → deliver) is the whole product and is kept complete.
