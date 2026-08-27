# What I Need From Avi

**Updated 2026-08-27 (go-live mission).** MapGap is **LIVE**: the site's Buy button charges a
real $249 and the pipeline emails the audit (email path E2E-proven 2026-08-12). Evidence and
gate reports: `.flywheel/001/` (gate0-report, gate1-report, live-link-verify).

## ✅ Done by the agent 2026-08-27 (no action needed)
- Gate 0 contamination check: CLEAN — the "identical slug" was Stripe's per-account URL
  counter, not config bleed. Details in `.flywheel/001/gate0-report.md`.
- LIVE Stripe: product `prod_V9R5wP1s0sIdtM`, $249 price, payment link
  `https://buy.stripe.com/aFa14p2wGbIOf5beKA5gc0i`, webhook `we_1U98D4PL9698yhYPl9179M7y`.
  Vercel env on live key + live signing secret. Rendered checkout verified (MapGap Report,
  $249, required GBP field).
- Webhook now ignores sales of OTHER products in the shared Stripe account
  (`MAPGAP_PAYMENT_LINK_IDS` guard; 45 offline checks green).
- Fresh samples for your sellability call:
  **`sample-audits/watson-plumbing-associates-llc.html`** and
  **`sample-audits/rimmer-electric.html`** (regenerated today).
- Outbound loaded, NOT sent: `outreach/prospects.csv` (110 prospects, unique emails +
  fact-based teasers), `outreach/call-targets.csv` (60 high-gap/no-email — call/SMS lane),
  `outreach/sequence.md` (two branches + reply playbook).

## 🔴 Your ~20 minutes, in order
1. **Sellability call** — open the two fresh samples; is this worth $249?
2. **Approve the sending identity** — reply "approve gmail" (send cold from
   aviharrison957@gmail.com; saboxai.com stays transactional-only) or "cousin domain"
   (buy an outreach domain + warm 2-3 weeks first). Full reasoning:
   `.flywheel/001/gate1-report.md`. Nothing sends until you also say "send".
3. **Cal.com booking link** — create event "15-minute Google presence review", send me the URL.
4. **CAN-SPAM postal address** — a real mailing address or PO Box for the email footer.
5. **(5 min, do regardless) saboxai.com DNS** — root SPF record is MISSING:
   add TXT `v=spf1 include:_spf.google.com ~all`; upgrade DMARC per gate1-report. This
   improves delivery of the PAID audit emails.
