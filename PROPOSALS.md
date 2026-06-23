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

### P2 — Async background worker for model latency  · Effort: S–M
- **Idea:** Split fulfillment into a fast synchronous webhook (verify signature → 200) plus a
  Netlify **background function** that does Places + model + email with a 15-minute budget.
- **Why it helps:** Netlify's synchronous functions cap at ~10s. A premium model writing a full
  audit can occasionally exceed that, causing a timeout (and Stripe retries). The background
  pattern removes that ceiling entirely and is the "correct at scale" design.
- **Depends on:** Confirming background functions are enabled on your Netlify plan; reuses
  `STRIPE_WEBHOOK_SECRET` for the internal trigger signature (no new secret).
- **Note:** Current mitigation = structured-JSON output keeps the model's response compact (faster),
  and `OPENROUTER_MODEL` lets you pick a fast model (e.g. `google/gemini-2.5-flash`) if you ever see
  timeouts in the function logs. Build this only if real-world latency proves to be a problem.

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

---

If you want any of these, say which and I'll spec + build it in a focused session. Until then the
core (pay → audit → deliver) is the whole product and is kept complete.
