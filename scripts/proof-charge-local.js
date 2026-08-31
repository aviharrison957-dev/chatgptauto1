// Proof-charge WITHOUT a card.
//
// Drives the real Vercel webhook handler (api/stripe-webhook.mjs) in-process with a signed,
// realistic checkout.session.completed event and REAL downstream keys, so the whole server-side
// chain — signature verify -> payment-link guard -> Places -> website -> OpenRouter -> Resend ->
// idempotency mark -> fulfilled — is exercised end to end for the price of one model call.
//
// What it proves:      legs 1-5, the foreign-link guard, and real inbox delivery.
// What it cannot prove: that Stripe's LIVE keys and LIVE signing secret are wired correctly in
//                       production. Only a real card through the live Payment Link proves that.
//                       This makes that charge a confirmation instead of a first discovery.
//
// The session is passed pre-hydrated (customer_details + custom_fields present) so
// hydrateCheckoutSession() short-circuits and never calls the Stripe API. No Stripe key needed,
// no Stripe object created, no money moves.
//
// Required env:
//   GOOGLE_PLACES_API_KEY  OPENROUTER_API_KEY  RESEND_API_KEY  RESEND_FROM_EMAIL  PROOF_EMAIL
// Optional env:
//   PROOF_BUSINESS (default below)   STRIPE_WEBHOOK_SECRET (a local one is generated if unset)
//
// Usage:  PROOF_EMAIL=you@example.com node scripts/proof-charge-local.js "Some Business, City ST"
require("./_load-env");
const crypto = require("crypto");
const assert = require("assert");

const MAPGAP_PLINK = "plink_1U98D3PL9698yhYP8j3vhBW6"; // live MapGap $249 link
const SECRET = process.env.STRIPE_WEBHOOK_SECRET || `whsec_local_${crypto.randomBytes(16).toString("hex")}`;
const BUSINESS = process.argv[2] || process.env.PROOF_BUSINESS || "Watson Plumbing & Associates LLC";
const TO = process.env.PROOF_EMAIL;

for (const name of ["GOOGLE_PLACES_API_KEY", "OPENROUTER_API_KEY", "RESEND_API_KEY", "RESEND_FROM_EMAIL"]) {
  if (!process.env[name]) { console.error(`Missing required env var: ${name}`); process.exit(1); }
}
if (!TO) { console.error("Missing PROOF_EMAIL (where the proof audit is delivered)."); process.exit(1); }

process.env.STRIPE_WEBHOOK_SECRET = SECRET;
process.env.MAPGAP_PAYMENT_LINK_IDS = MAPGAP_PLINK;

// ---- capture MAPGAP_TRACE lines while still letting everything print ----
const traces = [];
const realLog = console.log.bind(console);
console.log = (...args) => {
  const line = args.map(String).join(" ");
  if (line.startsWith("MAPGAP_TRACE ")) {
    try { traces.push(JSON.parse(line.slice("MAPGAP_TRACE ".length))); } catch { /* ignore */ }
  }
  realLog(...args);
};

function sign(body, secret, ts = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${body}`, "utf8").digest("hex");
  return { "stripe-signature": `t=${ts},v1=${sig}`, "content-type": "application/json" };
}

function eventFor({ id, paymentLink }) {
  return JSON.stringify({
    id: `evt_local_${crypto.randomBytes(6).toString("hex")}`,
    type: "checkout.session.completed",
    livemode: false,
    data: { object: {
      id,
      object: "checkout_session",
      payment_link: paymentLink,
      payment_status: "paid",
      mode: "payment",
      amount_total: 24900,
      currency: "usd",
      payment_intent: `pi_local_${crypto.randomBytes(6).toString("hex")}`,
      customer_details: { email: TO, name: "Proof Charge (local)" },
      custom_fields: [{
        key: "google_business_profile_url",
        label: { type: "custom", custom: "Google Business Profile URL" },
        text: { value: BUSINESS }
      }]
    } }
  });
}

const post = (handler, body, headers) =>
  handler.fetch(new Request("https://mapgap.local/api/stripe-webhook", { method: "POST", headers, body }));

async function settle(timeoutMs = 240000) {
  const start = Date.now();
  const terminal = new Set(["fulfilled", "failed", "fallback_alert_sent"]);
  while (Date.now() - start < timeoutMs) {
    if (traces.some((t) => terminal.has(t.leg))) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function render() {
  const t0 = traces.length ? Date.parse(traces[0].at) : Date.now();
  const label = { checkout_received: "[1/5] checkout received", place_resolved: "[2/5] place resolved",
    audit_generated: "[3/5] audit generated", resend_accepted: "[4/5] resend accepted",
    fulfilled: "[5/5] FULFILLED", failed: "[!!] FAILED", fallback_alert_sent: "[!!] owner alerted",
    duplicate_ignored: "[--] duplicate ignored" };
  console.log("\n──────── trace ledger ────────");
  for (const t of traces) {
    const dt = ((Date.parse(t.at) - t0) / 1000).toFixed(1).padStart(6);
    const extra = Object.entries(t)
      .filter(([k]) => !["leg", "session", "at", "event"].includes(k))
      .map(([k, v]) => `${k}=${v}`).join("  ");
    console.log(`  +${dt}s  ${(label[t.leg] || t.leg).padEnd(24)} ${extra}`);
  }
  console.log("──────────────────────────────");
}

(async () => {
  const { default: handler } = await import("../api/stripe-webhook.mjs");

  // 1. Unsigned POST must be rejected before any work happens.
  let res = await post(handler, eventFor({ id: "cs_unsigned", paymentLink: MAPGAP_PLINK }), { "content-type": "application/json" });
  assert.strictEqual(res.status, 400, "unsigned POST should be 400");
  console.log("  ok   unsigned POST rejected -> 400");

  // 2. A foreign product's sale on this shared Stripe account must be dropped, not fulfilled.
  let body = eventFor({ id: "cs_foreign_local", paymentLink: "plink_someone_elses_product" });
  res = await post(handler, body, sign(body, SECRET));
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).ignored, "foreign_payment_link");
  assert.strictEqual(traces.length, 0, "foreign link must not start the pipeline");
  console.log("  ok   foreign payment_link dropped -> 200 ignored, pipeline untouched");

  // 3. The real thing.
  console.log(`\n  >>>  running full fulfillment for: ${BUSINESS}`);
  console.log(`  >>>  audit will be delivered to: ${TO}\n`);
  body = eventFor({ id: `cs_proof_${crypto.randomBytes(6).toString("hex")}`, paymentLink: MAPGAP_PLINK });
  res = await post(handler, body, sign(body, SECRET));
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).queued, true);
  console.log("  ok   signed MapGap session accepted -> 200 queued");

  const settled = await settle();
  render();

  const legs = traces.map((t) => t.leg);
  const need = ["checkout_received", "place_resolved", "audit_generated", "resend_accepted", "fulfilled"];
  const missing = need.filter((l) => !legs.includes(l));
  if (!settled) { console.error("\nTIMED OUT before a terminal leg."); process.exit(1); }
  if (legs.includes("failed")) { console.error("\nCHAIN FAILED — see the [!!] line above."); process.exit(1); }
  if (missing.length) { console.error(`\nINCOMPLETE — missing legs: ${missing.join(", ")}`); process.exit(1); }

  const resend = traces.find((t) => t.leg === "resend_accepted");
  console.log(`\nGREEN — all 5 legs. Resend messageId=${resend?.messageId} status=${resend?.status}`);
  console.log(`Confirm the audit actually landed in ${TO}. Server-side proof stops at Resend's 2xx.`);
})().catch((e) => { console.error("\nHARNESS ERROR:", e); process.exit(1); });
