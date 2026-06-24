# What I Need From Avi

This is the **single, consolidated list** of things only you can provide. Everything in the code
is already written to read these from environment variables — nothing here is a code gap, it's an
account/credential gap. Work the list top to bottom: the first two items unblock the **quality
gate** (proof the audit is actually good); the rest unblock **going live**.

Each item says: the exact variable name, what it's for, exactly where to get it, and what it blocks.

---

## 🔴 TIER 1 — Blocks the QUALITY GATE (do these first)

Until these two exist, `sample-audits/` is empty and **audit quality is UNVERIFIED**. The whole
product stands or falls on the audit not reading like generic ChatGPT output, and the only honest
way to prove that is to run the real pipeline against real businesses. I refused to fake samples.

### 1. `OPENROUTER_API_KEY`  ← generates the audit
- **What it's for:** Calling the AI model (via OpenRouter) that writes each audit's analysis.
- **Where to get it:**
  1. Go to https://openrouter.ai and sign in (Google/GitHub login works).
  2. Add a little credit: **Settings → Credits** (a few dollars is plenty — each audit costs
     ~$0.02–0.03 with the default model).
  3. Open **https://openrouter.ai/keys** → **Create Key** → copy it (starts with `sk-or-`).
- **Blocks:** All audit generation. Without it the pipeline emails you the fallback alert instead
  of emailing the customer. Also blocks the quality gate.
- **Optional partner var `OPENROUTER_MODEL`:** leave unset to use the vetted default
  `anthropic/claude-sonnet-4.5`. Set it only to switch models (e.g. `google/gemini-2.5-flash`
  for lower latency/cost, or `anthropic/claude-sonnet-4.6` for the newest). No code change needed.

### 2. `GOOGLE_PLACES_API_KEY`  ← fetches the real business data
- **What it's for:** Pulling the customer's public Google Business Profile data (name, rating,
  review count, recent reviews, hours, photos, category, website) via **Places API (New)**.
- **Where to get it:**
  1. Go to https://console.cloud.google.com and create/select a project.
  2. **APIs & Services → Library** → search **"Places API (New)"** → **Enable**. (Make sure it's
     the one literally named *Places API (New)* — not the legacy "Places API".)
  3. **APIs & Services → Credentials → Create credentials → API key** → copy it.
  4. You'll need billing enabled on the project (Google gives a large free monthly Places quota;
     at your volume this is effectively free).
  5. After testing, restrict the key to the **Places API (New)** to be safe.
- **Blocks:** All data fetching → all audits. Also blocks the quality gate.

### ▶ Once you've set BOTH Tier-1 keys, run the quality gate (≈1 minute):

**Easiest — put the keys in a file.** In the project folder
(`/Users/avi/Desktop/claudemac/chatgptauto1`), copy `.env.example` to `.env` and paste your keys in:
```bash
cd chatgptauto1
cp .env.example .env        # then open .env and paste your keys after the = signs
npm run generate:samples
```
`.env` is gitignored, so it is never committed. (Prefer not to use a file? Pass them inline instead:
`OPENROUTER_API_KEY="sk-or-..." GOOGLE_PLACES_API_KEY="AIza..." npm run generate:samples`.)

> Note: this `.env` file is for **local testing on your Mac only**. For the live site, the same keys go
> in the **Netlify dashboard** (Site configuration → Environment variables), not in any file — see HANDOFF.md.
This fetches 3 real, well-known businesses, generates real audits, and writes them to
`sample-audits/`. Open those HTML files in a browser and judge the quality yourself. If they're
not worth $249, tell me and I'll tune the prompt before you sell anything.

---

## 🟠 TIER 2 — Blocks GOING LIVE (real customers, real emails)

### 3. `RESEND_API_KEY`  ← emails the audit to the customer
- **What it's for:** Sending the finished audit (and failure alerts to you) via Resend.
- **Where to get it:**
  1. Go to https://resend.com and sign in.
  2. **API Keys → Create API Key** (Sending access) → copy it (starts with `re_`).
- **Blocks:** Delivery. Without it, audits generate but can't be sent.

### 4. `RESEND_FROM_EMAIL`  ← the "from" address customers see  *(strongly recommended)*
- **What it's for:** The verified sender address on your own domain.
- **Where to get it:**
  1. In Resend: **Domains → Add Domain**, add a domain you control.
  2. Add the DNS records Resend gives you; wait for "Verified".
  3. Set `RESEND_FROM_EMAIL` to e.g. `MapGap Report <reports@yourdomain.com>`.
- **Blocks:** Nothing technically — the code falls back to Resend's shared `onboarding@resend.dev`
  sender for testing — but **real customer delivery needs a verified domain** or audits will land
  in spam / be rate-limited. Do this before you sell.

### 5. `OWNER_FALLBACK_EMAIL`  ← where failure alerts go
- **What it's for:** If anything in the pipeline fails, the customer is NOT emailed a broken
  report; instead you get an email with the order details + error so you can fulfill manually with
  `report-builder.html`.
- **Where to get it:** Just your email address, e.g. `aviharrison957@gmail.com`.
- **Blocks:** Your safety net. If unset, failures can't alert you. (Legacy name
  `AVI_FALLBACK_EMAIL` also still works, but prefer `OWNER_FALLBACK_EMAIL`.)

### 6. `STRIPE_SECRET_KEY`  ← lets the webhook read full order details
- **What it's for:** Re-fetching the completed Checkout session to read the customer email + the
  Google Business Profile custom field reliably.
- **Where to get it:** Stripe Dashboard → **Developers → API keys → Secret key** (`sk_live_...`
  for production, `sk_test_...` while testing).
- **Blocks:** Reliable extraction of the order (the webhook hydrates the session via this key).

### 7. `STRIPE_WEBHOOK_SECRET`  ← verifies the webhook is really from Stripe
- **What it's for:** Validating the Stripe signature; unsigned/forged requests are rejected with
  HTTP 400.
- **Where to get it:** Create the webhook endpoint first (HANDOFF.md → "Create Stripe Webhook
  Endpoint"), then Stripe Dashboard → **Developers → Webhooks → [your endpoint] → Signing secret**
  (`whsec_...`).
- **Blocks:** The webhook rejects everything until this matches the real signing secret.

---

## 🟡 TIER 3 — Deploy + payment setup (mostly dashboard clicks, no code)

### 8. Netlify site + (optional) `NETLIFY_AUTH_TOKEN` / `NETLIFY_SITE_ID`
- **What it's for:** Hosting. GitHub Pages can't run the serverless webhook; Netlify can. I could
  not deploy from this session because no Netlify token was present.
- **What to do:** Follow HANDOFF.md → "Create The Netlify Site" (connect the GitHub repo, deploy,
  add the env vars above). No tokens needed if you do it in the Netlify UI. Only provide
  `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID` if you want a future agent to deploy via CLI.
- **Blocks:** The live URL and the webhook endpoint existing at all.

### 9. Stripe Payment Link + custom field  (dashboard config, then paste one URL)
- **What it's for:** Collecting payment + the customer's email + their Google Business Profile URL.
- **What to do:** Follow HANDOFF.md → "Create Stripe Payment Link". The custom field MUST use
  field key `google_business_profile_url` (the webhook looks for it; it also accepts a few
  aliases). Then paste the link into `assets/js/config.js` → `auditPaymentUrl`, commit, push.
- **Blocks:** Customers being able to pay and the webhook knowing which business to audit.

---

## Summary table

| # | Variable / action | Tier | Blocks |
|---|---|---|---|
| 1 | `OPENROUTER_API_KEY` | 🔴 | Audit generation + quality gate |
| 2 | `GOOGLE_PLACES_API_KEY` | 🔴 | Data fetch + quality gate |
| 3 | `RESEND_API_KEY` | 🟠 | Email delivery |
| 4 | `RESEND_FROM_EMAIL` | 🟠 | Deliverable not landing in spam |
| 5 | `OWNER_FALLBACK_EMAIL` | 🟠 | Failure alerts to you |
| 6 | `STRIPE_SECRET_KEY` | 🟠 | Reading the order |
| 7 | `STRIPE_WEBHOOK_SECRET` | 🟠 | Verifying the webhook |
| 8 | Netlify site (+ optional tokens) | 🟡 | Hosting + endpoint |
| 9 | Stripe Payment Link + custom field | 🟡 | Taking payment |

Once Tier 1 is done and the samples look good, and Tier 2 + Tier 3 are set in Netlify, the product
is live. Full step-by-step is in **HANDOFF.md**.
