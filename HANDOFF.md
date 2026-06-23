# Handoff

Product: **MapGap Report** — a $249 one-time local-presence audit for owner-operated local service
businesses (HVAC, plumbing, locksmith, pest control, landscaping, auto repair). The customer pays,
gives their Google Business Profile link, and is automatically emailed a specific, prioritized audit.
Optional later upsell: $149/month maintenance (not built this session — see `PROPOSALS.md`).

This file is the **step-by-step setup guide**, written to be followable without coding. The one-page
credential checklist is `NEEDS_FROM_AVI.md`; the running build log is `JOURNAL.md`.

---

## ⚠️ Current status

The entire post-payment pipeline is **built and code-complete**:

> Stripe payment → verify webhook → fetch Google Business data (Places API New) → read the website →
> generate the audit with AI (via OpenRouter) → email it to the customer with Resend. Any failure
> emails **you** instead, so no customer ever gets a broken report.

**What is NOT yet proven: audit quality.** Generating a real sample needs two live keys that weren't
available during the build (`OPENROUTER_API_KEY`, `GOOGLE_PLACES_API_KEY`). No samples were faked.
**Before you sell, do Step 1 + Step 2 below and run the quality gate (Step 8) to see real audits.**

---

## What is built

| Piece | File |
| --- | --- |
| Public sales page (kept as-is) | `index.html` |
| Free scorecard (lead magnet) | `assets/js/scorecard.js` |
| Payment link config (you paste 1 URL) | `assets/js/config.js` |
| Webhook entry point | `netlify/functions/stripe-webhook.js` |
| Pipeline modules | `netlify/functions/lib/*.js` |
| Netlify config + `/api/stripe-webhook` route | `netlify.toml` |
| Manual fallback report tool | `report-builder.html` |
| Quality gate (real samples) | `scripts/generate-samples.js` → `sample-audits/` |
| Offline tests (no keys) | `npm test` |
| Template design preview (no keys) | `design-preview/audit-template-preview.html` |

---

## Setup, in order

You can do Steps 1–3 in any order. Do them before Netlify so the keys are ready to paste.

### Step 1 — OpenRouter (the AI that writes the audit)  → `OPENROUTER_API_KEY`
1. Sign in at https://openrouter.ai (Google/GitHub login is fine).
2. Add a few dollars of credit: **Settings → Credits**. Each audit costs ~$0.02–0.03 with the default
   model, so this lasts a long time.
3. Go to https://openrouter.ai/keys → **Create Key** → copy it (starts with `sk-or-`).
- Default model is `anthropic/claude-sonnet-4.5` (chosen for careful, non-fabricating writing). To
  change it later, set `OPENROUTER_MODEL` (e.g. `google/gemini-2.5-flash` for faster/cheaper, or
  `anthropic/claude-sonnet-4.6` for the newest). No code change.

### Step 2 — Google Places API (New) (the real business data)  → `GOOGLE_PLACES_API_KEY`
1. Open https://console.cloud.google.com and create or select a project.
2. **APIs & Services → Library** → search **"Places API (New)"** → **Enable**.
   (Make sure it's *Places API (New)*, not the legacy "Places API".)
3. Enable billing on the project (Google's free monthly Places allowance covers your volume).
4. **APIs & Services → Credentials → Create credentials → API key** → copy it (starts with `AIza`).
5. After testing, restrict the key to **Places API (New)**.

### Step 3 — Resend (sends the email)  → `RESEND_API_KEY` (+ `RESEND_FROM_EMAIL`)
1. Sign in at https://resend.com.
2. **Domains → Add Domain**, add a domain you control, and add the DNS records they give you. Wait
   for "Verified". (Without a verified domain you can test with Resend's shared sender, but real
   customer mail needs your own verified domain or it lands in spam.)
3. **API Keys → Create API Key** (Sending access) → copy it (starts with `re_`).
4. You'll set `RESEND_FROM_EMAIL` to something like `MapGap Report <reports@yourdomain.com>`.

### Step 4 — Netlify site + environment variables
GitHub Pages can't run the webhook; Netlify can.
1. Sign in at https://app.netlify.com → **Add new site → Import an existing project**.
2. Connect GitHub and pick `aviharrison957-dev/chatgptauto1`.
3. Build settings (Netlify reads `netlify.toml`, so just confirm): Build command **blank**, Publish
   directory **`.`**, Functions **`netlify/functions`**. Deploy.
4. Open **Site configuration → Environment variables** and add:

| Variable | Required | Value / where |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | ✅ | from Step 1 (`sk-or-...`) |
| `GOOGLE_PLACES_API_KEY` | ✅ | from Step 2 (`AIza...`) |
| `RESEND_API_KEY` | ✅ | from Step 3 (`re_...`) |
| `OWNER_FALLBACK_EMAIL` | ✅ | your email — failure alerts go here |
| `STRIPE_SECRET_KEY` | ✅ | Stripe → Developers → API keys (`sk_live_...` / `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | ✅ | from Step 6 (`whsec_...`) — add after creating the endpoint |
| `RESEND_FROM_EMAIL` | recommended | your verified sender, e.g. `MapGap Report <reports@yourdomain.com>` |
| `OPENROUTER_MODEL` | optional | only to override the default model |
| `SITE_URL` | optional | your live URL (used only for OpenRouter's attribution header) |

5. After adding/changing variables, **trigger a redeploy** (Deploys → Trigger deploy).
6. Confirm the home page loads at your Netlify URL.
7. Confirm the webhook route exists: visiting
   `https://YOUR-SITE.netlify.app/api/stripe-webhook` in a browser should show a **method error**
   (it expects a POST from Stripe), not your homepage.

### Step 5 — Stripe Payment Link with the required custom field
1. In Stripe (complete business/identity verification first), open **Payment Links → New**.
2. Product: name `MapGap Report`, **one-time** price `$249`.
3. **Require customer email.**
4. Add a **custom field** (this is how the webhook learns which business to audit):
   - Type: **text**
   - Label: `Google Business Profile URL`
   - **Field key: `google_business_profile_url`**  ← must match exactly
   - Required: **yes**
   - Help text: `Paste your Google Business Profile / Google Maps URL or Place ID.`
5. Confirmation message: `Thanks! Your MapGap Report will be emailed to you shortly after checkout.`
6. Copy the payment link URL.

### Step 6 — Stripe webhook endpoint
1. Stripe → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://YOUR-SITE.netlify.app/api/stripe-webhook`
3. Select **only** the event: `checkout.session.completed`.
4. Save, open the endpoint, copy the **Signing secret** (`whsec_...`).
5. Put it in Netlify as `STRIPE_WEBHOOK_SECRET` (Step 4) and redeploy.

### Step 7 — Paste the payment link into the site
Edit `assets/js/config.js`:
```js
window.MAPGAP_CONFIG = {
  auditPaymentUrl: "PASTE_STRIPE_249_LINK_HERE",
  maintenancePaymentUrl: "",
  contactEmail: "you@yourdomain.com"
};
```
Commit and push; Netlify redeploys automatically:
```bash
git add assets/js/config.js
git commit -m "Activate payment link"
git push
```

### Step 8 — Prove the audit is good (the quality gate)
With your two Tier-1 keys, generate real audits for real businesses:
```bash
OPENROUTER_API_KEY="sk-or-..." GOOGLE_PLACES_API_KEY="AIza..." npm run generate:samples
```
Open the `.html` files written to `sample-audits/` in a browser. **Judge them yourself.** If they're
not worth $249, tell me what's weak and I'll tune the prompt in `netlify/functions/lib/audit.js`.

Optional offline check anytime (no keys needed): `npm test`.

---

## How automated fulfillment works

1. Customer clicks **Buy the audit** → Stripe Checkout collects payment, email, and the Google
   Business Profile field.
2. Stripe sends `checkout.session.completed` to `/api/stripe-webhook`.
3. The function **verifies the Stripe signature** (forged/unsigned → HTTP 400, no work done).
4. It fetches the business's public data from **Google Places API (New)** and reads the homepage for
   on-page signals (title, click-to-call, schema, HTTPS).
5. **OpenRouter** generates the audit as structured data; our template renders premium, email-safe HTML.
6. **Resend** emails the audit to the customer.
7. **If any step fails, the customer is NOT emailed.** You get a fallback alert with the order details
   + error so you can fulfill manually with `report-builder.html`.

## Manual fallback (only when you get a failure alert)
1. Open the fallback email from MapGap (it has the order context + error).
2. Confirm the order in Stripe.
3. Open `report-builder.html`, fill in findings from the customer's public Google profile + website.
4. Click **Update report**, then **Print → Save as PDF**, and email it to the customer.

## Good to know
- **Cost per audit:** ~$0.02–0.03 (OpenRouter) + Google Places (within free allowance) + Resend (free
  tier covers low volume). Effectively pennies against $249.
- **Speed / timeouts:** the function does the work before replying. If you ever see timeouts in the
  Netlify function logs, set `OPENROUTER_MODEL=google/gemini-2.5-flash` (faster) — no code change. A
  fully async background-worker design is written up in `PROPOSALS.md` (P2) if volume ever needs it.
- **Switching models** is just the `OPENROUTER_MODEL` env var.

## Guardrails (baked into the audit prompt; keep them in any future edits)
- Never guarantee rankings, Map Pack / 3-pack placement, calls, or revenue.
- Never claim the report is from or endorsed by Google.
- Never fabricate reviews, competitors, metrics, or testimonials. Unverifiable items are listed
  honestly in a "what we couldn't verify" section.
- Keep every finding tied to the business's real public data.
- On automation failure, fulfill manually — never ask the customer to debug their order.

## No-spam customer acquisition
Do not scrape, blast, fake reviews, or pretend to be Google. Small targeted batches only.
1. Pick one trade + one city.
2. Find ~20 businesses with obvious public gaps (old photos, no city/service wording, thin profile).
3. Send at most one plain email each. Offer the **free scorecard** first, not the paid audit.

Email draft:
```text
Subject: quick Google profile gap for [Business Name]

Hi [Owner/Team],

I was looking at local [trade] businesses in [city] and noticed one fixable issue: [specific issue].

I built a short scorecard that shows common Google profile, review, website, and missed-call gaps.
No login, no ranking promises: [your site URL]

If you want the paid version, it turns that into a ranked 30-day fix list for $249.

Best,
Avi
```

## First-week checklist
- [ ] Step 1–3 keys created (OpenRouter, Google Places New, Resend).
- [ ] **Run the quality gate (Step 8) and read the real samples.**
- [ ] Netlify site live with all required env vars; webhook route returns a method error on GET.
- [ ] Resend domain verified; test email arrives in a normal inbox (not spam).
- [ ] Stripe Payment Link created with the `google_business_profile_url` custom field.
- [ ] Stripe webhook endpoint added; signing secret in Netlify; redeployed.
- [ ] Payment link pasted into `config.js`, committed, pushed.
- [ ] One real test-mode checkout → confirm the customer email arrives.
- [ ] Send the first 20 targeted scorecard emails.
- [ ] Watch Stripe payments, Netlify function logs, and Resend logs after each order.
