# Journal

> ## ▶ RESUME / STATUS (2026-06-23)
> **Code-complete and pushed to origin/main. Audit quality is UNVERIFIED — blocked on 2 owner keys. Nothing faked.**
>
> **Done this session:** Full post-payment pipeline rebuilt and hardened — Stripe webhook (verifies
> signature, 400 on invalid) → async **background worker** → Google Places (New) → website signals →
> **OpenRouter** audit (strict validated JSON, anti-fabrication + no-ranking-promise prompt) → premium
> email-safe HTML template (visual design verified) → **Resend** to customer; any failure emails the
> owner instead. Anthropic dependency removed. 27 offline tests green (`npm test`). Living docs written:
> `NEEDS_FROM_AVI.md`, `PROPOSALS.md`, rewritten `HANDOFF.md`/`README.md`.
>
> **Left (all owner-side, see `NEEDS_FROM_AVI.md`):**
> 1. **FIRST:** set `OPENROUTER_API_KEY` + `GOOGLE_PLACES_API_KEY`, run `npm run generate:samples`, and
>    judge the real audits in `sample-audits/`. Quality is unproven until this is done.
> 2. Tier-2 keys (`RESEND_API_KEY`, `OWNER_FALLBACK_EMAIL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
> 3. Tier-3: deploy to Netlify + create the Stripe Payment Link (no Netlify token in-session → documented,
>    not executed). Full step-by-step in `HANDOFF.md`.

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
