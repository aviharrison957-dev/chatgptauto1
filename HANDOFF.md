# Handoff

Product: MapGap Report

Business model: sell a $249 one-time local presence audit to owner-operated service businesses. Optional follow-on: $149/month maintenance for Google Business Profile posting, review response drafts, and monthly checklist review.

## What Is Built

- Public site: `index.html`
- Free scorecard: client-side calculator in `assets/js/scorecard.js`
- Payment config: `assets/js/config.js`
- Automated paid-audit webhook: `netlify/functions/stripe-webhook.js`
- Netlify config and `/api/stripe-webhook` route: `netlify.toml`
- Manual fallback report builder: `report-builder.html`
- Live smoke-test scripts: `scripts/test-webhook-nosig.js` and `scripts/local-audit-smoke.js`
- Research and decision log: `JOURNAL.md` and `research/selection.md`

## Deployment Change

GitHub Pages is being retired for the primary deployment because it cannot run serverless functions. MapGap now needs Netlify so Stripe can call `/api/stripe-webhook` after payment and trigger the automated Google Places, Anthropic, and Resend fulfillment pipeline.

The old GitHub Pages URL can remain online temporarily, but the public sales link should move to the Netlify URL after setup.

## Required Owner Setup

### 1. Create The Netlify Site

1. Go to https://app.netlify.com and sign in.
2. Click **Add new site** then **Import an existing project**.
3. Connect GitHub and select `aviharrison957-dev/chatgptauto1`.
4. Use these build settings:
   - Build command: leave blank
   - Publish directory: `.`
   - Functions directory: Netlify will read `netlify.toml` and use `netlify/functions`
5. Deploy the site.
6. Confirm the home page returns 200 at the Netlify URL.
7. Confirm the webhook route exists by opening:

```text
https://YOUR-NETLIFY-SITE.netlify.app/api/stripe-webhook
```

It should not show the homepage. A browser GET should return a method error because Stripe will POST to this endpoint.

### 2. Add Netlify Environment Variables

In Netlify, open **Site configuration** then **Environment variables**. Add these:

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe Dashboard > Developers > API keys > Secret key | Use the live key after Stripe account verification. Starts with `sk_live_`. |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard > Developers > Webhooks > the Netlify endpoint > Signing secret | Starts with `whsec_`. Create the webhook endpoint first in Step 4. |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console > APIs & Services > Credentials | Enable **Places API (New)** on the project and restrict the key after testing. |
| `ANTHROPIC_API_KEY` | Anthropic Console > API Keys | The function defaults to `claude-sonnet-4-20250514`, the current documented Sonnet 4 API model checked during this session. |
| `RESEND_API_KEY` | Resend Dashboard > API Keys | Use a key allowed to send production email. |
| `AVI_FALLBACK_EMAIL` | Avi's email address | Failure alerts go here. Customers are not emailed if automation fails. |

Optional but recommended later:

- `ANTHROPIC_MODEL`: set this only if Anthropic replaces the default model and you want to pin a newer one without code changes.

After adding or changing environment variables, trigger a new Netlify deploy.

### 3. Configure Resend Sending

1. Go to https://resend.com and create or open the account.
2. Add a sending domain Avi controls.
3. Complete the DNS records Resend gives you.
4. Confirm the domain is verified.
5. Create `RESEND_API_KEY`.

The function currently sends from `MapGap Report <onboarding@resend.dev>` for zero-extra-config testing. For real customer delivery, replace the `from` value in `netlify/functions/stripe-webhook.js` with a verified sender on Avi's domain, then commit and push.

### 4. Create Stripe Payment Link

1. Go to https://stripe.com and create or open the Stripe account.
2. Complete Stripe's business and identity steps.
3. In Stripe Dashboard, open **Payment Links**.
4. Create a one-time product:
   - Name: `MapGap Report`
   - Price: `$249`
   - Type: one-time payment
5. Add a required custom field:
   - Type: text
   - Label: `Google Business Profile URL`
   - Field key: `google_business_profile_url`
   - Required: yes
   - Help text: `Paste your Google Business Profile / Google Maps URL or Place ID.`
6. Require customer email collection.
7. Set confirmation text:

```text
Thanks. Your order is in. Your MapGap Report will be emailed after checkout.
```

8. Copy the live payment link.
9. Optional: create a recurring product:
   - Name: `MapGap Maintenance`
   - Price: `$149/month`
   - Type: recurring subscription

### 5. Paste Stripe Links Into The Site

Edit `assets/js/config.js`:

```js
window.MAPGAP_CONFIG = {
  auditPaymentUrl: "PASTE_STRIPE_249_LINK_HERE",
  maintenancePaymentUrl: "PASTE_STRIPE_149_MONTHLY_LINK_HERE",
  contactEmail: "PASTE_AVI_EMAIL_HERE"
};
```

Commit and push:

```powershell
git add assets/js/config.js
git commit -m "Activate payment links"
git push
```

Netlify should redeploy automatically from `origin/main`.

### 6. Create Stripe Webhook Endpoint

1. In Stripe Dashboard, open **Developers** then **Webhooks**.
2. Click **Add endpoint**.
3. Endpoint URL:

```text
https://YOUR-NETLIFY-SITE.netlify.app/api/stripe-webhook
```

4. Select this event only:

```text
checkout.session.completed
```

5. Save the endpoint.
6. Open the endpoint details and copy the signing secret.
7. Put that value into Netlify as `STRIPE_WEBHOOK_SECRET`.
8. Redeploy the Netlify site.

## How Automated Fulfillment Works

1. Customer clicks **Buy the audit**.
2. Stripe Checkout collects payment, email, and the required Google Business Profile URL field.
3. Stripe sends `checkout.session.completed` to Netlify at `/api/stripe-webhook`.
4. The function verifies the Stripe signature.
5. The function fetches public Place Details from Google Places API (New).
6. Anthropic generates a concise, email-safe HTML audit.
7. Resend emails the audit directly to the customer.
8. If any step fails, the customer is not emailed. Avi gets a failure email with the order context and can use `report-builder.html` manually.

## Manual Fallback

Use this only when the automated pipeline fails.

1. Open the fallback email from MapGap.
2. Confirm the order in Stripe.
3. Open `report-builder.html`.
4. Use the order context and public Google profile/website to fill the fields.
5. Click **Update report**.
6. Click **Print** and save as PDF.
7. Send the report to the customer.

## Tests

Local verification that does not need secrets:

```powershell
npm run test:webhook-nosig
```

Expected result:

```text
statusCode=400
{"error":"Invalid Stripe webhook signature"}
```

Live audit-generation smoke test after adding real keys locally:

```powershell
$env:GOOGLE_PLACES_API_KEY="..."
$env:ANTHROPIC_API_KEY="..."
npm run test:audit-live
```

Expected result: a known Place ID is fetched and the script prints a non-zero `htmlLength`. This confirms the Google Places plus Anthropic audit-generation path produces HTML. It does not send email.

Production webhook test after Netlify and Stripe are configured:

1. In Stripe webhook settings, send a test `checkout.session.completed` event.
2. If the test event has no custom field, expect an Avi fallback email.
3. Complete a real test-mode Checkout with the custom field to verify customer email delivery.

## No-Spam Customer Acquisition

Do not scrape, blast, fake reviews, or pretend to be Google. Use small batches.

Weekly operating loop:

1. Pick one trade and one borough or city.
2. Find 20 businesses with obvious public gaps: old photos, no review responses, unclear website city/service wording, or weak phone follow-up language.
3. Send at most one plain email per business. Stop if they do not reply.
4. Offer the free scorecard first, not the paid audit first.

Email draft:

```text
Subject: quick Google profile gap for [Business Name]

Hi [Owner/Team],

I was checking local [trade] businesses in [city] and noticed one fixable issue: [specific issue].

I built a short scorecard that shows the common Google profile, review, website, and missed-call gaps. No login and no ranking promises:
[deployed URL]

If you want the paid version, I turn the scorecard into a ranked 30-day fix list for $249.

Best,
Avi
```

## Guardrails

- Do not guarantee rankings, calls, revenue, or Google 3-Pack placement.
- Do not say the report is endorsed by Google.
- Do not write fake reviews or ask anyone else to.
- Do not advise on legal, medical, tax, lending, insurance, or regulated claims.
- Keep every finding tied to visible public facts or customer-provided information.
- If automation fails, fulfill manually from the fallback email instead of asking the customer to debug the order.

## First Week Checklist

- Create and deploy the Netlify site from this repo.
- Add all required Netlify environment variables.
- Verify Resend can send to a real external customer email from a verified sender.
- Create the Stripe Payment Link with the required `google_business_profile_url` custom field.
- Add the Stripe webhook endpoint and signing secret.
- Paste the live Stripe Payment Link into `assets/js/config.js`, commit, and push.
- Run `npm run test:webhook-nosig`.
- Run `npm run test:audit-live` with real Google and Anthropic keys.
- Send 20 targeted scorecard emails.
- Monitor Stripe payments, Netlify function logs, and Resend logs after each order.
