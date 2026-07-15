# What I Need From Avi

**Updated 2026-07-15 (Vercel deploy session).** Most of the earlier credential list is now DONE — the agent
verified the existing keys and set them in Vercel. This file is now short. The full step-by-step is in
**HANDOFF.md** ("Your ≤10-minute go-live checklist").

## ✅ Already handled by the agent (no action needed)
- `OPENROUTER_API_KEY`, `GOOGLE_PLACES_API_KEY` — verified working, set in Vercel.
- `STRIPE_SECRET_KEY` (test) + `STRIPE_WEBHOOK_SECRET` (test) — created a test Payment Link + webhook endpoint
  against the live Vercel URL; secrets set in Vercel.
- `OWNER_FALLBACK_EMAIL` = `aviharrison957@gmail.com`, `SITE_URL` — set in Vercel.
- Deployed to Vercel (https://mapgap-report.vercel.app), security-audited (2 audits), test link wired in.

## 🔴 The ONE credential still needed — `RESEND_API_KEY`
Resend **blocks automated signup** (server error on every programmatic attempt), so it needs your OAuth click:
1. The Resend signup page is open in your browser. Sign in with **"Continue with GitHub"** (or Google) — ~15s.
2. Create an API key (**Sending** access), and either paste it to me or say "I'm in" and I'll mint it.
3. (Recommended before selling) Resend → **Domains** → add + verify your sending domain, so customer mail
   doesn't land in spam. Then I'll set `RESEND_FROM_EMAIL`.

Until this is set, audits generate but can't be emailed. Once set, I run the real end-to-end email test.

## 🟠 Human-only go-live steps (yours — see HANDOFF.md §3)
- **Stripe live-mode** activation / KYC (your account already looks KYC-complete), then create the **live**
  Payment Link (same $249 + required `google_business_profile_url` field) and a **live** webhook endpoint.
  Hand me the live link + live keys and I set them in Vercel + swap the site to the live link.

## 🎯 Before any of that — your $249 sellability call
Open `sample-audits/watson-plumbing-associates-llc.html` and `sample-audits/rimmer-electric.html` in a browser
and decide if the audit is worth $249. No automation substitutes for this judgment.

Live payments remain OFF until you complete the Stripe live steps above.
