// Quick LIVE smoke test of the audit path for ONE business (does not send email, does not write files).
// Needs GOOGLE_PLACES_API_KEY + OPENROUTER_API_KEY. For full browser-judgeable samples use
// `npm run generate:samples` instead.
require("./_load-env"); // optional: read keys from a local .env file
const { fetchPlaceDetails, summarizePlaceForPrompt } = require("../netlify/functions/lib/places");
const { fetchWebsiteSignals } = require("../netlify/functions/lib/website");
const { generateAuditHtml } = require("../netlify/functions/lib/audit");

const required = ["GOOGLE_PLACES_API_KEY", "OPENROUTER_API_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing required env vars for live smoke test: ${missing.join(", ")}`);
  console.error("(GOOGLE_PLACES_API_KEY + OPENROUTER_API_KEY). See NEEDS_FROM_AVI.md.");
  process.exit(1);
}

const input = process.env.TEST_PLACE_ID || process.argv[2] || "Roto-Rooter Plumbing & Water Cleanup, Houston, TX";
const order = {
  checkoutSessionId: "local-smoke-test",
  customerName: "Local Smoke Test",
  customerEmail: process.env.TEST_CUSTOMER_EMAIL || "customer@example.com",
  googleBusinessInput: input
};

(async () => {
  const place = await fetchPlaceDetails(order.googleBusinessInput);
  const summary = summarizePlaceForPrompt(place);
  const website = await fetchWebsiteSignals(place.websiteUri);
  const { html, model } = await generateAuditHtml(place, order, website);

  console.log(`place=${place.displayName?.text || place.id}`);
  console.log(`rating=${summary.rating ?? "n/a"} reviews=${summary.reviewCount} photos=${summary.photoCount}`);
  console.log(`websiteAnalyzed=${website.available === true}`);
  console.log(`model=${model}`);
  console.log(`htmlLength=${html.length}`);
  console.log(`startsWith=${html.slice(0, 80).replace(/\s+/g, " ")}`);
  if (!html.trim() || !/<[a-z][\s\S]*>/i.test(html)) {
    throw new Error("Audit HTML was empty or not HTML");
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
