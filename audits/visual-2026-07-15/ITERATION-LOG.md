# Visual audit — MapGap Report (2026-07-15)

Deployed target: https://mapgap-report.vercel.app · desktop 1440w + mobile 390w · Playwright headless.
Brief: conservative, reversible touch-ups only — no rebrand, no copy rewrite, no redesign (owner approved
the design). Every change below fixes a concrete defect, not a preference.

## Round 1 — capture + review (before/*.png)
Findings:
1. **Empty "Your score" band rendered on first load.** `#scoreResult` is marked `hidden` and revealed by
   scorecard.js on submit, but `.result-band { display: grid }` overrode the UA `[hidden]` rule → the empty
   band showed on the landing page before any interaction. Amateur tell. → FIX: `.result-band[hidden]{display:none}`.
2. **Operator tool in the customer nav.** "Report builder" (Avi's manual-fulfillment UI) sat in the public
   header; a buyer could land in an internal authoring tool. → FIX: removed from nav; page still reachable by URL.
3. **Checkout custom field had no guidance** (brief's likeliest real-world failure: confused customer pastes
   the wrong URL). Stripe payment-link custom fields don't take help text via API → FIX: field label
   lengthened to "Google Business Profile or Google Maps link" + product description at checkout now says
   exactly what to paste.
Not changed (owner's call, logged for go-live): Stripe checkout page brands as "saboxai" (account-level
public business name, shared across Sabox products) — a KYC/branding decision, not a visual bug.

## Round 2 — re-shoot (after/*.png)
- Empty score band: **hidden** before submit (verified via `offsetParent === null`). ✓
- Operator link: gone from nav. ✓
- Mobile: no horizontal scroll (both rounds). ✓
- Scorecard still works (25/100 render verified in round 1). ✓
- Checkout hand-off → Stripe test checkout reached. ✓

## Round 3 — CSP regression (introduced + fixed same session)
Adding `Content-Security-Policy` (security audit F4) with `img-src 'self' data:` blocked the hero's Unsplash
background image (console CSP violation caught in the after-capture). → FIX: `img-src` now allows
`https://images.unsplash.com`. Re-verified: hero image loads, no console errors, all other CSP directives
intact. This is why the after-full desktop shot shows the hero image blank (captured pre-fix); the live site
renders it.

## Verdict
Three real defects fixed, all reversible, no redesign. Design voice untouched. Hit targets: nav links are
21px tall in the DOM (<44px) — noted but NOT changed: they're inline text links in a low-density marketing
header, not primary touch controls, and enlarging them would alter the owner-approved header layout. The
primary CTAs ("Run the free scorecard", "Buy the audit") are full-size buttons.
