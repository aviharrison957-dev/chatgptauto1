# Research Selection Notes

Timestamp: 2026-04-29 17:37 America/New_York

## Selected Business

MapGap Report: a one-time local presence audit for owner-operated service businesses.

The product sells a reviewed report, not guaranteed rankings or regulated advice. The customer pays for a prioritized diagnosis of common local visibility and conversion gaps: incomplete Google Business Profile fields, weak review/request process, missing local website signals, inconsistent citation basics, unclear phone-response process, and a 30-day fix list.

## Why This Was Selected

The strongest evidence was existing market pricing. Local SEO audits are commonly sold for $200-$500, and one practitioner reported a $297 one-time report with a 3.4% conversion rate from a free audit after roughly 100 free audits. That is not easy, but it is more believable than trying to get dozens of low-price SaaS subscribers from zero.

Sources:
- Local SEO audit and service pricing: https://storefrontaudit.com/blog/local-seo-pricing-guide
- Practitioner report on AI local audits: https://www.reddit.com/r/SideProject/comments/1sjwlvc/i_built_an_ai_that_audits_local_businesses_on/
- Home-service missed-call economics: https://calljolt.com/blog/guides/home-service-call-answering-statistics
- Stripe Payment Links: https://stripe.com/payments/payment-links

## Rejected Candidates

Missed-call text-back setup was rejected because it needs paid phone/SMS infrastructure, A2P/SMS compliance handling, and client-specific phone routing support. Those are poor fits for a no-capital 5-hour build. Sources: https://help.gohighlevel.com/support/solutions/articles/48001239140-where-and-how-to-configure-the-missed-call-text-back-feature and https://www.reddit.com/r/gohighlevel/comments/1styyoi/a2p_rejected_3x_with_error_30909_missed_call_text/

AI marketplace listing optimizer was rejected because the buyer has many cheap/free alternatives, Shopify has native AI description help, and pricing is too low for a fast path to $1,000/month without sustained acquisition. Sources: https://www.etsy.com/market/seo_service, https://mydesigns.io/blog/etsy-seo-optimization/, https://www.reddit.com/r/SaaS/comments/1r543l1/i_built_an_ai_listing_optimizer_for_etsyamazon/, and https://www.shopify.com/blog/ai-product-descriptions/

Podcast show-notes generator was rejected because it competes with many transcript-to-notes tools, requires editorial quality control, and likely needs creator-audience content marketing. Sources: https://silentwolfstudios.com/pricing, https://www.podcastedition.com/pricing, and https://www.reddit.com/r/micro_saas/comments/1sk6dxu/i_built_a_tool_that_turns_podcast_episodes_into/

## Build Implications

The build should stay simple:
- Static site.
- One central payment link config.
- Free scorecard that previews value but does not overclaim.
- Operator report builder for fast fulfillment.
- Handoff docs for Stripe activation and order fulfillment.

The main unsolved constraint is payment activation. No agent can create Avi's live Stripe account or complete identity/business verification. The product will be wired to use Stripe Payment Links, and Avi must create/paste live links after handoff.
