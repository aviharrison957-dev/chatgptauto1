// Stripe webhook entry point for MapGap Report automated fulfillment.
//
// Flow:
//   1. POST only; verify the Stripe signature (invalid/unsigned -> HTTP 400, no work done).
//   2. Ignore everything except checkout.session.completed (-> 200).
//   3. Hand the verified session to the background worker (audit-worker-background) and return 200 fast.
//      The slow pipeline (Places -> website -> OpenRouter -> Resend) then runs off the request path with
//      a 15-minute budget, so a slow model can never time out the webhook or silently drop a paid order.
//   4. If the background trigger itself fails (rare), fulfill inline as a last resort.
//   5. On ANY fulfillment failure the customer is NOT emailed; the owner gets a fallback alert so they
//      can fulfill by hand with report-builder.html.
//
// All heavy lifting lives in ./lib/* so it can be unit-/smoke-tested independently of Stripe.
const { requiredEnv, jsonResponse } = require("./lib/util");
const { getRawBody, verifyStripeWebhook, getOrderContext } = require("./lib/stripe");
const { triggerAuditWorker } = require("./lib/internal");
const { runFulfillment } = require("./lib/pipeline");
const { sendFallbackAlert } = require("./lib/email");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // Verify FIRST so forged/unsigned requests are rejected with 400 and never trigger any work.
  let stripeEvent;
  let webhookSecret;
  try {
    webhookSecret = requiredEnv("STRIPE_WEBHOOK_SECRET");
    stripeEvent = verifyStripeWebhook(getRawBody(event), event.headers || {}, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook rejected:", error?.message || error);
    return jsonResponse(400, { error: "Invalid Stripe webhook signature" });
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return jsonResponse(200, { received: true, ignored: stripeEvent.type });
  }

  const session = stripeEvent.data?.object || {};

  // Happy path: hand off to the background worker and acknowledge Stripe immediately.
  try {
    await triggerAuditWorker(event, session, webhookSecret);
    return jsonResponse(200, { received: true, queued: true });
  } catch (triggerError) {
    // The async hand-off mechanism failed (rare). Fall back to fulfilling inline so the order isn't lost.
    console.error("Audit worker trigger failed; running inline:", triggerError?.message || triggerError);
    return fulfillInline(session);
  }
};

async function fulfillInline(session) {
  try {
    const result = await runFulfillment(session);
    return jsonResponse(200, { received: true, fulfilled: true, inline: true, business: result.businessName });
  } catch (error) {
    try {
      await sendFallbackAlert(error, getOrderContext(session), session);
      // Owner notified -> manual path chosen; tell Stripe it's handled so it does not retry.
      return jsonResponse(200, { received: true, fulfilled: false, ownerAlerted: true });
    } catch (alertError) {
      // Could not even reach the owner. Return 5xx so Stripe retries later, when a transient outage may
      // have cleared. The customer was not emailed on this attempt.
      console.error("Fallback alert also failed:", alertError?.message || alertError);
      return jsonResponse(500, { received: false, error: "fulfillment_and_alert_failed" });
    }
  }
}

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
