// Renders the audit HTML template with SYNTHETIC placeholder data so the design can be reviewed in a
// browser WITHOUT any API keys. This is a design preview only — it is NOT a real audit and NOT real
// business data. Real, content-verified samples come from scripts/generate-samples.js (needs keys).
const fs = require("fs");
const path = require("path");
const { normalizeAnalysis } = require("../lib/audit");
const { renderAuditHtml } = require("../lib/render");
const { SAMPLE_MODEL_OUTPUT, SAMPLE_PLACE } = require("./_sample-fixture");

const analysis = normalizeAnalysis(SAMPLE_MODEL_OUTPUT, { name: SAMPLE_PLACE.displayName.text });
const html = renderAuditHtml(analysis, SAMPLE_PLACE, { customerName: "Design Preview" });

const banner =
  '<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#fff3cd;color:#7a5b00;' +
  'border-bottom:2px solid #ffe08a;padding:12px 16px;font-size:13px;text-align:center;">' +
  "⚠ <strong>TEMPLATE DESIGN PREVIEW</strong> — synthetic placeholder data, <strong>not</strong> a real audit. " +
  "Real audits require live API keys (see NEEDS_FROM_AVI.md). Regenerate with <code>npm run preview:template</code>." +
  "</div>";

const withBanner = html.replace(/(<body[^>]*>)/, `$1${banner}`);

const outDir = path.join(__dirname, "..", "design-preview");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "audit-template-preview.html");
fs.writeFileSync(outFile, withBanner, "utf8");

console.log(`Wrote design preview (synthetic data) -> ${path.relative(path.join(__dirname, ".."), outFile)}`);
console.log("Open it in a browser to judge the visual design. It is NOT a real audit.");
