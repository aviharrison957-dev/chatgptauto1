// End-to-end fulfillment for one completed Checkout session. The happy path throws on any failure so
// the caller can fire the owner fallback alert (the customer is never sent a broken/apologetic email).
const { hydrateCheckoutSession, getOrderContext, validateOrderContext } = require("./stripe");
const { fetchPlaceDetails } = require("./places");
const { fetchWebsiteSignals } = require("./website");
const { generateAuditHtml } = require("./audit");
const { sendCustomerAudit } = require("./email");

async function runFulfillment(rawSession) {
  const session = await hydrateCheckoutSession(rawSession);
  const order = getOrderContext(session);
  validateOrderContext(order);

  const place = await fetchPlaceDetails(order.googleBusinessInput);

  // Website analysis is best-effort and must never break fulfillment — fetchWebsiteSignals never throws.
  const website = await fetchWebsiteSignals(place.websiteUri);

  const { html, model, usage } = await generateAuditHtml(place, order, website);

  await sendCustomerAudit(order.customerEmail, html, place, order);

  return {
    ok: true,
    placeId: place.id,
    businessName: place.displayName?.text || null,
    customerEmail: order.customerEmail,
    model,
    usage,
    websiteAnalyzed: website?.available === true
  };
}

module.exports = { runFulfillment };
