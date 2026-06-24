# sample-audits/

This folder is for **real** generated audits — the quality gate for the whole product.

## Status: REAL audits generated — quality under active review (realistic targets)

These are **real** pipeline outputs (live Google Places data + live model), never faked or hand-written.

- **Active quality test (this folder):** 5 audits for *realistic* targets — small, single-location,
  owner-operated local service businesses (electrical, plumbing, locksmith, lawn, HVAC) with **visibly
  rough** Google profiles (low review counts, missing hours/photos, no real website or only a social page).
  These resemble the actual paying customer. See `../JOURNAL.md` (2026-06-24) for the target list + why
  each qualifies, and `../QUALITY_REVIEW.md` for the three-way buyer's-eye assessment.
- **Archived:** the first 3 audits were national chains (Jiffy Lube / Roto-Rooter / One Hour Heating).
  Their profiles are near-perfect, so the audits came back thin — useful to prove the engine is *honest*,
  but not a fair test of whether the product is *sellable*. Moved to `archive-national-chains/`.

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
