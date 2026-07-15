// Stripe webhook entry point — Vercel Function (web-standard fetch handler, Fluid compute).
//
// Flow:
//   1. POST only; verify the Stripe signature (invalid/unsigned -> HTTP 400, no work done).
//   2. Ignore everything except checkout.session.completed (-> 200).
//   3. Respond 200 to Stripe immediately, then run the full fulfillment pipeline in waitUntil()
//      inside the SAME invocation. maxDuration=300s (the Hobby-plan maximum, and the platform
//      ceiling that replaced Netlify's 15-minute background budget). Every network call in the
//      pipeline carries an explicit timeout so the worst-case chain (~240s) finishes — or fails
//      into the owner alert — strictly inside the ceiling. Timing proof: JOURNAL 2026-07-15.
//   4. Duplicate/replayed deliveries are deduped via PaymentIntent metadata (lib/idempotency.js).
//   5. On ANY fulfillment failure the customer is NOT emailed; the owner gets a fallback alert so
//      they can fulfill by hand with report-builder.html.
//
// This replaces the Netlify webhook -> background-worker pair: there is no publicly reachable
// worker and no internal HMAC hand-off anymore. All heavy lifting lives in ../lib/*.
import { waitUntil } from "@vercel/functions";
import utilLib from "../lib/util.js";
import stripeLib from "../lib/stripe.js";
import pipelineLib from "../lib/pipeline.js";
import emailLib from "../lib/email.js";
import idempotencyLib from "../lib/idempotency.js";

const { requiredEnv } = utilLib;
const { verifyStripeWebhook, getOrderContext } = stripeLib;
const { runFulfillment } = pipelineLib;
const { sendFallbackAlert } = emailLib;
const { checkAlreadyFulfilled, markFulfilled } = idempotencyLib;

export const config = { maxDuration: 300 };

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    // Verify FIRST so forged/unsigned requests are rejected with 400 and never trigger any work.
    const rawBody = await request.text();
    let stripeEvent;
    try {
      const webhookSecret = requiredEnv("STRIPE_WEBHOOK_SECRET");
      stripeEvent = verifyStripeWebhook(rawBody, headersToObject(request.headers), webhookSecret);
    } catch (error) {
      console.error("Stripe webhook rejected:", error?.message || error);
      return json(400, { error: "Invalid Stripe webhook signature" });
    }

    if (stripeEvent.type !== "checkout.session.completed") {
      return json(200, { received: true, ignored: stripeEvent.type });
    }

    const session = stripeEvent.data?.object || {};
    // Acknowledge Stripe now; the pipeline keeps running in this instance up to maxDuration.
    waitUntil(fulfill(session, stripeEvent.id));
    return json(200, { received: true, queued: true });
  }
};

async function fulfill(session, eventId) {
  try {
    const dedupe = await checkAlreadyFulfilled(session);
    if (dedupe.fulfilled) {
      console.log(`Duplicate delivery ignored (event ${eventId}); first fulfilled at ${dedupe.at}`);
      return;
    }
    if (dedupe.reason) console.warn("Idempotency check inconclusive (failing open):", dedupe.reason);

    const result = await runFulfillment(session);
    await markFulfilled(session, eventId);
    console.log("Fulfilled:", result.businessName || result.placeId, `(event ${eventId})`);
  } catch (error) {
    console.error("Fulfillment failed:", error?.message || error);
    // Customer is never emailed a broken report; alert the owner for manual fulfillment instead.
    try {
      await sendFallbackAlert(error, getOrderContext(session), session);
      console.log("Owner fallback alert sent for event", eventId);
    } catch (alertError) {
      console.error("Fallback alert ALSO failed:", alertError?.message || alertError);
    }
  }
}

function headersToObject(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) out[key] = value;
  return out;
}

function json(statusCode, body) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json" }
  });
}
