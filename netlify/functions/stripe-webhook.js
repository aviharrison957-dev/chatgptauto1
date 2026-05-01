const crypto = require("crypto");

const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const GOOGLE_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "regularOpeningHours",
  "rating",
  "userRatingCount",
  "reviews",
  "photos",
  "types",
  "businessStatus",
  "googleMapsUri"
].join(",");

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let stripeEvent;
  try {
    const rawBody = getRawBody(event);
    stripeEvent = verifyStripeWebhook(rawBody, event.headers || {}, requiredEnv("STRIPE_WEBHOOK_SECRET"));
  } catch (error) {
    return jsonResponse(400, { error: "Invalid Stripe webhook signature" });
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return jsonResponse(200, { received: true, ignored: stripeEvent.type });
  }

  const session = await hydrateCheckoutSession(stripeEvent.data.object);
  const orderContext = getOrderContext(session);

  try {
    validateOrderContext(orderContext);
    const place = await fetchPlaceDetails(orderContext.googleBusinessInput);
    const auditHtml = await generateAuditHtml(place, orderContext);
    await sendCustomerAudit(orderContext.customerEmail, auditHtml, place, orderContext);
  } catch (error) {
    await sendFallbackAlert(error, orderContext, session);
  }

  return jsonResponse(200, { received: true });
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getRawBody(event) {
  if (!event.body) return "";
  return event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
}

function verifyStripeWebhook(rawBody, headers, webhookSecret) {
  const signatureHeader = getHeader(headers, "stripe-signature");
  if (!signatureHeader) {
    throw new Error("Missing Stripe-Signature header");
  }

  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
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

function safeEqualHex(left, right) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getHeader(headers, name) {
  const lowerName = name.toLowerCase();
  const key = Object.keys(headers).find((header) => header.toLowerCase() === lowerName);
  return key ? headers[key] : undefined;
}

async function hydrateCheckoutSession(session) {
  if (session.customer_details && Array.isArray(session.custom_fields)) {
    return session;
  }
  const stripeSecretKey = requiredEnv("STRIPE_SECRET_KEY");
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}`, {
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`
    }
  });
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

  const field = customFields.find((item) => {
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

async function fetchPlaceDetails(input) {
  const apiKey = requiredEnv("GOOGLE_PLACES_API_KEY");
  const placeId = await resolvePlaceId(input, apiKey);
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_FIELD_MASK
    }
  });
  if (!response.ok) {
    throw new Error(`Google Place Details failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function resolvePlaceId(input, apiKey) {
  const trimmed = String(input || "").trim();
  const extracted = extractPlaceId(trimmed);
  if (extracted) return extracted;

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress"
    },
    body: JSON.stringify({ textQuery: trimmed, maxResultCount: 1 })
  });
  if (!response.ok) {
    throw new Error(`Google Text Search failed while resolving Place ID: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const placeId = data.places?.[0]?.id;
  if (!placeId) {
    throw new Error("Google could not resolve the supplied Business Profile URL or Place ID");
  }
  return placeId;
}

function extractPlaceId(input) {
  if (/^places\/[A-Za-z0-9_-]+$/.test(input)) {
    return input.replace(/^places\//, "");
  }
  if (/^ChI[A-Za-z0-9_-]{10,}$/.test(input)) {
    return input;
  }
  const placeIdMatch = input.match(/[?&]place_id=([^&#]+)/i);
  if (placeIdMatch) {
    return decodeURIComponent(placeIdMatch[1]);
  }
  const pathMatch = input.match(/\/places\/([^/?#]+)/i);
  if (pathMatch) {
    return decodeURIComponent(pathMatch[1]);
  }
  return "";
}

async function generateAuditHtml(place, orderContext) {
  const apiKey = requiredEnv("ANTHROPIC_API_KEY");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 3500,
      temperature: 0.2,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({ order: orderContext, googlePlace: summarizePlaceForPrompt(place) }, null, 2)
            }
          ]
        }
      ]
    })
  });
  if (!response.ok) {
    throw new Error(`Anthropic audit generation failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const html = data.content?.map((part) => part.type === "text" ? part.text : "").join("").trim();
  if (!html || !/<[a-z][\s\S]*>/i.test(html)) {
    throw new Error("Anthropic returned an empty or non-HTML audit");
  }
  return html;
}

function buildSystemPrompt() {
  return [
    "You write MapGap Report paid audits for owner-operated local service businesses.",
    "Return only complete, email-safe HTML. Use inline styles only. Do not include markdown fences.",
    "The report must be concise, prioritized, and useful within 30 days.",
    "Cover these sections: Google Business Profile gaps, review/reputation patterns, website/local-signal gaps observable from the website URL only, missed-call risk indicators, and a ranked 30-day fix list.",
    "Use only the provided Google Places data and cautious inferences. Never fabricate reviews, testimonials, competitors, rankings, private data, search volume, revenue, or guaranteed outcomes.",
    "If a field is missing, say what could not be confirmed and make the next check explicit.",
    "Do not claim affiliation with Google. Do not promise rankings, calls, or revenue.",
    "Keep the final HTML under 900 words."
  ].join(" ");
}

function summarizePlaceForPrompt(place) {
  return {
    id: place.id,
    name: place.displayName?.text,
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
    website: place.websiteUri,
    googleMapsUri: place.googleMapsUri,
    businessStatus: place.businessStatus,
    hours: place.regularOpeningHours?.weekdayDescriptions || [],
    rating: place.rating,
    userRatingsTotal: place.userRatingCount,
    types: place.types || [],
    photosCount: Array.isArray(place.photos) ? place.photos.length : 0,
    recentReviews: (place.reviews || []).slice(0, 5).map((review) => ({
      rating: review.rating,
      relativePublishTimeDescription: review.relativePublishTimeDescription,
      text: review.text?.text || "",
      author: review.authorAttribution?.displayName || ""
    }))
  };
}

async function sendCustomerAudit(customerEmail, auditHtml, place, orderContext) {
  const subjectName = place.displayName?.text || "your business";
  await sendEmail({
    to: customerEmail,
    subject: `Your MapGap Report for ${subjectName}`,
    html: auditHtml,
    replyTo: process.env.AVI_FALLBACK_EMAIL || undefined,
    tags: [
      { name: "type", value: "customer-audit" },
      { name: "checkout_session", value: safeTagValue(orderContext.checkoutSessionId) }
    ]
  });
}

async function sendFallbackAlert(error, orderContext, session) {
  const fallbackEmail = requiredEnv("AVI_FALLBACK_EMAIL");
  const safeOrder = escapeHtml(JSON.stringify(orderContext, null, 2));
  const safeError = escapeHtml(error.stack || error.message || String(error));
  const safeSession = escapeHtml(JSON.stringify({
    id: session.id,
    amount_total: session.amount_total,
    currency: session.currency,
    customer_details: session.customer_details,
    custom_fields: session.custom_fields
  }, null, 2));

  await sendEmail({
    to: fallbackEmail,
    subject: "MapGap automated audit failed - manual fulfillment needed",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17202a;">
        <h1 style="font-size:20px;">Manual fulfillment needed</h1>
        <p>The customer was not emailed. Use <code>report-builder.html</code> to fulfill this order manually.</p>
        <h2 style="font-size:16px;">Order context</h2>
        <pre style="white-space:pre-wrap;background:#f4f6f8;padding:12px;border-radius:6px;">${safeOrder}</pre>
        <h2 style="font-size:16px;">Stripe session summary</h2>
        <pre style="white-space:pre-wrap;background:#f4f6f8;padding:12px;border-radius:6px;">${safeSession}</pre>
        <h2 style="font-size:16px;">Error</h2>
        <pre style="white-space:pre-wrap;background:#fff1f1;padding:12px;border-radius:6px;">${safeError}</pre>
      </div>
    `,
    tags: [
      { name: "type", value: "fallback-alert" },
      { name: "checkout_session", value: safeTagValue(orderContext.checkoutSessionId) }
    ]
  });
}

async function sendEmail({ to, subject, html, replyTo, tags }) {
  const resendApiKey = requiredEnv("RESEND_API_KEY");
  const payload = {
    from: "MapGap Report <onboarding@resend.dev>",
    to: [to],
    subject,
    html,
    tags
  };
  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Resend email failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function safeTagValue(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

exports._private = {
  extractGoogleBusinessInput,
  extractPlaceId,
  getOrderContext,
  summarizePlaceForPrompt,
  verifyStripeWebhook
};
