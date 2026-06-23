// Google Places API (New) — Place Details fetch + Place ID resolution.
const { requiredEnv } = require("./util");

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

// Richer set for a more specific audit. If Google rejects any of these (400), we retry with SAFE_FIELDS
// so a single deprecated/renamed field can never break fulfillment.
const RICH_FIELDS = SAFE_FIELDS.concat([
  "primaryType",
  "primaryTypeDisplayName",
  "editorialSummary",
  "addressComponents",
  "currentOpeningHours",
  "pureServiceAreaBusiness"
]);

const PLACE_DETAILS_BASE = "https://places.googleapis.com/v1/places";

async function fetchPlaceDetailsWithMask(placeId, apiKey, fields) {
  return fetch(`${PLACE_DETAILS_BASE}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields.join(",")
    }
  });
}

async function fetchPlaceDetails(input) {
  const apiKey = requiredEnv("GOOGLE_PLACES_API_KEY");
  const placeId = await resolvePlaceId(input, apiKey);

  let response = await fetchPlaceDetailsWithMask(placeId, apiKey, RICH_FIELDS);
  if (response.status === 400) {
    // Most likely an unsupported field in the rich mask; retry with the conservative set.
    response = await fetchPlaceDetailsWithMask(placeId, apiKey, SAFE_FIELDS);
  }
  if (!response.ok) {
    throw new Error(`Google Place Details failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

// Accepts a raw Place ID, a "places/..." resource name, or a Google Maps / Business Profile URL.
async function resolvePlaceId(input, apiKey) {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    throw new Error("No Google Business Profile URL or Place ID was provided");
  }
  const extracted = extractPlaceId(trimmed);
  if (extracted) return extracted;

  // Fall back to Text Search (the customer likely pasted a business name or a short Maps URL).
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress"
    },
    body: JSON.stringify({ textQuery: cleanQueryFromInput(trimmed), maxResultCount: 1 })
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
  cleanQueryFromInput,
  summarizePlaceForPrompt
};
