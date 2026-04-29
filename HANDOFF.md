# Handoff

Product: MapGap Report

Business model: sell a $249 one-time local presence audit to owner-operated service businesses. Optional follow-on: $149/month maintenance for Google Business Profile posting, review response drafts, and monthly checklist review.

## What Is Built

- Public site: `index.html`
- Free scorecard: client-side calculator in `assets/js/scorecard.js`
- Payment config: `assets/js/config.js`
- Operator report builder: `report-builder.html`
- Research and decision log: `JOURNAL.md` and `research/selection.md`

## Required Owner Setup

### 1. Create Stripe Payment Links

1. Go to https://stripe.com and create a Stripe account.
2. Complete Stripe's business and identity steps.
3. In Stripe Dashboard, open **Payment Links**.
4. Create a one-time product:
   - Name: `MapGap Report`
   - Price: `$249`
   - Type: one-time payment
   - Confirmation text: `Thanks. Your order is in. Reply to the order email with your business name, website, Google Business Profile link, main city, and top concern.`
5. Copy the live payment link.
6. Optional: create a recurring product:
   - Name: `MapGap Maintenance`
   - Price: `$149/month`
   - Type: recurring subscription

### 2. Paste Stripe Links Into The Site

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

### 3. Fulfill A Paid Audit

1. Confirm payment in Stripe.
2. Collect these fields from the customer by email:
   - Business name
   - Website URL
   - Google Business Profile URL
   - Main service city
   - Main services
   - Top concern
   - Best phone number
3. Open `report-builder.html`.
4. Review the public profile, website, reviews, and visible listings.
5. Paste findings into the builder.
6. Click **Update report**.
7. Click **Print** and save as PDF.
8. Send the PDF to the customer.

Target fulfillment time after practice: 25-40 minutes per paid audit.

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

## First Week Checklist

- Add live Stripe Payment Link to `assets/js/config.js`.
- Send 20 targeted scorecard emails.
- Fulfill any paid audit within 24 hours.
- Keep a simple spreadsheet with business name, URL, issue found, email sent date, reply, and outcome.
- After the first 3 audits, revise the report builder based on repeated questions.
