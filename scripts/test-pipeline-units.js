// Offline regression test for the deterministic half of the pipeline (no network, no API keys).
// Covers Place ID/URL parsing, custom-field extraction, model-output normalization, and HTML rendering.
const assert = require("assert");
const { extractPlaceId, cleanQueryFromInput, summarizePlaceForPrompt,
        isCidOnlyMapsUrl, namesPlausiblyMatch } = require("../lib/places");
const { extractGoogleBusinessInput } = require("../lib/stripe");
const { normalizeAnalysis, extractJson } = require("../lib/audit");
const { renderAuditHtml } = require("../lib/render");
const { fetchWebsiteSignals } = require("../lib/website");
const { signInternal, verifyInternalSignature } = require("../lib/internal");
const { SAMPLE_MODEL_OUTPUT, SAMPLE_PLACE } = require("./_sample-fixture");

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}\n       ${error.message}`);
    process.exitCode = 1;
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}\n       ${error.message}`);
    process.exitCode = 1;
  }
}

// --- Place ID extraction ---------------------------------------------------
check("extractPlaceId: resource name", () => {
  assert.strictEqual(extractPlaceId("places/ChIJN1t_tDeuEmsRUsoyG83frY4"), "ChIJN1t_tDeuEmsRUsoyG83frY4");
});
check("extractPlaceId: bare ChI id", () => {
  assert.strictEqual(extractPlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4"), "ChIJN1t_tDeuEmsRUsoyG83frY4");
});
check("extractPlaceId: place_id query param", () => {
  assert.strictEqual(extractPlaceId("https://maps.google.com/?cid=1&place_id=ChIJabc-123_DEF"), "ChIJabc-123_DEF");
});
check("extractPlaceId: query_place_id param", () => {
  assert.strictEqual(extractPlaceId("https://www.google.com/maps/place/X/data=!4m?query_place_id=ChIJzz_99"), "ChIJzz_99");
});
check("extractPlaceId: plain business name -> empty (triggers text search)", () => {
  assert.strictEqual(extractPlaceId("Roto-Rooter Plumbing Houston"), "");
});

// --- Maps URL -> text query ------------------------------------------------
check("cleanQueryFromInput: maps /place/ URL", () => {
  assert.strictEqual(
    cleanQueryFromInput("https://www.google.com/maps/place/Roto-Rooter+Plumbing/@29.7,-95.3,15z"),
    "Roto-Rooter Plumbing"
  );
});
check("cleanQueryFromInput: non-URL passthrough", () => {
  assert.strictEqual(cleanQueryFromInput("Brightwater Plumbing Austin"), "Brightwater Plumbing Austin");
});

// --- cid-link + wrong-business guards (added 2026-08-31 after the cardless proof run found that
// Google's OWN canonical business URL hard-failed the pipeline on a paid order) ---
check("isCidOnlyMapsUrl: Google's canonical cid URL is flagged", () => {
  assert.strictEqual(isCidOnlyMapsUrl("https://maps.google.com/?cid=5985424890209948681"), true);
  assert.strictEqual(isCidOnlyMapsUrl("https://www.google.com/maps?cid=123456789"), true);
});
check("isCidOnlyMapsUrl: a cid URL that ALSO carries place_id is fine (extractable)", () => {
  assert.strictEqual(isCidOnlyMapsUrl("https://maps.google.com/?cid=1&place_id=ChIJabc-123_DEF"), false);
});
check("isCidOnlyMapsUrl: non-URLs and normal maps URLs are not flagged", () => {
  assert.strictEqual(isCidOnlyMapsUrl("Brightwater Plumbing Austin"), false);
  assert.strictEqual(isCidOnlyMapsUrl("https://www.google.com/maps/place/Roto-Rooter/@29.7,-95.3"), false);
});
check("namesPlausiblyMatch: legal-suffix and trade-word variation still matches", () => {
  assert.strictEqual(namesPlausiblyMatch("Brightwater Plumbing", "Brightwater Plumbing LLC").ok, true);
  assert.strictEqual(namesPlausiblyMatch("Watson Plumbing & Associates LLC", "Watson's Plumbing & Heating Corporation").ok, true);
});
check("namesPlausiblyMatch: a genuinely different business is BLOCKED", () => {
  const v = namesPlausiblyMatch("Brightwater Plumbing Austin", "Ace Plumbing & Heating");
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.verdict, "mismatch");
});
check("namesPlausiblyMatch: shared trade words ALONE do not count as a match", () => {
  assert.strictEqual(namesPlausiblyMatch("Rimmer Electric", "Sunrise Electric Company").ok, false);
});
check("namesPlausiblyMatch: all-generic input is unverifiable, not blocked", () => {
  const v = namesPlausiblyMatch("The Plumbing Company LLC", "Ace Plumbing");
  assert.strictEqual(v.ok, true);
  assert.strictEqual(v.verdict, "unverifiable");
});

// --- Stripe custom field extraction ---------------------------------------
check("extractGoogleBusinessInput: by field key", () => {
  const fields = [{ key: "google_business_profile_url", text: { value: "https://maps.app.goo.gl/abc" } }];
  assert.strictEqual(extractGoogleBusinessInput(fields), "https://maps.app.goo.gl/abc");
});
check("extractGoogleBusinessInput: by label fallback", () => {
  const fields = [{ key: "field_1", label: { custom: "Google Business Profile URL" }, text: { value: "ChIJ_x" } }];
  assert.strictEqual(extractGoogleBusinessInput(fields), "ChIJ_x");
});
check("extractGoogleBusinessInput: none -> empty", () => {
  assert.strictEqual(extractGoogleBusinessInput([{ key: "name", text: { value: "Bob" } }]), "");
});

// --- payment validation (Codex HIGH) --------------------------------------
const { validateOrderContext } = require("../lib/stripe");
check("validateOrderContext: accepts a paid, payment-mode order", () => {
  validateOrderContext({ customerEmail: "a@b.com", googleBusinessInput: "ChIJ_x", paymentStatus: "paid", mode: "payment" });
});
check("validateOrderContext: rejects an UNPAID session", () => {
  assert.throws(() => validateOrderContext({ customerEmail: "a@b.com", googleBusinessInput: "ChIJ_x", paymentStatus: "unpaid", mode: "payment" }), /not paid/);
});
check("validateOrderContext: rejects a non-payment mode (e.g. subscription/setup)", () => {
  assert.throws(() => validateOrderContext({ customerEmail: "a@b.com", googleBusinessInput: "ChIJ_x", paymentStatus: "paid", mode: "subscription" }), /one-time payment/);
});
check("validateOrderContext: tolerates absent payment_status/mode (still needs email+input)", () => {
  validateOrderContext({ customerEmail: "a@b.com", googleBusinessInput: "ChIJ_x", paymentStatus: "", mode: "" });
});

// --- Maps short-link recognition (Codex flow) -----------------------------
const { isMapsShortLink } = require("../lib/places");
check("isMapsShortLink: recognizes maps.app.goo.gl / goo.gl / g.co", () => {
  assert.strictEqual(isMapsShortLink("https://maps.app.goo.gl/abc123"), true);
  assert.strictEqual(isMapsShortLink("https://goo.gl/maps/xyz"), true);
  assert.strictEqual(isMapsShortLink("https://g.co/kgs/abc"), true);
  assert.strictEqual(isMapsShortLink("https://www.google.com/maps/place/X"), false);
  assert.strictEqual(isMapsShortLink("ChIJ_notaurl"), false);
});

// --- summarizePlaceForPrompt ----------------------------------------------
check("summarizePlaceForPrompt: caps reviews at 5 and counts photos", () => {
  const place = {
    id: "p1",
    displayName: { text: "Test Co" },
    userRatingCount: 42,
    rating: 4.6,
    photos: new Array(14).fill({ name: "x" }),
    reviews: new Array(9).fill({ rating: 5, text: { text: "great" } })
  };
  const s = summarizePlaceForPrompt(place);
  assert.strictEqual(s.reviewCount, 42);
  assert.strictEqual(s.photoCount, 14);
  assert.strictEqual(s.recentReviews.length, 5);
});

// --- extractJson defensive parsing ----------------------------------------
check("extractJson: strips code fences", () => {
  assert.deepStrictEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
});
check("extractJson: finds object inside prose", () => {
  assert.deepStrictEqual(extractJson('Here you go: {"a":2} thanks'), { a: 2 });
});
check("extractJson: throws on non-JSON", () => {
  assert.throws(() => extractJson("not json at all"));
});

// --- normalizeAnalysis -----------------------------------------------------
check("normalizeAnalysis: normalizes enums + structure", () => {
  const a = normalizeAnalysis(SAMPLE_MODEL_OUTPUT, { name: "Brightwater Plumbing & Drain" });
  assert.ok(a.sections.length >= 3, "expected sections");
  assert.ok(a.fix_list.length >= 3, "expected fixes");
  // "HIGH" in the fixture should be lowercased to a valid enum.
  const first = a.sections.find((s) => s.key === "gbp").findings[0];
  assert.strictEqual(first.severity, "high");
  // fix list sorted by rank.
  assert.strictEqual(a.fix_list[0].rank, 1);
});
check("normalizeAnalysis: rejects empty object", () => {
  assert.throws(() => normalizeAnalysis({}, { name: "x" }), /sections/);
});
check("normalizeAnalysis: rejects missing fix list", () => {
  assert.throws(
    () => normalizeAnalysis({ sections: [{ key: "gbp", title: "G", findings: [{ observation: "o", severity: "high" }] }] }, { name: "x" }),
    /fix list/
  );
});

// --- renderAuditHtml -------------------------------------------------------
check("renderAuditHtml: produces email-safe HTML with real content + disclaimers", () => {
  const a = normalizeAnalysis(SAMPLE_MODEL_OUTPUT, { name: "Brightwater Plumbing & Drain" });
  const html = renderAuditHtml(a, SAMPLE_PLACE, {});
  assert.ok(html.startsWith("<!doctype html>"), "is an HTML doc");
  assert.ok(html.includes("Brightwater Plumbing &amp; Drain"), "includes escaped business name");
  assert.ok(/30-day fix list/i.test(html), "includes fix list heading");
  assert.ok(/not affiliated with or endorsed by Google/i.test(html), "includes Google disclaimer");
  assert.ok(/no guarantee of search rankings/i.test(html), "includes no-ranking disclaimer");
  assert.ok(!/<script/i.test(html), "contains no script tags");
  assert.ok(html.includes('style="'), "uses inline styles");
});

check("renderAuditHtml: drops a non-https googleMapsUri (no javascript: href) [SECURITY_AUDIT F1]", () => {
  const a = normalizeAnalysis(SAMPLE_MODEL_OUTPUT, { name: "Brightwater Plumbing & Drain" });
  const html = renderAuditHtml(a, { ...SAMPLE_PLACE, googleMapsUri: "javascript:alert(1)" }, {});
  assert.ok(!/javascript:/i.test(html), "no javascript: URI reaches the output");
  assert.ok(!/href="javascript/i.test(html), "no javascript href rendered");
  const httpsHtml = renderAuditHtml(a, { ...SAMPLE_PLACE, googleMapsUri: "https://maps.google.com/?cid=1" }, {});
  assert.ok(httpsHtml.includes("View on Google Maps"), "a legitimate https maps link still renders");
});

// --- internal worker-trigger signature -------------------------------------
const INTERNAL_SECRET = "whsec_test_secret_value";
check("internal signature: verifies a correct round-trip", () => {
  const body = JSON.stringify({ session: { id: "cs_test" } });
  const sig = signInternal(body, INTERNAL_SECRET);
  verifyInternalSignature(body, { "x-mapgap-signature": sig }, INTERNAL_SECRET);
});
check("internal signature: rejects a tampered body", () => {
  const sig = signInternal(JSON.stringify({ session: { id: "cs_a" } }), INTERNAL_SECRET);
  assert.throws(() => verifyInternalSignature(JSON.stringify({ session: { id: "cs_b" } }), { "x-mapgap-signature": sig }, INTERNAL_SECRET));
});
check("internal signature: rejects a wrong secret", () => {
  const body = JSON.stringify({ session: { id: "cs_c" } });
  const sig = signInternal(body, INTERNAL_SECRET);
  assert.throws(() => verifyInternalSignature(body, { "x-mapgap-signature": sig }, "whsec_other"));
});
check("internal signature: rejects a missing header", () => {
  assert.throws(() => verifyInternalSignature("{}", {}, INTERNAL_SECRET));
});

// --- website SSRF guard (returns before any network for blocked hosts) ------
(async () => {
  await checkAsync("website: blocks IPv4-mapped IPv6 metadata (::ffff:)", async () => {
    const s = await fetchWebsiteSignals("http://[::ffff:a9fe:a9fe]/");
    assert.strictEqual(s.available, false);
  });
  await checkAsync("website: blocks localhost", async () => {
    const s = await fetchWebsiteSignals("http://localhost:8080/");
    assert.strictEqual(s.available, false);
  });
  await checkAsync("website: blocks link-local 169.254", async () => {
    const s = await fetchWebsiteSignals("http://169.254.169.254/latest/meta-data/");
    assert.strictEqual(s.available, false);
  });
  await checkAsync("website: blocks non-http scheme", async () => {
    const s = await fetchWebsiteSignals("ftp://example.com/file");
    assert.strictEqual(s.available, false);
  });
  await checkAsync("website: blocks trailing-dot localhost. [SECURITY_AUDIT F2]", async () => {
    const s = await fetchWebsiteSignals("http://localhost./");
    assert.strictEqual(s.available, false);
  });
  await checkAsync("website: blocks trailing-dot loopback IP 127.0.0.1. [SECURITY_AUDIT F2]", async () => {
    const s = await fetchWebsiteSignals("http://127.0.0.1./");
    assert.strictEqual(s.available, false);
  });
  await checkAsync("website: blocks a public host that RESOLVES to loopback (DNS SSRF) [Codex HIGH]", async () => {
    // localtest.me is a real public DNS name that resolves to 127.0.0.1 — the exact public-host->private-IP
    // bypass Codex flagged. The DNS-resolution guard must skip it. (If offline, dns.lookup fails -> also skipped.)
    const s = await fetchWebsiteSignals("http://localtest.me/");
    assert.strictEqual(s.available, false);
  });
  await checkAsync("website: empty input -> not available", async () => {
    const s = await fetchWebsiteSignals("");
    assert.strictEqual(s.available, false);
  });

  console.log(`\n${passed} checks passed${process.exitCode ? " (with failures above)" : ""}.`);
})();
