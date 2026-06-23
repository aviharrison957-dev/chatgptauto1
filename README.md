# MapGap Report

A $249 one-time local-presence audit for owner-operated local service businesses (HVAC, plumbing,
locksmith, pest control, landscaping, auto repair). The customer pays, provides their Google Business
Profile link, and is automatically emailed a specific, prioritized audit — no human in the loop.

**Primary deployment target: Netlify** (GitHub Pages can't run the Stripe webhook function).
Previous GitHub Pages URL: https://aviharrison957-dev.github.io/chatgptauto1/

## Layout

- Public sales page: `index.html` (+ `assets/`)
- Free local gap scorecard: `assets/js/scorecard.js`
- Payment link config (paste 1 Stripe URL): `assets/js/config.js`
- Webhook entry point: `netlify/functions/stripe-webhook.js`
- Pipeline modules: `netlify/functions/lib/*.js`
- Manual fallback report tool: `report-builder.html`
- Quality gate (real samples): `scripts/generate-samples.js` → `sample-audits/`
- **Owner setup, step by step: `HANDOFF.md`** · Credential checklist: `NEEDS_FROM_AVI.md`

## Automated fulfillment

Stripe `checkout.session.completed` → verify signature (invalid → HTTP 400) → Google Places API (New)
for the business data → read the homepage for on-page signals → **OpenRouter** generates the audit as
structured JSON → our template renders email-safe HTML → **Resend** emails it to the customer. Any
failure emails the owner (`OWNER_FALLBACK_EMAIL`) for manual fulfillment instead of sending the
customer a broken report.

The AI provider is OpenRouter (`OPENROUTER_API_KEY`); the model is configurable via `OPENROUTER_MODEL`
(default `anthropic/claude-sonnet-4.5`). Full env-var list is in `HANDOFF.md`.

## Status

Code-complete. **Audit quality is UNVERIFIED until real samples are generated** — that needs
`OPENROUTER_API_KEY` + `GOOGLE_PLACES_API_KEY` (see `NEEDS_FROM_AVI.md`). No samples were faked.

## Local checks

```bash
npm test                 # offline unit + webhook tests (no keys)
npm run preview:template # writes design-preview/audit-template-preview.html (synthetic data)

# with keys:
OPENROUTER_API_KEY=... GOOGLE_PLACES_API_KEY=... npm run generate:samples
```
