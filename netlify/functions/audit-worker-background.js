// Netlify BACKGROUND function (the "-background" suffix is what makes it one). It is invoked
// asynchronously by stripe-webhook.js *after* the Stripe signature is verified, answers 202 to the
// caller immediately, then runs up to 15 minutes. That long budget means a slow model can never cause
// a request timeout or silently drop a paid order.
//
// It is publicly reachable, so it only acts on requests carrying a valid internal signature
// (HMAC of the body with STRIPE_WEBHOOK_SECRET). Everything else gets 401 and does nothing.
const { requiredEnv } = require("../../lib/util");
const { getRawBody, getOrderContext } = require("../../lib/stripe");
const { verifyInternalSignature } = require("../../lib/internal");
const { runFulfillment } = require("../../lib/pipeline");
const { sendFallbackAlert } = require("../../lib/email");

exports.handler = async function handler(event) {
  const rawBody = getRawBody(event);

  try {
    verifyInternalSignature(rawBody, event.headers || {}, requiredEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (error) {
    console.error("Audit worker rejected (internal signature):", error?.message || error);
    return { statusCode: 401 };
  }

  let session = {};
  try {
    session = JSON.parse(rawBody).session || {};
    const result = await runFulfillment(session);
    console.log("Audit worker fulfilled:", result.businessName || result.placeId);
    return { statusCode: 200 };
  } catch (error) {
    // Customer is never emailed a broken report; alert the owner for manual fulfillment instead.
    try {
      await sendFallbackAlert(error, getOrderContext(session), session);
    } catch (alertError) {
      console.error("Audit worker fallback alert failed:", alertError?.message || alertError);
    }
    return { statusCode: 500 };
  }
};
