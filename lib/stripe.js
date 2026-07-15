// Stripe webhook signature verification + Checkout session parsing.
const crypto = require("crypto");
const { requiredEnv, readUpstreamError } = require("./util");

const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

function getRawBody(event) {
  if (!event.body) return "";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

function getHeader(headers, name) {
  const lowerName = name.toLowerCase();
  const key = Object.keys(headers || {}).find((header) => header.toLowerCase() === lowerName);
  return key ? headers[key] : undefined;
}

function safeEqualHex(left, right) {
  let leftBuffer;
  let rightBuffer;
  try {
    leftBuffer = Buffer.from(left, "hex");
    rightBuffer = Buffer.from(right, "hex");
  } catch (_error) {
    return false;
  }
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

// Verifies the Stripe-Signature header and returns the parsed event. Throws on any mismatch.
function verifyStripeWebhook(rawBody, headers, webhookSecret) {
  const signatureHeader = getHeader(headers, "stripe-signature");
  if (!signatureHeader) {
    throw new Error("Missing Stripe-Signature header");
  }

  // Collect ALL v1 signatures, not just the last: during signing-secret rotation Stripe sends several v1
  // values (one per active secret), and keeping only the last would reject a legitimately-signed event and
  // drop the order. Accept if ANY v1 matches. (Codex)
  let timestamp = 0;
  const v1Signatures = [];
  for (const part of signatureHeader.split(",")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index);
    const value = part.slice(index + 1);
    if (key === "t") timestamp = Number(value);
    else if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) {
    throw new Error("Malformed Stripe-Signature header");
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Stripe webhook timestamp outside tolerance");
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(signedPayload, "utf8").digest("hex");
  if (!v1Signatures.some((sig) => safeEqualHex(expected, sig))) {
    throw new Error("Stripe webhook signature mismatch");
  }

  return JSON.parse(rawBody);
}

// Checkout webhooks can arrive without expanded customer_details/custom_fields; re-fetch to be safe.
async function hydrateCheckoutSession(session) {
  if (session.customer_details && Array.isArray(session.custom_fields)) {
    return session;
  }
  const stripeSecretKey = requiredEnv("STRIPE_SECRET_KEY");
  // Explicit timeout: under Vercel's hard 300s maxDuration, an unbounded hang here would let the
  // platform kill the instance before the owner-alert path runs (silent loss of a paid order).
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` }, signal: AbortSignal.timeout(15000) }
  );
  if (!response.ok) {
    throw new Error(`Stripe session retrieval failed: ${response.status} ${await readUpstreamError(response)}`);
  }
  return response.json();
}

function getOrderContext(session) {
  const customerEmail = session.customer_details?.email || session.customer_email || "";
  const googleBusinessInput = extractGoogleBusinessInput(session.custom_fields || []);
  return {
    checkoutSessionId: session.id || "",
    paymentIntentId: session.payment_intent || "",
    customerEmail,
    customerName: session.customer_details?.name || "",
    googleBusinessInput,
    // Carried so validateOrderContext can refuse to fulfill an unpaid/wrong-mode session (see below).
    paymentStatus: session.payment_status || "",
    mode: session.mode || ""
  };
}

function extractGoogleBusinessInput(customFields) {
  const preferredKeys = [
    "google_business_profile_url",
    "google_business_profile",
    "gbp_url",
    "place_id",
    "google_place_id"
  ];

  const field = (customFields || []).find((item) => {
    const key = String(item.key || "").toLowerCase();
    const label = String(item.label?.custom || item.label?.type || "").toLowerCase();
    return preferredKeys.includes(key) || label.includes("google business") || label.includes("place id");
  });

  if (!field) return "";
  return field.text?.value || field.dropdown?.value || field.numeric?.value || "";
}

function validateOrderContext(orderContext) {
  // Only fulfill a genuinely PAID one-time purchase. A signed checkout.session.completed alone is not proof
  // of payment: delayed-payment methods complete a session as "unpaid" (payment settles later), and any
  // other Checkout/product on the same Stripe account would also be signed. Refuse anything but a paid,
  // payment-mode session so we never generate a paid-for audit for an order that wasn't paid. (Codex HIGH)
  // Tolerate an ABSENT payment_status (older/edge payloads) but reject an explicit non-"paid" value.
  if (orderContext.paymentStatus && orderContext.paymentStatus !== "paid") {
    throw new Error(`Stripe session is not paid (payment_status=${orderContext.paymentStatus}); not fulfilling`);
  }
  if (orderContext.mode && orderContext.mode !== "payment") {
    throw new Error(`Stripe session is not a one-time payment (mode=${orderContext.mode}); not fulfilling`);
  }
  if (!orderContext.customerEmail) {
    throw new Error("Stripe session did not include a customer email");
  }
  if (!orderContext.googleBusinessInput) {
    throw new Error("Stripe session did not include the Google Business Profile URL or Place ID custom field");
  }
}

module.exports = {
  STRIPE_WEBHOOK_TOLERANCE_SECONDS,
  getRawBody,
  getHeader,
  verifyStripeWebhook,
  hydrateCheckoutSession,
  getOrderContext,
  extractGoogleBusinessInput,
  validateOrderContext
};
