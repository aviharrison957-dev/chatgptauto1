// Offline regression test for the deterministic half of the pipeline (no network, no API keys).
// Covers Place ID/URL parsing, custom-field extraction, model-output normalization, and HTML rendering.
const assert = require("assert");
const { extractPlaceId, cleanQueryFromInput, summarizePlaceForPrompt } = require("../lib/places");
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
  await checkAsync("website: empty input -> not available", async () => {
    const s = await fetchWebsiteSignals("");
    assert.strictEqual(s.available, false);
  });

  console.log(`\n${passed} checks passed${process.exitCode ? " (with failures above)" : ""}.`);
})();
