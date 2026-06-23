// Stripe webhook entry point for MapGap Report automated fulfillment.
//
// Flow:
//   1. POST only; verify the Stripe signature (invalid/unsigned -> HTTP 400).
//   2. Ignore everything except checkout.session.completed (-> 200).
//   3. On a completed checkout, run the fulfillment pipeline:
//        hydrate session -> Google Places (New) -> website signals -> OpenRouter audit -> Resend to customer.
//   4. On ANY failure, the customer is NOT emailed; the owner gets a fallback alert with the order
//      context + error so they can fulfill by hand with report-builder.html.
//
// All heavy lifting lives in ./lib/* so it can be unit-/smoke-tested independently of Stripe.
const { requiredEnv, jsonResponse } = require("./lib/util");
const {
  getRawBody,
  verifyStripeWebhook,
  getOrderContext
} = require("./lib/stripe");
const { runFulfillment } = require("./lib/pipeline");
const { sendFallbackAlert } = require("./lib/email");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // Verify FIRST so forged/unsigned requests are rejected with 400 and never trigger any work.
  let stripeEvent;
  try {
    const rawBody = getRawBody(event);
    stripeEvent = verifyStripeWebhook(rawBody, event.headers || {}, requiredEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (_error) {
    return jsonResponse(400, { error: "Invalid Stripe webhook signature" });
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return jsonResponse(200, { received: true, ignored: stripeEvent.type });
  }

  const session = stripeEvent.data?.object || {};
  try {
    const result = await runFulfillment(session);
    return jsonResponse(200, { received: true, fulfilled: true, business: result.businessName });
  } catch (error) {
    // Never surface a broken audit to the customer; alert the owner for manual fulfillment instead.
    try {
      await sendFallbackAlert(error, getOrderContext(session), session);
    } catch (alertError) {
      console.error("Fallback alert also failed:", alertError?.message || alertError);
    }
    // Return 200: the safety net is the owner alert, not a Stripe retry storm against a hard failure.
    return jsonResponse(200, { received: true, fulfilled: false });
  }
};

// Backwards-compatible test surface (used by scripts/ and any prior tooling).
exports._private = {
  verifyStripeWebhook,
  getOrderContext,
  runFulfillment,
  fetchPlaceDetails: require("./lib/places").fetchPlaceDetails,
  extractPlaceId: require("./lib/places").extractPlaceId,
  summarizePlaceForPrompt: require("./lib/places").summarizePlaceForPrompt,
  extractGoogleBusinessInput: require("./lib/stripe").extractGoogleBusinessInput,
  generateAuditHtml: require("./lib/audit").generateAuditHtml
};
