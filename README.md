# MapGap Report

Previous GitHub Pages URL: https://aviharrison957-dev.github.io/chatgptauto1/

Primary deployment target: Netlify. GitHub Pages cannot run the Stripe webhook function required for automated fulfillment.

MapGap Report sells a one-time local presence audit for owner-operated service businesses.

## Product

- Public sales page: `index.html`
- Free local gap scorecard: `assets/js/scorecard.js`
- Operator report builder: `report-builder.html`
- Automated Stripe webhook: `netlify/functions/stripe-webhook.js`
- Payment config: `assets/js/config.js`
- Handoff instructions: `HANDOFF.md`

## Payment Status

The checkout button is wired to `assets/js/config.js`. Avi must create a live Stripe Payment Link with the required `google_business_profile_url` custom field and paste it into `auditPaymentUrl` before customers can pay.

## Fulfillment Status

Paid fulfillment is designed for Netlify Functions:

- Stripe calls `/api/stripe-webhook`.
- The function verifies the webhook signature.
- Google Places API (New) fetches public business data.
- Anthropic generates the HTML audit.
- Resend emails the audit directly to the customer.
- Failures email Avi only so `report-builder.html` can be used as the fallback.

## Local Preview

Open `index.html` in a browser for the static frontend. Run local function tests with:

```powershell
npm run test:webhook-nosig
```
