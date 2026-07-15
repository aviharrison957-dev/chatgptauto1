# Handoff

Product: **MapGap Report** — a $249 one-time local-presence audit for owner-operated local service
businesses (HVAC, plumbing, locksmith, pest control, landscaping, auto repair). The customer pays, gives
their Google Business Profile link at checkout, and is automatically emailed a specific, prioritized audit.
Optional later upsell: $149/month maintenance (not built — see `PROPOSALS.md`).

**Host: Vercel** (migrated from Netlify 2026-07-15). Live URL: **https://mapgap-report.vercel.app**

---

## ⚠️ Current status (2026-07-15)

**Deployed, secured, and test-mode-wired — but NOT yet proven with a real email, and NOT live for real
payments.** What is done vs. what is left is precise below; don't assume more than this says.

**Done and verified:**
- Site + serverless webhook are **live on Vercel** at https://mapgap-report.vercel.app (home 200;
  `/api/stripe-webhook` returns 405 on GET / 400 on unsigned POST — correct).
- The whole post-payment pipeline is ported to a single Vercel function (`api/stripe-webhook.mjs`) that
  verifies the Stripe signature, returns 200 immediately, then runs Places → website → OpenRouter → Resend in
  `waitUntil` with a 300s budget. **Timed proof:** the heavy chain is ~53–65s, well under 300s (JOURNAL
  2026-07-15). The deployed pipeline was confirmed executing on real Vercel infra.
- **Two security audits** (internal Opus subagent + independent Codex CLI). All in-scope findings fixed;
  44 offline tests green. Details in `SECURITY_AUDIT.md`. Webhook idempotency (dedupe replayed Stripe events)
  is built. Payment is now validated (`payment_status=paid`, `mode=payment`) before any audit is generated.
- **Stripe TEST mode** fully set up by the agent: product + $249 price + a **test Payment Link** with the
  required `google_business_profile_url` custom field, and a **webhook endpoint** pointed at the Vercel URL
  (signing secret stored in Vercel env). The test link is already wired into the site.
- Vercel production env vars set (via REST API): `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY` (test),
  `OPENROUTER_API_KEY`, `GOOGLE_PLACES_API_KEY`, `OWNER_FALLBACK_EMAIL`, `SITE_URL`.

**The ONE thing left before the end-to-end email works — `RESEND_API_KEY` (needs your ~15 seconds):**
Resend blocks automated signup (server error on every programmatic attempt), so it needs a human OAuth click.
The signup page was opened in your browser. **Sign in at https://resend.com with "Continue with GitHub"
(or Google)**, then either (a) create an API key (Sending access) and tell me / paste it, or (b) tell me
you're in and I'll mint it. Until this key is set in Vercel, audits generate but cannot be emailed — the
deployed pipeline currently fails at the email step (proven: it runs Places+OpenRouter, then stops at Resend).

---

## What is built

| Piece | File |
| --- | --- |
| Public sales page | `index.html` |
| Free scorecard (lead magnet) | `assets/js/scorecard.js` |
| Payment link config | `assets/js/config.js` (currently the TEST link) |
| **Vercel webhook + fulfillment** | `api/stripe-webhook.mjs` (verify → 200 → `waitUntil` pipeline) |
| Idempotency (dedupe replayed events) | `lib/idempotency.js` |
| Pipeline modules | `lib/*.js` |
| Vercel config (function maxDuration=300, security headers, CSP) | `vercel.json` |
| Manual fallback report tool (owner-only) | `report-builder.html` |
| Quality gate (real samples) | `scripts/generate-samples.js` → `sample-audits/` |
| Offline tests (no keys, 44 checks) | `npm test` |
| Legacy Netlify entry points (NOT deployed; documented fallback) | `netlify/functions/*.js` |

---

## Your ≤10-minute go-live checklist

Do these in order. The first item is not optional.

### 1. FIRST — make the $249 sellability call (no automation substitutes for this)
Open and read these two real generated audits in a browser, then decide if this is worth $249 to a real owner:
- `sample-audits/watson-plumbing-associates-llc.html` — the clearest "worth it" (found a missing phone on a
  70-review profile + category issues).
- `sample-audits/rimmer-electric.html` — the borderline case (a healthier profile → thinner audit).
The gap between those two files **is** the product's value question. If they're not worth $249, tell me what's
weak and I'll tune the prompt (`lib/audit.js`) before you sell anything.

### 2. Finish the Resend key (unblocks email)
Sign into https://resend.com via GitHub/Google, create a **Sending** API key. For real customer mail, also add
+ verify your sending **domain** (Resend → Domains) and set `RESEND_FROM_EMAIL` (e.g.
`MapGap Report <reports@yourdomain.com>`); without a verified domain, mail uses Resend's shared sender and may
land in spam. Give me the key (or say "I'm in") and I'll set it in Vercel + run the real end-to-end email test.

### 3. Flip Stripe to LIVE (the human-only steps — KYC is yours)
- Your Stripe account already shows `charges_enabled` + `details_submitted` = true, so KYC looks complete. If
  Stripe still asks for any identity/business verification, that's yours to finish.
- In **live mode**, recreate the Payment Link exactly like the test one: product "MapGap Report", one-time
  **$249**, require customer email, and a **required text custom field** with **field key
  `google_business_profile_url`** (label: "Google Business Profile or Google Maps link").
- Create a **live** webhook endpoint → `https://mapgap-report.vercel.app/api/stripe-webhook`, event
  `checkout.session.completed` only. Copy its signing secret.
- Give me the live payment link + live secret key + live signing secret; I'll set the live values in Vercel
  and swap `assets/js/config.js` `auditPaymentUrl` to the live link (commit + push → auto-deploys). **Do not
  hand-edit secrets into files** — they go in Vercel env only.

That's it. Steps 2–3 are ~10 minutes of clicks; step 1 is the judgment only you can make.

---

## How automated fulfillment works

1. Customer clicks **Buy the audit** → Stripe Checkout collects payment, email, and the Google Business
   Profile field.
2. Stripe sends `checkout.session.completed` to `/api/stripe-webhook` (a Vercel function).
3. The function **verifies the Stripe signature** (forged/unsigned → HTTP 400, no work), checks the event
   wasn't already fulfilled (idempotency via Stripe PaymentIntent metadata), confirms the session is **paid**,
   returns **200 to Stripe immediately**, and runs the rest in `waitUntil` (up to 300s).
4. It fetches the business's public data from **Google Places API (New)**, reads the homepage for on-page
   signals, generates the audit with **OpenRouter** (`anthropic/claude-sonnet-4.5`), renders premium email-safe
   HTML, and emails it to the customer via **Resend** — typically within ~1 minute.
5. **If any step fails, the customer is NOT emailed.** You get a fallback alert (to `OWNER_FALLBACK_EMAIL`)
   with the order details + error so you can fulfill by hand with `report-builder.html`.

## Managing the deployment
- **Env vars:** Vercel dashboard → Project `mapgap-report` → Settings → Environment Variables (Production).
  Set via the dashboard or REST API — **not** via piped `vercel env add` stdin (that silently stored empty
  values this session; see JOURNAL 2026-07-15). After changing any env var, **redeploy** for it to take effect.
- **Deploys:** pushing to `main` on GitHub auto-deploys. Manual: `vercel deploy --prod`.
- **Logs:** Vercel dashboard → the deployment → Runtime Logs (the CLI `vercel logs` stream is lossy).
- **Model / tuning knobs:** `OPENROUTER_MODEL` (default `anthropic/claude-sonnet-4.5`), `OPENROUTER_MAX_TOKENS`
  (6000), `OPENROUTER_TIMEOUT_MS` (clamped ≤220s). All optional.

## Guardrails (baked into the audit prompt; keep them in any future edit)
- Never guarantee rankings, Map Pack placement, calls, or revenue; never claim absolute negative outcomes.
- Never claim the report is from or endorsed by Google.
- Never fabricate reviews, competitors, metrics, statistics, or testimonials. Unverifiable items go in a
  "what we couldn't verify" section.
- Keep every finding tied to the business's real public data. On automation failure, fulfill manually — never
  ask the customer to debug their order.

## Top residual risks (read before you scale)
1. **A rare simultaneous outage can lose a paid order.** Fulfillment runs in `waitUntil` after the webhook
   already returned 200; if BOTH the customer email and the owner alert fail (e.g. a full Resend outage), the
   order is lost because Stripe won't retry. The real fix is a durable order queue — deliberately **not** built
   (scope fence: needs a database). Logged as **PROPOSALS P10**; it's the #1 thing to build before real volume.
2. **Email deliverability / bounces.** A Resend 2xx means "accepted," not "delivered"; a later bounce raises no
   alert today (PROPOSALS P11). Verify your sending domain in Resend before selling, and watch Resend's logs.
3. **Audit quality on healthy profiles.** The audit clearly earns $249 when it surfaces a hidden defect; on an
   already-clean profile it's thinner (~$79–129 feel). Your read of the two sample audits (step 1) is the real
   test. Biggest value levers deferred to PROPOSALS P5 (competitor context) and P9 (done-for-you assets).

## No-spam customer acquisition
Do not scrape, blast, fake reviews, or pretend to be Google. Small targeted batches only: pick one trade + one
city, find ~20 businesses with obvious public gaps, send at most one plain email each, and offer the **free
scorecard** first, not the paid audit.
