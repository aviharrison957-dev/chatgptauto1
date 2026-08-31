// End-to-end fulfillment for one completed Checkout session. The happy path throws on any failure so
// the caller can fire the owner fallback alert (the customer is never sent a broken/apologetic email).
const { hydrateCheckoutSession, getOrderContext, validateOrderContext } = require("./stripe");
const { fetchPlaceDetails } = require("./places");
const { fetchWebsiteSignals } = require("./website");
const { generateAuditHtml } = require("./audit");
const { sendCustomerAudit } = require("./email");
const { trace } = require("./trace");

async function runFulfillment(rawSession) {
  const session = await hydrateCheckoutSession(rawSession);
  const order = getOrderContext(session);
  validateOrderContext(order);

  const t0 = Date.now();
  const place = await fetchPlaceDetails(order.googleBusinessInput);
  trace("place_resolved", session.id, {
    placeId: place.id,
    business: place.displayName?.text || null,
    hasWebsite: Boolean(place.websiteUri),
    // How we got here matters: "exact" means the Place ID came out of the customer's own link;
    // "text_search" means Google guessed from a name and the name-match guard let it through.
    resolvedVia: place.mapgapResolution?.via || null,
    resolvedVerdict: place.mapgapResolution?.verdict || null,
    ms: Date.now() - t0
  });

  // Website analysis is best-effort and must never break fulfillment — fetchWebsiteSignals never throws.
  const website = await fetchWebsiteSignals(place.websiteUri);

  const t1 = Date.now();
  const { html, model, usage } = await generateAuditHtml(place, order, website);
  trace("audit_generated", session.id, {
    model,
    htmlBytes: html ? html.length : 0,
    tokens: usage?.total_tokens ?? null,
    websiteAnalyzed: website?.available === true,
    ms: Date.now() - t1
  });

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
