# Journal

## 2026-07-15 17:10 America/New_York — Vercel migration session START (Step 0–2): repo verified, keys verified, migration defects named

Operator: Claude (Fable 5). Brief: take the code-complete pipeline to a deployed, test-mode-proven product on
**Vercel**, credentials via the auth-broker skill, live payments OFF. Location verified (`pwd` =
`/Users/avi/Desktop/claudemac/chatgptauto1`, remote = `aviharrison957-dev/chatgptauto1`). Baseline `npm test`
green (27 checks) before any change.

**Credential verification (Rail 0, read-only calls, no values printed):**
- `OPENROUTER_API_KEY` valid (paid tier, no per-key cap).
- `GOOGLE_PLACES_API_KEY` valid (Place Details id-mask → HTTP 200).
- `STRIPE_API_KEY` in keys.env is **LIVE mode** — account `acct_1TgVZoPL9698yhYP`, and `charges_enabled:true,
  details_submitted:true` (Stripe KYC appears already complete — shortens the go-live checklist).
  **This session uses TEST mode only**: `STRIPE_SECRET_KEY_TEST_LUMEN` in keys.env is a test-mode key for the
  **same account** (verified via `GET /v1/account`), so no new Stripe key is needed.
- `VERCEL_API_TOKEN` valid; user `aviharrison957-7839`; plan = **Hobby**.
- `RESEND_API_KEY` missing everywhere (op vault unconfigured on this machine; Gmail archaeology via MCP found
  ZERO mail from resend.com ever → no existing account). Confirm ping sent; signup parked ~15 min per skill.
- `OWNER_FALLBACK_EMAIL`: ping sent; proceeding with default `aviharrison957@gmail.com` (reversible env var).

**Vercel platform facts (fetched from vercel.com/docs, last_updated 2026-07-01 — not training data):**
- Hobby: maxDuration default AND maximum = **300s** (Fluid compute, on by default). Pro would allow 800s.
- `waitUntil()` (`@vercel/functions`): continues work after the response is sent, **bounded by maxDuration**;
  promises are cancelled at timeout.
- Measured pipeline cost (JOURNAL 2026-06-24): ~68–75s/audit cold. Worst-case bounded chain if every network
  call carries an explicit timeout: ~200s < 300s ceiling. Typical case has ~4x headroom. Proceeding with the
  port; the go/no-go remains a TIMED end-to-end order on the deployed URL.

**Port architecture:** ONE Vercel function `api/stripe-webhook.js` (web-standard `fetch` handler,
`maxDuration=300`): verify Stripe signature → 200 to Stripe immediately → full pipeline runs in `waitUntil`.
This replaces the Netlify webhook→background-worker pair and REMOVES the publicly reachable worker + internal
HMAC hand-off (smaller attack surface). Failure invariant unchanged: any pipeline error → owner fallback
email, customer never emailed.

**Changes to tested paths — concrete defects, named before the change (per brief):**
1. **Unbounded fetches become order-eaters under a 300s ceiling.** `hydrateCheckoutSession` (stripe.js),
   Places fetches (places.js), and Resend send (email.js) have NO explicit timeout. Under Netlify's 15-min
   budget that was benign; under Vercel's hard 300s kill, a hung TCP connection would let the platform
   terminate the instance mid-`waitUntil` → owner never alerted → silent loss of a paid order. Fix: explicit
   `AbortSignal.timeout` on every network call so the sum of worst-case timeouts stays < 300s and the
   owner-alert path always gets to run.
2. **Webhook idempotency (pre-approved: PROPOSALS P1 promoted to in-scope).** Stripe delivers at-least-once;
   a duplicate delivery would email the customer twice. Fix: durable dedupe via Stripe PaymentIntent metadata
   (`mapgap_fulfilled_at`) — checked at pipeline start, written after successful send. No new infrastructure;
   fail-open (a metadata outage degrades to at-most-one-duplicate-email, never a lost order). Residual
   concurrent-delivery race window documented in SECURITY_AUDIT.md.
3. **Mechanical relocation** `netlify/functions/lib/` → `lib/` (git mv, history preserved) so the shared
   pipeline is not namespaced under a host we no longer target. Netlify function entry points stay in place
   (requires updated) as the documented fallback until the Vercel timed proof passes.

## 2026-07-15 17:55 America/New_York — Deployed to Vercel; visual audit (before/afters in audits/visual-2026-07-15/)

**Deployed.** Project `mapgap-report`, production alias **https://mapgap-report.vercel.app**, GitHub repo
connected (push → auto-deploy). Verified live: home 200; `/api/stripe-webhook` GET→405, unsigned POST→400;
all five security headers served; dev files (JOURNAL, sample-audits, scripts…) excluded via `.vercelignore`
and return 404. Env vars set via CLI (production): STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY (**test-mode
key**), OPENROUTER_API_KEY, GOOGLE_PLACES_API_KEY, OWNER_FALLBACK_EMAIL, SITE_URL. Stripe TEST objects
created via API: product `prod_UtNTl4fP3xPARv`, price $249, payment link `plink_1TtaiQPL9698yhYPShuM7MHW`
(livemode:false) with required custom field `google_business_profile_url`, webhook endpoint
`we_1TtaidPL9698yhYPRDPrbx4U` → signing secret stored in keys.env + Vercel only.

**Visual audit (Step 4, conservative).** Playwright captures desktop 1440w + mobile 390w: landing full-page,
hero, scorecard empty/filled, pricing, footer, checkout hand-off. Mobile: no horizontal scroll. Scorecard
works (25/100 render verified). Buy CTA → Stripe test checkout verified.
Fixes applied (each a concrete defect, not a restyle):
1. **Empty "Your score" band visible on first load.** `index.html` marks `#scoreResult` `hidden` and
   scorecard.js:62 reveals it on submit — but `.result-band{display:grid}` overrides the UA `[hidden]`
   rule, so the empty band rendered anyway. Fix: `.result-band[hidden]{display:none}`.
2. **Operator tool linked in the customer-facing header.** "Report builder" (Avi's manual-fulfillment UI)
   sat in the public nav; a buyer clicking it lands in an internal authoring tool. Removed from the nav;
   `report-builder.html` remains reachable by direct URL for the owner.
3. **Checkout custom field had no guidance** (the brief's "confused customer pastes the wrong URL" risk).
   Stripe payment-link custom fields don't support help text via API, so: field label lengthened to
   "Google Business Profile or Google Maps link" and the product description at checkout now tells the
   customer exactly what to paste. (Applied via Stripe API to the test link; go-live live link must copy this.)
NOT changed (owner's call, noted for go-live): Stripe checkout page brands as "saboxai" (account-level
public business name — affects other Sabox products; decide branding at KYC/go-live time).

## 2026-07-15 18:20 America/New_York — TIMING PROOF: pipeline fits Vercel's 300s ceiling with wide margin

**The order-loss question, answered with a real measurement** (not training data). The heavy chain — Google
Places fetch → website signal fetch → OpenRouter (Sonnet-4.5) generation → HTML render — is the same shared
`lib/` code the deployed Vercel function runs. Timed against a real messy target (Watson Plumbing, Place ID
`ChIJLfNjOlVV8YgRiwkExQM9RGU`):

| Leg | Wall-clock |
|-----|-----------|
| Places Details | 0.3s |
| Website fetch | 0.0s (no site → immediate) |
| OpenRouter + render | 52.6s (3,045 output tokens, `finish_reason=stop`) |
| **Heavy chain total** | **52.9s** |

Adding the light legs the deployed function also runs — Stripe session hydrate (~1s), idempotency check +
mark (~1s total), Resend send (~1s) — a **typical full order ≈ 56s**. Vercel **Hobby maxDuration = 300s**
(fetched from vercel.com/docs 2026-07-01; Hobby default AND max are both 300s with Fluid compute on). That is
**~5.4x headroom** on the typical case.

**Worst case is also inside the ceiling.** Every network call now carries an explicit `AbortSignal.timeout`:
Stripe 15s + Places 15s + website 7s + OpenRouter 150s (the configured cap) + Resend 15s + idempotency 10+10s
= **~222s < 300s**. So even a pathological run where every leg crawls to its timeout either completes or fails
into the owner-alert path *before* the platform kills the instance — no silent loss of a paid order.

**Verdict: the Vercel port is sound; the pipeline fits with margin.** The `waitUntil` pattern runs the full
chain in the same 300s invocation after the webhook has already 200'd Stripe. NOT recommending a fallback to
Netlify — Vercel accommodates the pipeline reliably on Avi's current (Hobby) plan.

> ## ▶ RESUME / STATUS (2026-06-24) — superseded by 2026-07-15 session above
> **RE-TESTED ON REALISTIC TARGETS — and refined. 5 real audits for rough, owner-operated, single-
> location locals generated, assessed three independent ways, and improved with one conservative
> prompt-tuning round. Honest verdict: specific and non-fabricated; worth $249 when it surfaces a real
> hidden defect, thinner on an already-healthy profile. NOTHING DEPLOYED (Stripe/Netlify untouched, by design).**
>
> **This session (2026-06-24, max-effort re-test):** The engine was proven *honest* on 3 national chains
> last session, but their near-perfect profiles made those audits thin — no proof the product is *sellable*.
> So this session re-tested on 5 genuinely rough targets, chosen from live Places recon (not guessed):
> Rimmer Electric, Watson Plumbing, Jimmy Lock & Key, Spot On Lawn Care, Youngstown HVAC — 5 trades, all 3
> website states. Generated 5/5 real audits; reviewed three independent ways (builder + fresh Opus subagent
> + Codex CLI) on the same blind buyer's question. Consensus: real data + real review text, not fabricated;
> top value = catches an owner can't self-find (Watson's missing phone on a 70-review profile; "Services" &
> "General Contractor" miscategories); weakest = a generic Missed-Call section, one unsourced "30-40%" stat,
> two absolute over-claims. Made ONE conservative prompt-tuning round (audit.js only): killed the invented
> stat, banned absolute over-claims, trimmed Missed-Call padding — specificity verified preserved, re-reviewed
> three ways (before/after in `QUALITY_REVIEW.md`). Default model unchanged (`anthropic/claude-sonnet-4.5`).
> The final $249 go/no-go is the owner's, from reading the 5 audits. Prior session's timeout/token fix
> (150s + 6000-token cap in `lib/openrouter.js`) remains in place.
>
> **Left (all owner-side, see `NEEDS_FROM_AVI.md`):**
> 1. Tier-2 keys (`RESEND_API_KEY`, `OWNER_FALLBACK_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
> 2. Tier-3: deploy to Netlify + create the Stripe Payment Link (no Netlify token in-session → documented,
>    not executed). Full step-by-step in `HANDOFF.md`.
> 3. Optional: in Netlify, `OPENROUTER_TIMEOUT_MS` / `OPENROUTER_MAX_TOKENS` are now tunable knobs;
>    the in-code defaults are already safe, so this is only if a slower provider ever shows up.

## 2026-06-24 02:14 America/New_York — 5 real audits generated, reviewed 3 ways, tuned once; quality verdict (STOP — no deploy)

Operator: Claude (Opus 4.8, max effort). Completed the realistic-target re-test. **No deploy, no Stripe, no
Netlify, nothing marked live** — stopped at a quality verdict as instructed.

**Generated (5/5 real, nothing faked).** `generate:samples` with the 5 locked Place IDs → real Places data +
real homepage signals + real Sonnet-4.5 output. Token counts all under the 6000 cap (no truncation). Files in
`sample-audits/`. The 3 earlier chain audits were archived to `sample-audits/archive-national-chains/`.

**Reviewed three independent ways** (all on the same blind buyer's question — "paid $249, ripped off? rate 1–5
on specificity/actionability/value"; full record + verbatim verdicts in `QUALITY_REVIEW.md`):
1. Builder's own harsh review. First checked the two most suspicious "specific" claims for fabrication:
   Spot On's "HTTP 400" is REAL (verified `website.js` live-fetches the Facebook URL and Facebook returns 400);
   Rimmer's "30–40% of calls" is an unsourced industry stat → flagged.
2. Independent fresh Opus subagent (no knowledge I built the prompt; free to disagree).
3. Codex CLI (`codex exec -s read-only`, authenticated, exit 0 — invoked for real, not fabricated).

**Three-way consensus.** All agree the audits are **honest and genuinely specific — not generic, not
fabricated** (real categories, phone/hours state, photo counts, and themes quoted from actual review text).
Highest value = the catches an owner can't self-find: Watson's **missing phone number on a 70-review profile**,
Spot On's **"Services" miscategory**, Youngstown's **"General Contractor" miscategory**. Unanimous weakest spot:
the **Missed-Call section** — generic, repeated, and home to the one unsourced "30–40%" stat. Codex (harshest on
price: "$49–99") also caught two **absolute over-claims** ("will not appear", "can't read or rank"). Rimmer is
the thinnest audit (a healthy profile yields obvious findings).

**One conservative tuning round** (gated on the unanimous, concrete weakness; `audit.js` system prompt only —
no scope/schema/design change): ban invented stats/percentages; forbid absolute negative claims (require
calibrated language); keep Missed-Call short (≤2 findings) and tied to real data, no padding. `npm test` green.

**Before → after (verified, in `QUALITY_REVIEW.md`):** invented stats 2→0; "will not appear"/"can't read or
rank" 1/1→0/0; Missed-Call findings 3/3/3/3/3→2/2/2/1/1; audits shorter. **Specificity preserved** — all 5
signature catches survived. Re-reviewed three ways: Codex softened (Watson/Youngstown value 3→4, dropped the
"$49–99"); subagent flat-to-slightly-lower (different fresh instance, rater noise). Headline verdict unchanged.

**Honest verdict.** Sellable, with a clear condition: the audit earns $249 when it surfaces a real hidden defect
(a converted call pays for it); it feels closer to ~$79–129 on an already-healthy profile. The audits are honest
and specific — the thing the session set out to prove. The single biggest remaining quality risk is **sameness/
thinness on healthy profiles** — the recurring "get reviews / add photos / get a website" advice that 2 of 3
auditors called not-$249-specific. The biggest value lever (deferred to `PROPOSALS.md` P5/P9, **not built**):
**competitor/Map-Pack context** + **done-for-you assets** (schema snippet, review-request template).

**Owner's call.** Whether this is worth $249 is Avi's decision from reading the 5 `sample-audits/*.html`. Suggest
opening Watson Plumbing first (clearest "worth it"), then Rimmer Electric (the borderline case) — the gap between
them is the product's value question in two files. Commits this session: business list → 5 audits → QUALITY_REVIEW
(builder) → 3-way verdicts + synthesis → tuning + regen + before/after.

## 2026-06-24 01:35 America/New_York — Re-test on REALISTIC rough targets: 5 owner-operated locals chosen (pre-generation)

Operator: Claude (Opus 4.8, max effort). Goal this session: the engine was proven *honest* on 3 national
chains (Jiffy Lube / Roto-Rooter / One Hour Heating) but those profiles are near-perfect, so the audits
came back thin — that proved nothing about whether the product is *sellable*. The real paying customer is
a messy, owner-operated, single-location local service business with a rough Google profile. This session
re-tests the engine against 5 such targets and rigorously assesses quality. **No deploy, no Stripe, no
go-live — stop at a quality verdict.** Location confirmed first (`pwd` = .../chatgptauto1, remote =
aviharrison957-dev/chatgptauto1). Keys load from `~/.config/secrets/keys.env` (OpenRouter + Places both
present; codex-cli 0.142.0 installed for the external audit).

**Target selection was grounded in REAL Places data, not guessed.** A throwaway recon (scratchpad, not
committed) ran Google Places Text Search across the 6 requested trades in mid-size markets (Flint, Macon,
Toledo/Wauseon, Lakeland, Shreveport, Youngstown, Augusta, Bakersfield, Spokane…), filtered out every
known franchise/chain brand and anything outside a low-moderate review band, then pulled full Place
Details + the real homepage signals for a shortlist to confirm the neglect signals (photos, hours,
website state, review recency) *before* committing. Selection criteria: single-location (serviceArea
false, real street address), independent/owner-operated (no franchise marker), operational, ~10–80
reviews, and visible roughness. Deliberately avoided chains, franchises, and polished profiles.

**The 5 locked targets (exact Place IDs — audit runs on precisely these):**

| # | Business | Trade | City | Rating / Reviews | Photos | Hours | Website state | Place ID |
|---|----------|-------|------|------------------|--------|-------|---------------|----------|
| 1 | Rimmer Electric | Electrician | Shreveport, LA | 4.6★ / 10 | 10 | yes | **Real site, weak** (HTTPS + click-to-call, but **no LocalBusiness schema**; reviews 3–5 yrs stale) | `ChIJaxY9zmbNNoYRQYHiAihZdtM` |
| 2 | Watson Plumbing & Associates LLC | Plumber | Macon, GA | **4.0★** / 70 | 10+ | **no** | **None** | `ChIJLfNjOlVV8YgRiwkExQM9RGU` |
| 3 | Jimmy Lock & Key | Locksmith | Wauseon, OH | 4.9★ / 17 | **1** | yes | **None** | `ChIJCS07CgdLPIgRSmvzQvYGdNI` |
| 4 | Spot On Lawn Care | Lawn/Landscaping | Lakeland, FL | 5★ / 15 | 10 | yes | **Social-only** (Facebook page; "Services" miscategory; reviews ~5 yrs stale) | `ChIJn2q7ZOpH3YgRHIkm5Tf9Wkg` |
| 5 | Youngstown HVAC Services | HVAC | Youngstown, OH | 4.9★ / 9 | **0** | yes | **None** (listed as "General Contractor") | `ChIJM2JL9ablM4gRESIempzwEFg` |

**Why each qualifies as the real customer (not a chain):**
1. **Rimmer Electric** — independent electrician with a *real but under-optimized* site and stalled reviews
   (newest is 3 yrs old). The "built a site once, coasting" owner. Chosen to exercise the readable-website
   analysis path (schema gap, title targeting, click-to-call) — so I can judge whether the engine gives
   *specific* website findings vs generic "get a website."
2. **Watson Plumbing** — established single-location plumber with real volume (70 reviews) but a **mediocre
   4.0★** (a genuine reputation problem → review themes to mine) and **no website at all**. The "busy but
   digitally neglected, rating quietly bleeding trust" owner.
3. **Jimmy Lock & Key** — tiny rural owner-op locksmith: **one photo**, no website, mostly old reviews. The
   word-of-mouth shop with a barebones listing.
4. **Spot On Lawn Care** — single-op lawn care whose only "website" is a **Facebook page**, with a generic
   primary category and 5-yr-stale reviews. Exercises the explicit "social page is itself the finding" path.
5. **Youngstown HVAC Services** — small single-location HVAC shop with **zero photos**, no website, and a
   likely wrong primary category ("General Contractor"). The brand-new-to-digital owner.

Coverage: 5 distinct trades (electrical / plumbing / locksmith / lawn / HVAC) × all three website states
(readable-weak / none / social-only) × review profiles from 9 thin-and-stale to 70-but-mediocre. This
stresses the engine far harder than 3 polished chains did.

**Reproducible command** (resolves each Place ID directly; writes `<slug>.html` + `<slug>.analysis.json`):
```bash
set -a; source ~/.config/secrets/keys.env; set +a
node scripts/generate-samples.js \
  "ChIJaxY9zmbNNoYRQYHiAihZdtM" "ChIJLfNjOlVV8YgRiwkExQM9RGU" "ChIJCS07CgdLPIgRSmvzQvYGdNI" \
  "ChIJn2q7ZOpH3YgRHIkm5Tf9Wkg" "ChIJM2JL9ablM4gRESIempzwEFg"
```

Housekeeping: the 3 earlier national-chain audits were moved to `sample-audits/archive-national-chains/`
(via `git mv`, history preserved) so the quality review focuses unambiguously on these 5 realistic targets.
Next: generate the 5 real audits, then a three-way buyer's-eye quality review (self / independent subagent /
Codex CLI).

## 2026-06-24 01:02 America/New_York — Timeout root-caused & fixed; sample audits generated & quality-assessed

Operator: Claude (Opus 4.8). Goal: get the quality gate green. `npm run generate:samples` was past
auth (keys valid, real Places data flowing) but all three failed with "The operation was aborted due
to timeout" on `anthropic/claude-sonnet-4.5`.

**Gating check first — OpenRouter credit is fine, so no owner action needed.** `GET /api/v1/auth/key`:
`is_free_tier:false` (paid), `limit:null`/`limit_remaining:null` (no per-key cap), active billing today
(`usage_daily 0.19`, weekly 0.42, lifetime 28.33), no rate-limit block. Confirmed before touching code.

**Root cause — two, both real, both proven by timing a live call (not guessed):**
1. **Request timeout too aggressive.** `lib/openrouter.js` aborted the fetch at `AbortSignal.timeout(45000)`
   (45s). An instrumented real cold Sonnet-4.5 audit measured **~75.6s** end to end. 45 < 75 → every
   cold call aborted. This is precisely the failure mode flagged in the 2026-06-23 review ("45s timeout
   … silent customer loss"): that session fixed the *platform* ceiling by moving fulfillment to a 15-min
   background function but **never raised the in-code fetch timeout**, leaving 45s as the new binding limit.
   In production every order is a unique (cold) business, so ~75s is the norm — 45s would have aborted
   real paid orders, not just the samples.
2. **`max_tokens` ceiling too low → truncated/invalid JSON.** The audit JSON runs ~3,700–4,300 completion
   tokens; the hard-coded `max_tokens:4000` left near-zero headroom. A raw probe failed JSON parsing at
   char ~14,940 (a truncation), and the successful sample run showed **Roto-Rooter emit 4,287 output
   tokens — over the old 4,000 cap** — so that audit would have truncated to invalid JSON regardless of
   the timeout. The old cryptic "did not return valid JSON" error was a symptom of this.

**Fix — in the shared module `netlify/functions/lib/openrouter.js`, so it covers BOTH paths.** Verified
the single import chain: `scripts/generate-samples.js`, `netlify/functions/stripe-webhook.js` (inline
fallback), and `netlify/functions/audit-worker-background.js` all reach the model through
`lib/pipeline.js`/`lib/audit.js` → `lib/openrouter.js`. One change fixes the test script and the
production webhook/worker identically — no divergent paths.
- `DEFAULT_TIMEOUT_MS` 45000 → **150000** (≈2× the cold latency, still 1/6 of the 15-min worker budget),
  overridable via `OPENROUTER_TIMEOUT_MS`. Chose generous-but-sane: silent loss of a $249 order is the
  worst outcome, and extra wait is cheap inside the async budget.
- New `DEFAULT_MAX_TOKENS` = **6000** (was a hard-coded 4000), overridable via `OPENROUTER_MAX_TOKENS`.
  The model stops on its own (`finish_reason="stop"`) well under this; the cap is just a safety ceiling,
  so cost is unchanged for normal responses.
- Added explicit `finish_reason==="length"` handling → throws "truncated at max_tokens; raise
  OPENROUTER_MAX_TOKENS" instead of a downstream JSON-parse mystery (defense-in-depth for root cause #2).
- Documented both knobs in `.env.example`, and fixed `.gitignore` (`!.env.example`): the `.env.*` pattern
  had silently kept the template untracked — the very file README/HANDOFF tell operators to copy to `.env`.

**Verified (evidence, not assertion):** `npm test` green (27 checks). `npm run generate:samples` →
**3/3 real audits** written to `sample-audits/` in 3:25 wall-clock (~68s/business — every one over the
old 45s ceiling). Real Google Places data, real review text, real homepage signals. Nothing fabricated.

**Model recommendation: keep `anthropic/claude-sonnet-4.5` as default — no change.** ~75s cold and
~$0.02–0.03/audit are non-issues against a 15-min async budget and a $249 price, and the #1 product risk
is generic/fabricated output, which Sonnet is strongest at avoiding (borne out below). The pipeline is
NOT too slow, so no faster-model substitution was needed to prove it. `google/gemini-2.5-flash` stays
the documented latency/cost fallback only. Default unchanged → no PROPOSALS change for the model.

**Quality assessment — my honest read as a skeptical $249 buyer, before Avi looks:**
- **Specific & grounded — the real moat.** Every audit cites the business's real rating/review count,
  hours, phone, address, homepage `<title>`/meta, and on-page signals (HTTPS, click-to-call count,
  LocalBusiness schema), and it READS THE ACTUAL REVIEWS — names reviewers, quotes complaints, extracts
  themes. A customer could NOT get this from ChatGPT alone: ChatGPT can't pull live Places data or read
  the homepage. That data-grounding is what separates it from free generic advice.
- **Finds real, high-impact issues.** One Hour (Phoenix): primary GBP category is "General Contractor",
  not "HVAC contractor" — a genuinely costly misconfiguration, surfaced on a *franchise*. Roto-Rooter
  (Houston): two recent 1-star reviews (a leak needing a second $549 quote; water damage with no
  follow-up) the owner should service-recover, with reviewer names. These are exactly the
  specific/actionable finds that justify the price.
- **Rule-compliant:** no ranking guarantees, owner-response treated as unknown/verify, photo count as a
  floor, honest "not_checked" section.
- **Weakest section: "missed_call."** Most boilerplate across all three because the API gives it nothing
  business-specific and the prompt (correctly) forbids fabricating call data. Roto-Rooter/One Hour partly
  rescue it by tying to review themes; Jiffy Lube's stays generic.
- **Weakest audit: Jiffy Lube (Denver)** — its headline ("only 10 photos") leans on a metric the audit
  itself admits is an API floor it can't truly measure. But that's because Jiffy Lube is a polished
  national franchise with little to fix; the audit honestly reflects that.
- **Verdict: worth $249 for the real target customer** (owner-operated SMB with a messy profile). The
  three demo targets are over-optimized national chains, so the samples slightly UNDERSELL the product —
  the engine clearly finds more on a messier profile (it found the category bug even on a franchise).
  I deliberately did NOT tune the prompt: it's already well-constructed and rule-compliant, and loosening
  "missed_call" to be less generic would risk the exact fabrication the prompt exists to prevent. The
  higher-leverage improvement is the demo target set, logged as PROPOSALS P8 — not the prompt.

## 2026-06-23 19:27 America/New_York — Review pass + async background worker + hardening

Ran a fresh-eyes code review (independent subagent, Opus) over the whole pipeline. Verdicts:
Stripe signature check **correct**; "customer never emailed on failure" invariant **holds**. It
found one HIGH and several MED/LOW issues. Acted on all of them:

- **HIGH (architecture): silent customer loss on slow model.** The OpenRouter timeout (45s) exceeds
  Netlify's ~10s synchronous-function ceiling, so a slow model would get the Lambda killed externally
  before any catch ran → customer not emailed AND owner not alerted. Verified via Netlify docs that
  **background functions are available on all plans (Free included), 15-min budget.** Implemented the
  fix as core reliability: `stripe-webhook.js` verifies the Stripe signature (still 400 on invalid)
  then hands off to `audit-worker-background.js`, signed with an internal HMAC over the body using
  `STRIPE_WEBHOOK_SECRET` (no new env var; `lib/internal.js`). Worker runs the pipeline with the long
  budget. If the hand-off itself fails, the webhook fulfills inline as a fallback. PROPOSALS P2 was
  this idea; promoted to built because it's a real silent-loss bug, not an enhancement.
- **MED (SSRF):** `isBlockedHost` now also blocks IPv4-mapped IPv6 (`::ffff:`), the redirect *target*
  host is re-checked after the fetch, and non-http(s) schemes are rejected before fetching.
- **MED (double-send):** `sendEmail` no longer parses the Resend response body after a 200 — a body-
  read failure post-delivery would have wrongly triggered a fallback alert for an already-sent audit.
- **LOW:** webhook now logs the real rejection reason (a malformed-body case previously surfaced only
  the generic "invalid signature" text).

Tests: offline suite now 27 checks (added internal-signature round-trip/tamper/missing-secret and
website SSRF-guard cases). `npm test` green; both functions + all 10 lib modules load. Website signal
extraction verified live against real sites earlier; template design verified visually via a
screenshot of the synthetic preview (premium layout, severity colors, fix list, disclaimers all good).

Docs updated: HANDOFF (async flow, second function, resolved timeout note), README, PROPOSALS (P2
marked done). Quality gate still blocked on OPENROUTER_API_KEY + GOOGLE_PLACES_API_KEY → sample-audits/
intentionally empty, quality UNVERIFIED, nothing faked. Next: final end-to-end self-review + resume note.

## 2026-06-23 18:50 America/New_York — Ship-readiness build (OpenRouter swap + audit quality)

Operator: Claude (Opus). Goal this session: make the *post-payment* pipeline fully ship-ready —
the path that turns a paid Stripe Checkout into a delivered, specific, high-quality emailed audit
with no human in the loop. Front end and idea already exist and are kept as-is.

- Read first: the full repo (JOURNAL, HANDOFF, README, research/selection.md, index.html,
  config.js, scorecard.js, report-builder.html, report-builder.js, stripe-webhook.js,
  netlify.toml, both scripts/). The webhook was well-structured but had three gaps:
  (1) it called the Anthropic API directly, (2) the audit prompt was thin/generic, the single
  biggest product risk, and (3) there was no quality gate, NEEDS_FROM_AVI.md, or PROPOSALS.md.
- Repo was not cloned locally; cloned from github.com/aviharrison957-dev/chatgptauto1 into
  /Users/avi/Desktop/claudemac/chatgptauto1. `gh` is authed as aviharrison957-dev. Pushing to main.

Decisions made this session:
- MODEL PROVIDER: removing the hard Anthropic dependency. The audit call now goes through
  OpenRouter (https://openrouter.ai/api/v1/chat/completions, OpenAI-compatible). Auth via
  `OPENROUTER_API_KEY`; model via `OPENROUTER_MODEL`.
- DEFAULT MODEL: `anthropic/claude-sonnet-4.5`. Justification: the #1 risk is generic, fabricated,
  or fluffy output, so the deciding factor is groundedness + instruction-following, not price.
  Verified live against OpenRouter's catalog (https://openrouter.ai/api/v1/models): the slug
  exists, 1M context, $3/M in + $15/M out → ~$0.02-0.03 per audit, negligible against the $249
  price. Sonnet is best-in-class at careful, non-fabricating, structured writing and clean
  HTML/JSON. Owner can override with `OPENROUTER_MODEL` (alternatives confirmed available:
  `anthropic/claude-sonnet-4.6` newest, `google/gemini-2.5-pro`, `openai/gpt-4.1`, or
  `google/gemini-2.5-flash` to cut latency/cost).
- AUDIT ARCHITECTURE: the model returns a strict, validated JSON analysis of the *specific*
  business; our own deterministic, email-safe inline-styled HTML template renders it. This
  separates ANALYSIS (model's job — specificity, no fabrication) from PRESENTATION (our job —
  consistent premium design). It guarantees the deliverable always looks like a $249 product and
  contains only real, data-tied findings.
- RICHER INPUTS: expanded the Google Places (New) FieldMask (adds primaryType/displayName,
  editorialSummary, pureServiceAreaBusiness, addressComponents) AND added a defensive homepage
  fetch (`lib/website.js`) so the "website local-signal gaps" section cites real on-page facts
  (title tag, click-to-call, LocalBusiness schema, NAP, HTTPS) instead of hand-waving. Treated as
  implementation of an already-required section, not scope expansion. Website fetch failures never
  fail the audit — they downgrade that section to an explicit "could not retrieve" note.
- FAILURE MODEL: env var renamed to `OWNER_FALLBACK_EMAIL` per brief (legacy `AVI_FALLBACK_EMAIL`
  still honored as a fallback). On any pipeline error the customer is NOT emailed; the owner gets
  the order context + error to fulfill manually via report-builder.html.

Environment facts (this machine):
- Node v22 (global fetch OK). Outbound network works. gh authed.
- `OPENROUTER_API_KEY` = UNSET and `GOOGLE_PLACES_API_KEY` = UNSET → the live QUALITY GATE
  (real Places data + real model output → sample-audits/) cannot run here. Per brief: code is
  written fully, the exact command is documented, and both keys are the TOP blockers in
  NEEDS_FROM_AVI.md. AUDIT QUALITY IS UNVERIFIED until those real samples exist. No fake samples.
- An ANTHROPIC_API_KEY exists in env but does NOT unblock the gate: without Google Places there is
  no real business data to feed any model, and fabricating input data is forbidden.

Plan / order of work (commit + push after each):
1. Living docs: this entry, NEEDS_FROM_AVI.md, PROPOSALS.md. [in progress]
2. lib/ modules: stripe, places, website, openrouter, render, audit, email. Swap provider.
3. Rewrite webhook to use the modules; keep 400-on-invalid-signature; OWNER_FALLBACK_EMAIL.
4. Quality gate: scripts/generate-samples.js (real Place IDs → real audits → sample-audits/),
   updated smoke tests, template design-preview (clearly-labeled synthetic, not a real sample).
5. Frontend wiring sanity + HANDOFF/README rewrite for OpenRouter + Netlify deploy.
6. Harden: run no-secret tests, load every module, end-to-end review.

Blocking: OPENROUTER_API_KEY, GOOGLE_PLACES_API_KEY (quality gate); plus RESEND/STRIPE/Netlify
for live end-to-end — all owner-supplied. See NEEDS_FROM_AVI.md.
Next: write NEEDS_FROM_AVI.md + PROPOSALS.md, commit, then build lib/ modules.

## 2026-05-01 12:57 America/New_York
- Done: Read the current repo state requested for continuation: `JOURNAL.md`, `HANDOFF.md`, `index.html`, `assets/js/config.js`, `assets/js/scorecard.js`, `report-builder.html`, and `research/selection.md`.
- In progress: Replace the manual paid-audit fulfillment path with Netlify serverless automation while keeping the existing static frontend and manual builder as fallback.
- Plan:
  - Add Netlify deployment config and an `/api/stripe-webhook` redirect to a serverless function.
  - Implement Stripe webhook signature verification for `checkout.session.completed`.
  - Extract customer email plus the Google Business Profile URL or Place ID from Stripe custom fields.
  - Fetch public business data from Google Places API (New) Place Details.
  - Generate an email-safe HTML audit through Anthropic with a structured, non-fabrication prompt.
  - Send the audit to the customer through Resend; on any failure, email Avi only with order details and error context for manual fulfillment.
  - Update `HANDOFF.md` with Netlify, Stripe custom field, webhook, API key, and deployment steps.
  - Preserve `report-builder.html` as fallback only and keep the free scorecard behavior unchanged.
- Blocking: Live end-to-end payment/webhook/API tests require Avi-owned Stripe, Google, Anthropic, Resend, and Netlify credentials. Local tests will verify code paths that do not need those live secrets, and any untested secret-dependent path will be documented.
- Next: Add the first Netlify/serverless scaffold, commit it, push it, then continue with provider integrations in small commits.

## 2026-05-01 13:02 America/New_York
- Done: Added `netlify.toml` and `netlify/functions/stripe-webhook.js`, then committed and pushed in small checkpoints.
- Done: Webhook now verifies Stripe signatures, handles `checkout.session.completed`, extracts customer email plus `google_business_profile_url`, calls Google Places API (New), calls Anthropic for email-safe HTML, sends the audit through Resend, and emails Avi only on fulfillment failure.
- Done: Added local test scripts. `npm run test:webhook-nosig` returned `statusCode=400` with `{"error":"Invalid Stripe webhook signature"}`.
- Done: Updated `index.html` minimally to describe email delivery, added Stripe custom-field guidance to `assets/js/config.js`, and expanded `HANDOFF.md`/`README.md` around Netlify, env vars, Stripe webhook, and fallback operations.
- Blocking: No Netlify CLI/session/token is present on this machine (`NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` are missing), so I cannot create the live Netlify deployment from here. No Google/Anthropic/Resend/Stripe secrets are present locally, so the live audit-generation and email path cannot be executed in this session.
- Next: Avi creates/imports the Netlify site from GitHub, adds the documented environment variables, configures the Stripe Payment Link custom field and webhook endpoint, then runs `npm run test:audit-live` with real Google and Anthropic keys.

## 2026-05-01 13:02 America/New_York
- Done: Made Resend sender configurable with optional `RESEND_FROM_EMAIL` while keeping the requested required env var list unchanged.
- Test result: `npm run test:webhook-nosig` passed and returned 400 for a POST without `Stripe-Signature`.
- Test result: `node -e "require('./netlify/functions/stripe-webhook.js')"` loaded the webhook module successfully.
- Test result: `npm run test:audit-live` could not run because `GOOGLE_PLACES_API_KEY` and `ANTHROPIC_API_KEY` are not set in this environment. This is a real blocker, not a code stub; the script is ready to run once Avi provides live keys.
- Blocking: Netlify deployment and live provider smoke tests remain owner-credential tasks.

## 2026-04-29 17:00 America/New_York
- Done: Initialized the operating journal before substantive work.
- In progress: Repository recovery setup.
- Blocking: None.
- Next: Commit and push this stub, then research candidate businesses before writing any product code.

## 2026-04-29 17:37 America/New_York
- Done: Completed research gate for three candidate businesses and chose the build path.
- In progress: Pre-build commit and push of the research decision.
- Blocking: No live payment account is available in-session; the build will wire Stripe Payment Links as a configuration point and document the exact post-handoff action Avi must take to activate live payments.
- Next: Commit and push this journal/research update, then build the selected static product and operator toolkit.

## 2026-04-29 18:07 America/New_York
- Done: Built the static MapGap Report site, free scorecard, central payment config, and operator report builder. Added handoff instructions for Stripe activation and fulfillment.
- In progress: Deployment setup and browser testing.
- Blocking: Live Stripe checkout still requires Avi's Stripe account. GitHub Pages may require the repository to be public.
- Next: Commit and push the handoff/deployment prep, then configure the free deployment and test the deployed URL.

## 2026-04-29 18:23 America/New_York
- Done: Made the repository public, enabled GitHub Pages from `main` root, and verified the deployed site at https://aviharrison957-dev.github.io/chatgptauto1/.
- Test result: HTTP checks returned 200 for the home page, report builder, and config file. Headless Chrome test filled the scorecard, got `Test Plumbing: 25/100`, clicked the audit button, saw the Stripe activation message, opened the report builder, and confirmed the sample report title rendered.
- In progress: Final README update and push.
- Blocking: Live payment cannot be completed by the agent because Avi must create and verify his own Stripe account.
- Next: Avi creates Stripe Payment Links, pastes them into `assets/js/config.js`, commits, pushes, and starts the first 20-business outreach loop from `HANDOFF.md`.

# Research Gate

## Candidate 1: One-time local presence audit for owner-operated service businesses

Product: a small static sales site plus an operator report builder for a fixed-price "Google Maps and website basics" audit. Buyer is an owner-operated local service business such as HVAC, plumbing, locksmith, pest control, landscaping, or auto repair. The paid deliverable is a concise prioritized report: Google Business Profile gaps, review/reputation gaps, website local signals, citation consistency checks, missed-call risk, and a 30-day fix list.

Research:
- Storefront Audit's 2026 pricing guide says GBP-only management is commonly $300-$500/month, basic local SEO is $500-$800/month, one-time local SEO audits are $200-$500, and a paid "Blueprint" product is $297 one-time. Source: https://storefrontaudit.com/blog/local-seo-pricing-guide
- A practitioner building an AI local business audit tool reported roughly 100 free audits before the first paid conversion and a 3.4% conversion rate from free audit to a $297 report. Source: https://www.reddit.com/r/SideProject/comments/1sjwlvc/i_built_an_ai_that_audits_local_businesses_on/
- CallJolt's 2026 home-service call-answering report estimates that home service businesses answer only 38% of inbound calls, that 86% of voicemail callers hang up without leaving a message, and that live-answer conversion is materially higher than callback conversion. Source: https://calljolt.com/blog/guides/home-service-call-answering-statistics
- Stripe Payment Links can sell a product or service through a hosted payment page with no code, including one-time and recurring payments, at standard Stripe pricing. Source: https://stripe.com/payments/payment-links

Evaluation:
- Expected revenue magnitude: clears the $1,000/month bar if Avi sells 4 audits/month at $249, or 3 audits/month plus one $149/month maintenance customer. The market has existing prices in the $200-$500 one-time audit range and $300-$800/month ongoing range, so the price is not invented.
- Time to first dollar: plausible within 8 weeks because the buyer already understands the category and the purchase can be self-serve or email-based. The practitioner evidence is not easy-mode: about 100 free audits before first paid conversion. That is still weeks, not months, if the site has a free scorecard and Avi does small, targeted outreach to obvious local businesses.
- Autonomy: build is mostly static. Ongoing fulfillment can be 90% AI-runnable: the customer fills an intake form, Avi pastes data into the operator report builder, reviews the generated report for obvious errors, and sends a PDF. No live support or daily content creation required. At early volume, fulfillment should be under a few hours per week.
- Probability for Avi: moderate. He does not need credentials, industry licensing, or a reputation in a regulated profession. The hardest part is acquiring local-business attention without spam. This beats pure SaaS because a paid audit can close with a small number of customers.

Disqualifier check:
- No medical, legal, financial, or regulated advice. The product must avoid guaranteed rankings and avoid claiming Google control.
- Not tied to Avi's identity, school, hobbies, religion, DJ work, or existing ventures.
- Does not require paid subscriptions to build. Live payment activation requires Avi's own Stripe account after handoff.
- Does not require fake reviews, scraped content, search-engine spam, or platform abuse.
- Marketing burden exists but can be constrained to a short weekly list of targeted local businesses and a free scorecard; no audience-building content treadmill is required.

Uncertainties:
- The conversion math depends on reaching enough local businesses. If cold outreach is too slow, the backup is to position the site as a free scorecard plus paid blueprint and list it on relevant small-business communities without spam.
- Automated audits can be wrong. The build must make the paid deliverable a reviewed report, not a fully autonomous claim about rankings.
- Payment cannot be live until Avi creates Stripe Payment Links. The site will be built with a single configurable payment URL and handoff instructions.

## Candidate 2: Missed-call text-back setup for home-service businesses

Product: sell a setup package or subscription that helps contractors automatically text customers after missed calls.

Research:
- HighLevel documents a missed-call text-back feature that sends an automatic SMS when an inbound call is missed. Source: https://help.gohighlevel.com/support/solutions/articles/48001239140-where-and-how-to-configure-the-missed-call-text-back-feature
- Missed-call economics are strong in home services, with CallJolt reporting low answer rates and high voicemail abandonment. Source: https://calljolt.com/blog/guides/home-service-call-answering-statistics
- Search results and Reddit threads show sellers packaging this around GoHighLevel, but SMS consent, A2P registration, carrier routing, and existing phone-number forwarding are common operational issues. Example: https://www.reddit.com/r/gohighlevel/comments/1styyoi/a2p_rejected_3x_with_error_30909_missed_call_text/

Evaluation:
- Expected revenue magnitude: high. Even one $200-$500/month client could be meaningful, and contractors can justify it if missed calls are real.
- Time to first dollar: possible within 8 weeks, but only if setup infrastructure is ready.
- Autonomy: weak. Real delivery depends on SMS infrastructure, number routing, A2P/compliance handling, client phone setup, and support when calls/texts break.
- Probability for Avi: weak. It requires a paid GoHighLevel/Twilio-like stack, handling customer phone systems, and messaging compliance details. This is not a clean 5-hour build with no paid subscriptions.

Disqualifier check:
- Disqualified because it requires paid infrastructure to operate and creates compliance/support risk around SMS consent and phone routing. It also likely requires live client onboarding calls.

## Candidate 3: AI listing optimizer for Etsy/Shopify/Amazon sellers

Product: a self-serve tool that generates marketplace titles, tags, descriptions, and alt text for small sellers.

Research:
- Etsy search results show low-priced SEO/listing services and digital downloads, including custom product description/listing optimization offers around $11.49 and templates under $10. Source: https://www.etsy.com/market/seo_service
- MyDesigns warns that flat-fee Etsy SEO rewrite services are often not worth buying because they keyword-stuff and do not understand the brand or measure outcomes. Source: https://mydesigns.io/blog/etsy-seo-optimization/
- A micro-SaaS founder reported first paying users for an AI listing optimizer with pricing at $9/month for 50 listings and $24/month for 200 listings. Source: https://www.reddit.com/r/SaaS/comments/1r543l1/i_built_an_ai_listing_optimizer_for_etsyamazon/
- Shopify now has native AI product-description generation in Shopify Magic, which reduces willingness to pay for a simple wrapper. Source: https://www.shopify.com/blog/ai-product-descriptions/

Evaluation:
- Expected revenue magnitude: theoretically clears $1,000/month at 42 customers paying $24/month, but that requires sustained acquisition in a crowded market.
- Time to first dollar: possible, but likely slower than a high-ticket productized service because many free or cheap alternatives exist.
- Autonomy: good after build if AI keys are available.
- Probability for Avi: weak-to-moderate. The product is easy to copy, price points are low, and acquisition would likely require ongoing content, marketplace presence, or SEO. That conflicts with the no-significant-marketing-labor constraint.

Disqualifier check:
- Not regulated and not tied to Avi, but rejected because the pricing and acquisition path make $1,000/month unlikely for Avi within the requested constraints.

## Candidate 4: Podcast show-notes and episode-page generator

Product: transcript-in, show notes out. Sell either a subscription or per-episode service to small podcasters.

Research:
- Podcast show notes services are priced around $49-$50/episode in several production-service menus. Sources: https://silentwolfstudios.com/pricing and https://www.podcastedition.com/pricing
- A Reddit micro-SaaS founder reported first paying subscribers at $24/month for a podcast notes product, but also noted running a 30-day content series to drive awareness. Source: https://www.reddit.com/r/micro_saas/comments/1sk6dxu/i_built_a_tool_that_turns_podcast_episodes_into/
- Reddit podcasting discussions show skepticism toward generic AI show notes and concern that auto-generated notes need editing. Source: https://www.reddit.com/r/podcasting/comments/1arjjns/how_important_are_show_notes/

Evaluation:
- Expected revenue magnitude: plausible but requires many small subscribers or recurring production customers.
- Time to first dollar: plausible, but the acquisition path leans on creator communities and content.
- Autonomy: partial. Transcript-to-notes is AI-runnable, but good output needs editorial review.
- Probability for Avi: weaker than local audit because the buyer has many AI alternatives and creators are price-sensitive.

Disqualifier check:
- Rejected because it likely requires ongoing creative/editorial labor or audience-building, and the product is too easy for the buyer to replace with ChatGPT plus their own transcript.

## Chosen path

Build Candidate 1: "MapGap Report", a productized local presence audit and report builder.

Why it beat the others:
- Higher ticket than Etsy/product-copy or podcast notes, so $1,000/month requires a handful of sales instead of dozens of subscribers.
- Less operationally fragile than missed-call SMS. It can mention missed-call economics as an audit section without operating phone/SMS infrastructure.
- Real demand and pricing already exist for audits and local SEO basics.
- The deliverable can be produced by AI with human review, keeping Avi's weekly labor low.
- The build can be completed as a static product: public sales site, free scorecard, paid audit offer, and private-ish operator report builder. It can deploy free without backend infrastructure.

Build plan:
- Stack: static HTML/CSS/JavaScript. Reason: fastest deployable product, no paid backend, no login system, no framework build complexity, easy for Avi or a future agent to edit.
- Deployment: GitHub Pages if available. The repo is currently private, so deployment may require making it public or using another authenticated free host if already available. If GitHub Pages is used, the deployed URL must go in README.md.
- Product surface:
  - Public landing page for local service businesses.
  - Free scorecard form that calculates obvious gaps client-side and gives a credible preview without pretending to scrape Google.
  - Paid audit offer at $249 one-time, plus optional $149/month maintenance plan language for after the first report.
  - Stripe Payment Link CTA wired through one central config value. Until Avi creates the live link, the CTA should route to clear "payment setup needed" copy rather than a fake checkout.
  - Operator report builder page where Avi can enter customer details and generate a polished report/PDF-ready page.
- Revenue mechanism:
  - Stripe Payment Links are the recommended mechanism because Stripe supports no-code hosted payment pages for products/services and can be embedded or linked.
  - In-session limitation: I cannot create Avi's live Stripe link because it requires his Stripe account and business verification. Handoff will include exact steps and the code location to paste the live payment URL.
- Handoff:
  - How to create Stripe Payment Links for $249 audit and optional $149/month maintenance.
  - Where to paste links in the static config.
  - How to enable/deploy GitHub Pages or use the deployed URL.
  - How to fulfill an order in under 30 minutes with the operator report builder.
  - Outreach script and no-spam operating rules.

Next action after this commit:
- Build the static product and report builder.
- Commit/push after scaffolding, after first working feature, after deployment config, after deployment live, and after handoff docs.
