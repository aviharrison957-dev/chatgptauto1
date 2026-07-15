// Best-effort homepage analysis. Turns the customer's website into concrete on-page signals so the
// audit's "website / local signals" section cites real facts. This NEVER throws — any failure returns
// { available: false, reason } so a flaky customer site can't break the whole audit.

const FETCH_TIMEOUT_MS = 7000;
const MAX_BYTES = 600 * 1024;
// Plain modern-Chrome UA. We're fetching the customer's own homepage (at their request via purchase);
// a standard browser UA maximizes successful reads vs. WAFs that block unfamiliar agents.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

const SOCIAL_HOSTS = [
  "facebook.com", "m.facebook.com", "fb.com", "fb.me",
  "instagram.com", "linktr.ee", "yelp.com", "nextdoor.com",
  "linkedin.com", "twitter.com", "x.com", "tiktok.com"
];

function normalizeUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch (_error) {
    return "";
  }
}

// Defense-in-depth: never fetch internal/loopback/link-local/metadata targets server-side, even though
// the URL traces to a Google-listed business website. Basic literal/hostname check (not DNS-rebinding proof).
function isBlockedHost(host) {
  const h = String(host || "").replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h === "metadata.google.internal") return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "::1" || h === "::" || /^(fc|fd|fe80)/i.test(h)) return true;
  // IPv4-mapped IPv6 (e.g. ::ffff:169.254.169.254 / ::ffff:a9fe:a9fe) bypasses the checks above.
  if (/^::ffff:/i.test(h)) return true;
  return false;
}

async function fetchWebsiteSignals(rawUrl) {
  const requestedUrl = normalizeUrl(rawUrl);
  if (!requestedUrl) {
    return { available: false, reason: "No website is linked on the Google Business Profile." };
  }
  if (!/^https?:\/\//i.test(requestedUrl)) {
    return { available: false, requestedUrl, reason: "Website URL uses an unsupported scheme." };
  }

  const host = hostOf(requestedUrl);
  if (isBlockedHost(host)) {
    return { available: false, requestedUrl, host, reason: "Website host is a private/internal address; skipped for safety." };
  }
  const isSocialOnly = SOCIAL_HOSTS.some((social) => host === social || host.endsWith(`.${social}`));

  try {
    const response = await fetch(requestedUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" }
    });

    const finalUrl = response.url || requestedUrl;
    const contentType = response.headers.get("content-type") || "";
    const base = {
      available: true,
      requestedUrl,
      finalUrl,
      host,
      isSocialOnly,
      httpStatus: response.status,
      https: finalUrl.startsWith("https://"),
      redirectedToDifferentHost: hostOf(finalUrl) !== host
    };

    // If a redirect landed on a private/internal host, don't read or use the body.
    if (isBlockedHost(hostOf(finalUrl))) {
      return { ...base, reachable: false, reason: "Redirect target is a private/internal address; skipped for safety." };
    }

    if (!response.ok) {
      return { ...base, reachable: false, reason: `Homepage returned HTTP ${response.status}.` };
    }
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return { ...base, reachable: true, reason: `Homepage is not HTML (content-type ${contentType || "unknown"}).` };
    }

    const html = await readCapped(response, MAX_BYTES);
    return { ...base, reachable: true, ...extractSignals(html) };
  } catch (error) {
    const reason = error?.name === "TimeoutError"
      ? `Homepage did not respond within ${FETCH_TIMEOUT_MS / 1000}s.`
      : `Homepage could not be retrieved (${error?.message || "network error"}).`;
    return { available: false, requestedUrl, host, isSocialOnly, reason };
  }
}

async function readCapped(response, maxBytes) {
  // Stream and stop once we have enough HTML to read the <head> and visible copy.
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let out = "";
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    out += decoder.decode(value, { stream: true });
  }
  try { await reader.cancel(); } catch (_error) { /* ignore */ }
  return out;
}

function extractSignals(html) {
  const head = html.slice(0, 200000);
  const title = matchText(head, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    attr(head, /<meta[^>]+name=["']description["'][^>]*>/i, "content") ||
    attr(head, /<meta[^>]+property=["']og:description["'][^>]*>/i, "content");
  const h1 = matchText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);

  const telLinks = (html.match(/href=["']tel:/gi) || []).length;
  const mailtoLinks = (html.match(/href=["']mailto:/gi) || []).length;
  const formCount = (html.match(/<form[\s>]/gi) || []).length;
  const hasViewportMeta = /<meta[^>]+name=["']viewport["']/i.test(head);

  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const jsonLdText = jsonLdBlocks.join(" ").toLowerCase();
  const hasAnyStructuredData = jsonLdBlocks.length > 0;
  const hasLocalBusinessSchema =
    /"@type"\s*:\s*\[?\s*"(?:localbusiness|plumber|hvacbusiness|electrician|locksmith|generalcontractor|homeandconstructionbusiness|autorepair|roofingcontractor|professionalservice|restaurant|store|legalservice|movingcompany|housepainter|landscaper|pestcontrolbusiness)"/i.test(jsonLdText);

  return {
    title: title || null,
    titleLength: title ? title.length : 0,
    metaDescription: metaDescription || null,
    h1: h1 || null,
    clickToCallLinks: telLinks,
    mailtoLinks,
    formCount,
    hasViewportMeta,
    hasStructuredData: hasAnyStructuredData,
    hasLocalBusinessSchema,
    textSnippet: visibleText(html).slice(0, 1500)
  };
}

function matchText(html, regex) {
  const m = html.match(regex);
  return m ? collapse(stripTags(m[1])) : "";
}

function attr(html, tagRegex, attrName) {
  const tag = html.match(tagRegex);
  if (!tag) return "";
  const m = tag[0].match(new RegExp(`${attrName}=["']([^"']*)["']`, "i"));
  return m ? collapse(decodeEntities(m[1])) : "";
}

function visibleText(html) {
  return collapse(
    decodeEntities(
      html
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function stripTags(value) {
  return decodeEntities(String(value).replace(/<[^>]+>/g, " "));
}

function decodeEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function collapse(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

module.exports = { fetchWebsiteSignals, normalizeUrl, hostOf };
