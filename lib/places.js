// Google Places API (New) — Place Details fetch + Place ID resolution.
const { requiredEnv, readUpstreamError } = require("./util");

// Confident, always-valid field set. Used as the fallback if the rich mask is ever rejected.
const SAFE_FIELDS = [
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
];

// Richer set for a more specific audit. If Google rejects the mask (400), we drop only the offending
// optional field(s) and retry, then fall back to SAFE_FIELDS — so one deprecated/renamed field can
// never strip the others or break fulfillment.
const OPTIONAL_FIELDS = [
  "primaryType",
  "primaryTypeDisplayName",
  "editorialSummary",
  "addressComponents",
  "pureServiceAreaBusiness"
];
const RICH_FIELDS = SAFE_FIELDS.concat(OPTIONAL_FIELDS);

const PLACE_DETAILS_BASE = "https://places.googleapis.com/v1/places";
// Explicit timeout on every Google call: under Vercel's hard 300s maxDuration, an unbounded hang
// would let the platform kill the instance before the owner-alert path runs (silent order loss).
const PLACES_TIMEOUT_MS = 15000;

async function fetchPlaceDetailsWithMask(placeId, apiKey, fields) {
  return fetch(`${PLACE_DETAILS_BASE}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields.join(",")
    },
    signal: AbortSignal.timeout(PLACES_TIMEOUT_MS)
  });
}

async function fetchPlaceDetails(input) {
  const apiKey = requiredEnv("GOOGLE_PLACES_API_KEY");
  const resolution = await resolvePlaceIdDetailed(input, apiKey);
  const placeId = resolution.placeId;

  let response = await fetchPlaceDetailsWithMask(placeId, apiKey, RICH_FIELDS);
  if (response.status === 400) {
    const errText = await response.text();
    // Drop only the optional fields Google named in the error; keep every other rich field.
    const offending = OPTIONAL_FIELDS.filter((field) => errText.includes(field));
    const reduced = offending.length ? RICH_FIELDS.filter((field) => !offending.includes(field)) : SAFE_FIELDS;
    response = await fetchPlaceDetailsWithMask(placeId, apiKey, reduced);
    if (response.status === 400) {
      response = await fetchPlaceDetailsWithMask(placeId, apiKey, SAFE_FIELDS);
    }
  }
  if (!response.ok) {
    throw new Error(`Google Place Details failed: ${response.status} ${await readUpstreamError(response)}`);
  }
  const place = await response.json();

  // A Place ID lifted straight out of the customer's link is definitionally right. A Text Search hit is
  // a guess: Google returns its single best match for the string with no confidence score, so "Watson
  // Plumbing & Associates" happily resolves to "Watson's Plumbing & Heating Corporation" — a different
  // company. Refuse rather than email a $249 audit about the wrong business; the owner alert carries
  // both names and the order is fulfilled by hand in a minute.
  if (resolution.via === "text_search") {
    const verdict = namesPlausiblyMatch(resolution.query, place.displayName?.text);
    if (!verdict.ok) {
      throw new Error(
        `Resolved business does not match what the customer asked for: they entered ` +
        `"${resolution.query}" and Google's best match was "${place.displayName?.text}" ` +
        `(${place.formattedAddress || "no address"}). Not auditing a business the customer did not buy.`
      );
    }
    place.mapgapResolution = { via: resolution.via, query: resolution.query, verdict: verdict.verdict };
  } else {
    place.mapgapResolution = { via: resolution.via, verdict: "exact" };
  }
  return place;
}

// Short-link hosts Google Maps' "Share" button produces. These carry no Place ID in the URL, so we must
// follow the redirect to the real Maps URL (which does) before extraction / Text Search.
const SHORT_LINK_HOSTS = ["maps.app.goo.gl", "goo.gl", "g.co"];

function isMapsShortLink(input) {
  try {
    const host = new URL(input).hostname.replace(/^www\./i, "").toLowerCase();
    return SHORT_LINK_HOSTS.includes(host);
  } catch (_error) {
    return false;
  }
}

// Follow a Maps short link to its expanded URL (Location header). Best-effort: returns "" on any failure so
// the caller falls back to Text Search. Does not read the body.
async function expandShortLink(input) {
  try {
    const response = await fetch(input, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MapGapReport/1.0)" },
      signal: AbortSignal.timeout(8000)
    });
    const location = response.headers.get("location");
    if (location && /^https?:\/\//i.test(location)) return location;
    // Some short links 200 with the canonical URL only in the body/JS; we intentionally don't parse bodies.
    return response.url && response.url !== input ? response.url : "";
  } catch (_error) {
    return "";
  }
}

// A Google Maps "cid" link (https://maps.google.com/?cid=123...) is the canonical URL Google itself
// hands out for a business, but it carries NO Place ID, expands only to another cid URL, and serves a
// JS shell with no business name in the markup. There is no supported way to turn one into a Place ID.
// Before this guard existed it fell through to Text Search, which searched for the literal URL string
// and returned nothing -> a paid order failed with a generic "could not resolve". Now it fails with an
// instruction the owner can act on in seconds. (Found by the cardless proof run, 2026-08-31.)
function isCidOnlyMapsUrl(input) {
  if (!/^https?:\/\//i.test(input)) return false;
  if (extractPlaceId(input)) return false;
  return /[?&]cid=\d+/i.test(input);
}

// Words that carry no identifying signal: legal suffixes, and the trade/service vocabulary shared by
// every business in this market. Two businesses matching only on these are NOT the same business.
const GENERIC_NAME_TOKENS = new Set([
  "llc","inc","incorporated","corp","corporation","co","company","companies","ltd","lp","llp","pllc",
  "the","and","of","for","your","my","best","local","area","service","services","solutions","group",
  "plumbing","plumber","plumbers","roofing","roofer","roofers","electric","electrical","electrician",
  "electricians","hvac","heating","cooling","air","conditioning","ac","pest","control","exterminating",
  "lawn","care","landscaping","tree","construction","contractor","contractors","contracting","builders",
  "remodeling","restoration","cleaning","cleaners","repair","repairs","home","house","pro","pros",
  "expert","experts","master","masters","quality","affordable","professional","brothers","sons","son"
]);

function nameTokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")          // Watson's -> watsons
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t))  // watsons -> watson
    .filter((t) => t.length > 1 && !GENERIC_NAME_TOKENS.has(t));
}

// Loose on purpose. A false block costs a manual fulfillment; a false pass emails a $249 audit about
// somebody else's business. Any shared distinctive token is enough to pass. When the customer's input
// has no distinctive token at all we cannot judge, so we allow it and mark the result unverified
// rather than blocking a legitimate order.
function namesPlausiblyMatch(query, resolvedName) {
  const q = nameTokens(query);
  const r = nameTokens(resolvedName);
  if (!q.length || !r.length) return { ok: true, verdict: "unverifiable" };
  const shared = q.filter((t) => r.includes(t));
  return shared.length
    ? { ok: true, verdict: "matched", shared }
    : { ok: false, verdict: "mismatch", queryTokens: q, resolvedTokens: r };
}

// Accepts a raw Place ID, a "places/..." resource name, or a Google Maps / Business Profile URL.
// Returns { placeId, via, query }: `via` is "exact" when a Place ID was read straight out of the
// input, "text_search" when we had to guess from a name. Only the guessed path needs verifying.
async function resolvePlaceIdDetailed(input, apiKey) {
  let trimmed = String(input || "").trim();
  if (!trimmed) {
    throw new Error("No Google Business Profile URL or Place ID was provided");
  }
  let extracted = extractPlaceId(trimmed);
  if (extracted) return { placeId: extracted, via: "exact", query: trimmed };

  // Expand a Maps short link (maps.app.goo.gl / goo.gl/maps / g.co) to the full URL, then re-extract —
  // this is the most common thing a customer pastes and it carries no Place ID until expanded. (Codex)
  if (isMapsShortLink(trimmed)) {
    const expanded = await expandShortLink(trimmed);
    if (expanded) {
      trimmed = expanded;
      extracted = extractPlaceId(trimmed);
      if (extracted) return { placeId: extracted, via: "exact", query: trimmed };
    }
  }

  if (isCidOnlyMapsUrl(trimmed)) {
    throw new Error(
      "That Google Maps link is a 'cid' link, which does not identify the business to the Places API. " +
      "Ask the customer for their Business Profile link (one containing place_id=), or the exact " +
      `business name plus city. Input was: ${trimmed.slice(0, 200)}`
    );
  }

  const query = cleanQueryFromInput(trimmed);
  // Never hand a raw URL to Text Search: it searches for the literal string and returns junk or nothing.
  if (/^https?:\/\//i.test(query)) {
    throw new Error(
      "Could not read a business name or Place ID out of that link. Ask the customer for their " +
      `Business Profile link or the business name plus city. Input was: ${trimmed.slice(0, 200)}`
    );
  }

  // Fall back to Text Search (the customer likely pasted a business name or a short Maps URL).
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress"
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
    signal: AbortSignal.timeout(PLACES_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`Google Text Search failed while resolving Place ID: ${response.status} ${await readUpstreamError(response)}`);
  }
  const data = await response.json();
  const placeId = data.places?.[0]?.id;
  if (!placeId) {
    throw new Error("Google could not resolve the supplied Business Profile URL or Place ID");
  }
  return { placeId, via: "text_search", query };
}

async function resolvePlaceId(input, apiKey) {
  return (await resolvePlaceIdDetailed(input, apiKey)).placeId;
}

function extractPlaceId(input) {
  // Resource name form: "places/ChIJ..."
  if (/^places\/[A-Za-z0-9_-]+$/.test(input)) {
    return input.replace(/^places\//, "");
  }
  // Bare Place ID (ChI... is the common prefix).
  if (/^ChI[A-Za-z0-9_-]{10,}$/.test(input)) {
    return input;
  }
  // ?place_id=... or &query_place_id=... in a URL
  const placeIdMatch = input.match(/[?&](?:query_)?place_id=([^&#]+)/i);
  if (placeIdMatch) {
    return decodeURIComponent(placeIdMatch[1]);
  }
  // /places/<id> path segment
  const pathMatch = input.match(/\/places\/([^/?#]+)/i);
  if (pathMatch && /^[A-Za-z0-9_-]+$/.test(pathMatch[1])) {
    return decodeURIComponent(pathMatch[1]);
  }
  return "";
}

// Turn a pasted Maps URL into a readable text query when we couldn't pull a Place ID out of it.
function cleanQueryFromInput(input) {
  if (!/^https?:\/\//i.test(input)) return input;
  try {
    const url = new URL(input);
    // Google Maps "/place/<Business+Name>/..." pattern.
    const placeName = url.pathname.match(/\/place\/([^/@]+)/i);
    if (placeName) {
      return decodeURIComponent(placeName[1].replace(/\+/g, " ")).trim();
    }
    const q = url.searchParams.get("q") || url.searchParams.get("query");
    if (q) return q;
    return input;
  } catch (_error) {
    return input;
  }
}

// Compact, model-friendly projection of the Places payload (only what the audit prompt needs).
function summarizePlaceForPrompt(place) {
  return {
    id: place.id,
    name: place.displayName?.text,
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    website: place.websiteUri || null,
    googleMapsUri: place.googleMapsUri || null,
    businessStatus: place.businessStatus || null,
    primaryCategory: place.primaryTypeDisplayName?.text || place.primaryType || null,
    allCategories: Array.isArray(place.types) ? place.types : [],
    editorialSummary: place.editorialSummary?.text || null,
    isServiceAreaBusiness: place.pureServiceAreaBusiness === true ? true
      : place.pureServiceAreaBusiness === false ? false : null,
    hoursListed: Array.isArray(place.regularOpeningHours?.weekdayDescriptions)
      && place.regularOpeningHours.weekdayDescriptions.length > 0,
    hours: place.regularOpeningHours?.weekdayDescriptions || [],
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : 0,
    photoCount: Array.isArray(place.photos) ? place.photos.length : 0,
    recentReviews: (place.reviews || []).slice(0, 5).map((review) => ({
      rating: review.rating,
      when: review.relativePublishTimeDescription || null,
      author: review.authorAttribution?.displayName || null,
      text: (review.text?.text || review.originalText?.text || "").slice(0, 600)
    }))
  };
}

module.exports = {
  SAFE_FIELDS,
  RICH_FIELDS,
  fetchPlaceDetails,
  resolvePlaceId,
  resolvePlaceIdDetailed,
  isCidOnlyMapsUrl,
  namesPlausiblyMatch,
  extractPlaceId,
  isMapsShortLink,
  cleanQueryFromInput,
  summarizePlaceForPrompt
};
