// THE QUALITY GATE. Runs the REAL audit pipeline against real, well-known businesses and writes the
// actual generated HTML (plus the analysis JSON) into sample-audits/ so the quality can be judged in a
// browser. Requires live keys — it does not and will not fabricate output.
//
//   OPENROUTER_API_KEY=sk-or-... GOOGLE_PLACES_API_KEY=AIza... npm run generate:samples
//
// Optional: pass business queries/Place IDs as CLI args to override the defaults, e.g.
//   node scripts/generate-samples.js "Roto-Rooter, Houston, TX" "ChIJ....."
const fs = require("fs");
const path = require("path");
const { fetchPlaceDetails, summarizePlaceForPrompt } = require("../netlify/functions/lib/places");
const { fetchWebsiteSignals } = require("../netlify/functions/lib/website");
const { generateAuditHtml } = require("../netlify/functions/lib/audit");

const REQUIRED = ["OPENROUTER_API_KEY", "GOOGLE_PLACES_API_KEY"];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`\nMISSING KEYS: ${missing.join(", ")}`);
  console.error("The quality gate needs both keys. Audit quality is UNVERIFIED until this runs.");
  console.error("See NEEDS_FROM_AVI.md (Tier 1). Then re-run:");
  console.error("  OPENROUTER_API_KEY=sk-or-... GOOGLE_PLACES_API_KEY=AIza... npm run generate:samples\n");
  process.exit(1);
}

// Real, recognizable service businesses across a few trades. Edit freely; the resolver accepts a
// business-name query, a Maps URL, or a raw Place ID.
const DEFAULT_TARGETS = [
  { slug: "plumbing-roto-rooter-houston", query: "Roto-Rooter Plumbing & Water Cleanup, Houston, TX" },
  { slug: "hvac-one-hour-phoenix", query: "One Hour Heating & Air Conditioning, Phoenix, AZ" },
  { slug: "auto-repair-jiffy-lube-denver", query: "Jiffy Lube, Denver, CO" }
];

const cliTargets = process.argv.slice(2).map((q, i) => ({ slug: `custom-${i + 1}`, query: q }));
const targets = cliTargets.length ? cliTargets : DEFAULT_TARGETS;

const outDir = path.join(__dirname, "..", "sample-audits");
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const results = [];
  for (const target of targets) {
    process.stdout.write(`\n• ${target.query}\n`);
    try {
      const place = await fetchPlaceDetails(target.query);
      const summary = summarizePlaceForPrompt(place);
      const website = await fetchWebsiteSignals(place.websiteUri);
      const order = { customerName: "Sample Run", googleBusinessInput: target.query, checkoutSessionId: "sample" };
      const { html, analysis, model, usage } = await generateAuditHtml(place, order, website);

      const slug = slugify(place.displayName?.text || target.slug);
      fs.writeFileSync(path.join(outDir, `${slug}.html`), html, "utf8");
      fs.writeFileSync(path.join(outDir, `${slug}.analysis.json`), JSON.stringify(analysis, null, 2), "utf8");

      console.log(`  business : ${place.displayName?.text}`);
      console.log(`  rating   : ${summary.rating ?? "n/a"} (${summary.reviewCount} reviews), photos: ${summary.photoCount}`);
      console.log(`  website  : ${website.available ? website.finalUrl : "not analyzed (" + (website.reason || "n/a") + ")"}`);
      console.log(`  model    : ${model}${usage ? `  tokens in/out: ${usage.prompt_tokens || "?"}/${usage.completion_tokens || "?"}` : ""}`);
      console.log(`  wrote    : sample-audits/${slug}.html (${html.length} bytes)`);
      results.push({ ok: true, slug });
    } catch (error) {
      console.error(`  FAILED: ${error.message}`);
      results.push({ ok: false, query: target.query, error: error.message });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\nDone. ${ok}/${targets.length} sample audits written to sample-audits/.`);
  console.log("Open the .html files in a browser and judge whether they are worth $249.");
  if (ok === 0) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "audit";
}
