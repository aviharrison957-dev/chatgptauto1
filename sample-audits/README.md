# sample-audits/

This folder is for **real** generated audits — the quality gate for the whole product.

## Status: EMPTY ON PURPOSE — audit quality is currently UNVERIFIED

Generating a real sample requires two live keys that were **not available** in the build
environment, so no samples could be produced honestly:

- `OPENROUTER_API_KEY` — the model that writes the audit
- `GOOGLE_PLACES_API_KEY` — the real business data the audit is about

Both are listed as Tier-1 blockers in [`../NEEDS_FROM_AVI.md`](../NEEDS_FROM_AVI.md).

**No samples were faked or hand-written.** Real outputs or none.

## Generate the real samples (≈1 minute once you have the keys)

```bash
cd ..
OPENROUTER_API_KEY="sk-or-..." GOOGLE_PLACES_API_KEY="AIza..." npm run generate:samples
```

This fetches 3 real, well-known service businesses, runs the actual pipeline, and writes
`<business>.html` + `<business>.analysis.json` here. Open the `.html` files in a browser and
judge whether they're worth $249. If they aren't, tell me and I'll tune the prompt before you sell.

You can audit specific businesses instead of the defaults:

```bash
OPENROUTER_API_KEY=... GOOGLE_PLACES_API_KEY=... node scripts/generate-samples.js "Your Plumber, City, ST" "ChIJ...placeID"
```

## Want to see the visual design right now (no keys)?

Open [`../design-preview/audit-template-preview.html`](../design-preview/audit-template-preview.html)
in a browser. That is the **template only**, filled with clearly-labeled synthetic placeholder data —
it shows the layout/design, not real audit quality.
