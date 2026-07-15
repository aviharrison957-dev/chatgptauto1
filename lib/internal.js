// Internal trigger between the synchronous webhook and the background worker.
// The worker is publicly reachable, so every trigger is HMAC-signed with STRIPE_WEBHOOK_SECRET (a
// secret only our own functions hold) — no extra env var, and forged calls to the worker are rejected.
const crypto = require("crypto");
const { getHeader } = require("./stripe");

const WORKER_PATH = "/.netlify/functions/audit-worker-background";
const SIGNATURE_HEADER = "x-mapgap-signature";

function signInternal(body, secret) {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

function verifyInternalSignature(body, headers, secret) {
  const provided = getHeader(headers, SIGNATURE_HEADER);
  if (!provided) throw new Error("Missing internal signature");
  const expected = signInternal(body, secret);
  let a;
  let b;
  try {
    a = Buffer.from(expected, "hex");
    b = Buffer.from(String(provided), "hex");
  } catch (_error) {
    throw new Error("Malformed internal signature");
  }
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Internal signature mismatch");
  }
}

function resolveSiteBaseUrl(event) {
  const fromEnv = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (fromEnv) return fromEnv;
  const host = getHeader(event.headers || {}, "host");
  if (host) return `https://${host}`;
  throw new Error("Cannot resolve site base URL to trigger the audit worker");
}

// Fire the background worker. It answers 202 immediately, so this returns fast even though the worker
// keeps running (up to 15 min) to do the slow Places + model + email work off the request path.
async function triggerAuditWorker(event, session, secret) {
  const body = JSON.stringify({ session });
  const url = `${resolveSiteBaseUrl(event).replace(/\/+$/, "")}${WORKER_PATH}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", [SIGNATURE_HEADER]: signInternal(body, secret) },
    body,
    signal: AbortSignal.timeout(8000)
  });
  if (response.status !== 202 && !response.ok) {
    let detail = "";
    try { detail = await response.text(); } catch (_error) { /* ignore */ }
    throw new Error(`Audit worker trigger failed: ${response.status} ${detail}`);
  }
  return response.status;
}

module.exports = { signInternal, verifyInternalSignature, triggerAuditWorker, WORKER_PATH, SIGNATURE_HEADER };
