// Offline checks for the Vercel webhook entry point (api/stripe-webhook.mjs) and the idempotency
// module. No live keys, no network: only the reject/ignore paths and fail-open behavior.
const crypto = require("crypto");
const assert = require("assert");
const { checkAlreadyFulfilled, markFulfilled, paymentIntentIdOf } = require("../lib/idempotency");

const TEST_SECRET = "whsec_test_secret_for_offline_checks_only";

function signedHeaders(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return { "stripe-signature": `t=${timestamp},v1=${signature}`, "content-type": "application/json" };
}

async function main() {
  const { default: handler } = await import("../api/stripe-webhook.mjs");
  let passed = 0;
  const ok = (name) => { console.log("  ok ", name); passed += 1; };

  process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET;

  // 1. Non-POST -> 405
  let res = await handler.fetch(new Request("https://example.test/api/stripe-webhook", { method: "GET" }));
  assert.strictEqual(res.status, 405);
  ok("vercel webhook: GET -> 405");

  // 2. Unsigned POST -> 400
  res = await handler.fetch(new Request("https://example.test/api/stripe-webhook", {
    method: "POST",
    body: JSON.stringify({ type: "checkout.session.completed" })
  }));
  assert.strictEqual(res.status, 400);
  ok("vercel webhook: unsigned POST -> 400");

  // 3. Tampered body (signature of different payload) -> 400
  const realBody = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_x" } } });
  const headers = signedHeaders(JSON.stringify({ other: true }), TEST_SECRET);
  res = await handler.fetch(new Request("https://example.test/api/stripe-webhook", {
    method: "POST", headers, body: realBody
  }));
  assert.strictEqual(res.status, 400);
  ok("vercel webhook: tampered body -> 400");

  // 4. Stale timestamp (replay outside tolerance) -> 400
  const staleBody = JSON.stringify({ type: "checkout.session.completed" });
  res = await handler.fetch(new Request("https://example.test/api/stripe-webhook", {
    method: "POST",
    headers: signedHeaders(staleBody, TEST_SECRET, Math.floor(Date.now() / 1000) - 3600),
    body: staleBody
  }));
  assert.strictEqual(res.status, 400);
  ok("vercel webhook: stale-timestamp replay -> 400");

  // 5. Correctly signed but non-checkout event -> 200 ignored (no fulfillment attempted)
  const ignoredBody = JSON.stringify({ type: "invoice.paid" });
  res = await handler.fetch(new Request("https://example.test/api/stripe-webhook", {
    method: "POST", headers: signedHeaders(ignoredBody, TEST_SECRET), body: ignoredBody
  }));
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).ignored, "invoice.paid");
  ok("vercel webhook: signed non-checkout event -> 200 ignored");

  // 6. Idempotency: payment intent extraction shapes
  assert.strictEqual(paymentIntentIdOf({ payment_intent: "pi_123" }), "pi_123");
  assert.strictEqual(paymentIntentIdOf({ payment_intent: { id: "pi_456" } }), "pi_456");
  assert.strictEqual(paymentIntentIdOf({}), "");
  ok("idempotency: paymentIntentIdOf handles string/object/missing");

  // 7. Idempotency fails OPEN (no key, no network -> proceed with fulfillment, never throw)
  delete process.env.STRIPE_SECRET_KEY;
  const check = await checkAlreadyFulfilled({ payment_intent: "pi_offline" });
  assert.strictEqual(check.fulfilled, false);
  assert.ok(check.reason, "expected a reason for the inconclusive check");
  assert.strictEqual(await markFulfilled({ payment_intent: "pi_offline" }, "evt_x"), false);
  ok("idempotency: fails open without STRIPE_SECRET_KEY (never blocks fulfillment)");

  console.log(`\n${passed} vercel-webhook checks passed.`);
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
