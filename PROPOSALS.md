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

### P5 — Light competitor context in the audit  · Effort: M
- **Idea:** Use Places "search nearby/text" to find a few same-trade businesses in the same city and
  show how the buyer's review count / rating / photo count compares to the local field.
- **Why it helps:** "You have 14 reviews; nearby plumbers that show up have 60–200" is a powerful,
  concrete motivator and a real differentiator vs. generic audits.
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

### P8 — Swap the demo sample targets to owner-operated SMBs  · Effort: S
- **Idea:** The committed `sample-audits/` were generated against three big national chains
  (Roto-Rooter, One Hour, Jiffy Lube) because they reliably resolve in Places. They're great proof the
  engine cites real data — but they're *over-optimized*, so the audits find less to fix and slightly
  undersell the product. Regenerate (or add) 1–2 samples against genuinely messy owner-operated local
  shops (the actual customer profile) to show the audit at full value.
- **Why it helps:** Stronger sales/demo artifact: a messy profile surfaces more high-impact findings
  (missing hours, wrong category, thin reviews, no website schema) — exactly what the buyer is paying to
  have caught. `generate:samples` already accepts CLI targets, so this is just choosing better businesses.
- **Why it's a proposal, not a silent change:** picking which real businesses to feature publicly is a
  judgment/marketing call for you, and it costs a few more live model calls. The existing three are real
  and stay as-is until you decide. **Model default is unchanged** (`anthropic/claude-sonnet-4.5` is right
  for a $249 deliverable; see JOURNAL 2026-06-24).

---

If you want any of these, say which and I'll spec + build it in a focused session. Until then the
core (pay → audit → deliver) is the whole product and is kept complete.
