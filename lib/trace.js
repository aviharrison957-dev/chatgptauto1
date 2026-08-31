// Structured one-line trace events, so a real order can be watched moving through the pipe in
// real time via `vercel logs --follow` (see scripts/watch-proof-charge.sh).
//
// Contract, deliberately narrow:
//   - Every event is ONE stdout line prefixed `MAPGAP_TRACE ` followed by compact JSON, so the
//     watcher can grep it out of unrelated request noise without a log drain or a parser.
//   - trace() NEVER throws. Instrumentation must not be able to fail a paid order.
//   - No secrets, ever. Customer emails are masked; only the leg's shape is recorded.
const LEGS = [
  "checkout_received",   // signed checkout.session.completed accepted as MapGap's
  "place_resolved",      // Google Places returned the business
  "audit_generated",     // the model produced the report HTML
  "resend_accepted",     // Resend returned 2xx (handoff complete; delivery is downstream)
  "fulfilled",           // whole chain done, marked idempotent
  "failed",              // chain threw; customer NOT emailed
  "fallback_alert_sent", // owner alerted for manual fulfillment
  "duplicate_ignored"    // replayed delivery, already fulfilled
];

function maskEmail(value) {
  const s = String(value || "");
  const at = s.indexOf("@");
  if (at < 1) return s ? "***" : "";
  return `${s[0]}***${s.slice(at)}`;
}

function trace(leg, sessionId, fields) {
  try {
    const payload = {
      leg,
      session: sessionId || null,
      at: new Date().toISOString(),
      ...(fields || {})
    };
    if (payload.email) payload.email = maskEmail(payload.email);
    // Single line, no pretty-printing: the watcher reads these one per line.
    console.log(`MAPGAP_TRACE ${JSON.stringify(payload)}`);
  } catch {
    // Tracing is best-effort by design; a logging failure must never surface to the caller.
  }
}

module.exports = { trace, LEGS };
