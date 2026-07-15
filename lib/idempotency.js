// Webhook idempotency (PROPOSALS P1, promoted in-scope 2026-07-15): Stripe delivers events
// at-least-once, so a retried/duplicated/replayed checkout.session.completed must not email the
// customer twice. The durable dedupe record is metadata on the session's PaymentIntent — Stripe
// itself is the store, so there is no new database or account.
//
// Semantics are deliberately FAIL-OPEN: if the metadata read/write fails, fulfillment proceeds.
// The worst outcome of a dedupe outage is one extra identical email; the worst outcome of
// fail-closed would be a paid order never fulfilled. Known residual: two deliveries processed
// concurrently (same second) can both pass the check — Stripe retry spacing makes that window
// practically empty; documented in SECURITY_AUDIT.md.
const { requiredEnv } = require("./util");

const STRIPE_API_TIMEOUT_MS = 10000;
const FULFILLED_AT_KEY = "mapgap_fulfilled_at";
const FULFILLED_EVENT_KEY = "mapgap_fulfilled_event";

function paymentIntentIdOf(session) {
  const pi = session?.payment_intent;
  if (typeof pi === "string" && pi.startsWith("pi_")) return pi;
  if (pi && typeof pi === "object" && typeof pi.id === "string") return pi.id;
  return "";
}

// Returns { fulfilled: boolean, at?: string, reason?: string }. Never throws.
async function checkAlreadyFulfilled(session) {
  const piId = paymentIntentIdOf(session);
  if (!piId) return { fulfilled: false, reason: "no payment_intent on session (cannot dedupe)" };
  try {
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(piId)}`, {
      headers: { Authorization: `Bearer ${requiredEnv("STRIPE_SECRET_KEY")}` },
      signal: AbortSignal.timeout(STRIPE_API_TIMEOUT_MS)
    });
    if (!response.ok) return { fulfilled: false, reason: `metadata read failed: HTTP ${response.status}` };
    const intent = await response.json();
    const at = intent?.metadata?.[FULFILLED_AT_KEY];
    return at ? { fulfilled: true, at } : { fulfilled: false };
  } catch (error) {
    return { fulfilled: false, reason: `metadata read failed: ${error?.message || error}` };
  }
}

// Best-effort durable mark AFTER the customer email was accepted. Never throws — the email is
// already delivered, so a metadata failure must not trigger the owner fallback alert.
async function markFulfilled(session, eventId) {
  const piId = paymentIntentIdOf(session);
  if (!piId) return false;
  try {
    const body = new URLSearchParams({
      [`metadata[${FULFILLED_AT_KEY}]`]: new Date().toISOString(),
      [`metadata[${FULFILLED_EVENT_KEY}]`]: String(eventId || "unknown").slice(0, 500)
    });
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${encodeURIComponent(piId)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("STRIPE_SECRET_KEY")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body,
      signal: AbortSignal.timeout(STRIPE_API_TIMEOUT_MS)
    });
    if (!response.ok) {
      console.error("Idempotency mark failed:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Idempotency mark failed:", error?.message || error);
    return false;
  }
}

module.exports = { checkAlreadyFulfilled, markFulfilled, paymentIntentIdOf, FULFILLED_AT_KEY };
