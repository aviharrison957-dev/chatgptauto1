# Journal

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
