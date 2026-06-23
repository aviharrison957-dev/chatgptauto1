// Stripe webhook signature verification + Checkout session parsing.
const crypto = require("crypto");
const { requiredEnv } = require("./util");

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

  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const index = part.indexOf("=");
    return index === -1 ? [part, ""] : [part.slice(0, index), part.slice(index + 1)];
  }));
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!timestamp || !signature) {
    throw new Error("Malformed Stripe-Signature header");
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > STRIPE_WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Stripe webhook timestamp outside tolerance");
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(signedPayload, "utf8").digest("hex");
  if (!safeEqualHex(expected, signature)) {
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
  const response = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}`,
    { headers: { Authorization: `Bearer ${stripeSecretKey}` } }
  );
  if (!response.ok) {
    throw new Error(`Stripe session retrieval failed: ${response.status} ${await response.text()}`);
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
    googleBusinessInput
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
