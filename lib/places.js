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
  const placeId = await resolvePlaceId(input, apiKey);

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
  return response.json();
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

// Accepts a raw Place ID, a "places/..." resource name, or a Google Maps / Business Profile URL.
async function resolvePlaceId(input, apiKey) {
  let trimmed = String(input || "").trim();
  if (!trimmed) {
    throw new Error("No Google Business Profile URL or Place ID was provided");
  }
  let extracted = extractPlaceId(trimmed);
  if (extracted) return extracted;

  // Expand a Maps short link (maps.app.goo.gl / goo.gl/maps / g.co) to the full URL, then re-extract —
  // this is the most common thing a customer pastes and it carries no Place ID until expanded. (Codex)
  if (isMapsShortLink(trimmed)) {
    const expanded = await expandShortLink(trimmed);
    if (expanded) {
      trimmed = expanded;
      extracted = extractPlaceId(trimmed);
      if (extracted) return extracted;
    }
  }

  // Fall back to Text Search (the customer likely pasted a business name or a short Maps URL).
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress"
    },
    body: JSON.stringify({ textQuery: cleanQueryFromInput(trimmed), maxResultCount: 1 }),
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
  return placeId;
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
  extractPlaceId,
  isMapsShortLink,
  cleanQueryFromInput,
  summarizePlaceForPrompt
};
