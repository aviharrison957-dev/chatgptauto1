const { _private } = require("../netlify/functions/stripe-webhook");

const required = ["GOOGLE_PLACES_API_KEY", "ANTHROPIC_API_KEY"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Missing required env vars for live smoke test: ${missing.join(", ")}`);
  process.exit(1);
}

const orderContext = {
  checkoutSessionId: "local-smoke-test",
  paymentIntentId: "local-smoke-test",
  customerEmail: process.env.TEST_CUSTOMER_EMAIL || "customer@example.com",
  customerName: "Local Smoke Test",
  googleBusinessInput: process.env.TEST_PLACE_ID || "ChIJtcaxrqlZwokRfwmmibzPsTU"
};

(async () => {
  const place = await _private.fetchPlaceDetails(orderContext.googleBusinessInput);
  const html = await _private.generateAuditHtml(place, orderContext);
  console.log(`place=${place.displayName?.text || place.id}`);
  console.log(`htmlLength=${html.length}`);
  console.log(`startsWith=${html.slice(0, 80).replace(/\s+/g, " ")}`);
  if (!html.trim() || !/<[a-z][\s\S]*>/i.test(html)) {
    throw new Error("Audit HTML was empty or not HTML");
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
