// Resend delivery: the audit to the customer, and failure alerts to the owner.
const { requiredEnv, optionalEnv, ownerFallbackEmail, escapeHtml } = require("./util");
const { trace } = require("./trace");

async function sendEmail({ to, subject, html, replyTo, tags }) {
  const resendApiKey = requiredEnv("RESEND_API_KEY");
  const payload = {
    from: optionalEnv("RESEND_FROM_EMAIL", "MapGap Report <onboarding@resend.dev>"),
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    tags
  };
  if (replyTo) payload.reply_to = replyTo;

  // Explicit timeout: under Vercel's hard 300s maxDuration, an unbounded hang here would let the
  // platform kill the instance before the owner-alert path runs (silent loss of a paid order).
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    throw new Error(`Resend email failed: ${response.status} ${await response.text()}`);
  }
  // Resend has accepted the message. The body is read ONLY to recover the message id for the trace,
  // and only inside a catch-all: the original hazard (a body-read failure after a 200 throwing, and
  // wrongly triggering a fallback alert for an email already on its way) stays closed because nothing
  // in this block can propagate.
  let messageId = null;
  try {
    const body = await response.json();
    messageId = body?.id || null;
  } catch {
    messageId = null;
  }
  const kind = (tags || []).find((t) => t.name === "type")?.value || "unknown";
  const sessionTag = (tags || []).find((t) => t.name === "checkout_session")?.value || null;
  trace("resend_accepted", sessionTag, { kind, messageId, status: response.status });
  return { ok: true, messageId };
}

async function sendCustomerAudit(customerEmail, auditHtml, place, orderContext) {
  const subjectName = place?.displayName?.text || "your business";
  return sendEmail({
    to: customerEmail,
    subject: `Your MapGap Report for ${subjectName}`,
    html: auditHtml,
    replyTo: optionalEnv("OWNER_FALLBACK_EMAIL") || optionalEnv("AVI_FALLBACK_EMAIL") || undefined,
    tags: [
      { name: "type", value: "customer-audit" },
      { name: "checkout_session", value: safeTagValue(orderContext.checkoutSessionId) }
    ]
  });
}

// On any pipeline failure: do NOT email the customer. Email the owner everything needed to fulfill by
// hand with report-builder.html.
async function sendFallbackAlert(error, orderContext, session) {
  const fallbackEmail = ownerFallbackEmail();
  const safeOrder = escapeHtml(JSON.stringify(orderContext || {}, null, 2));
  const safeError = escapeHtml(error?.stack || error?.message || String(error));
  const safeSession = escapeHtml(JSON.stringify({
    id: session?.id,
    amount_total: session?.amount_total,
    currency: session?.currency,
    customer_details: session?.customer_details,
    custom_fields: session?.custom_fields
  }, null, 2));

  return sendEmail({
    to: fallbackEmail,
    subject: "MapGap automated audit failed - manual fulfillment needed",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17202a;">
        <h1 style="font-size:20px;">Manual fulfillment needed</h1>
        <p>The customer was <strong>not</strong> emailed. Use <code>report-builder.html</code> to fulfill this order manually.</p>
        <h2 style="font-size:16px;">Order context</h2>
        <pre style="white-space:pre-wrap;background:#f4f6f8;padding:12px;border-radius:6px;">${safeOrder}</pre>
        <h2 style="font-size:16px;">Stripe session summary</h2>
        <pre style="white-space:pre-wrap;background:#f4f6f8;padding:12px;border-radius:6px;">${safeSession}</pre>
        <h2 style="font-size:16px;">Error</h2>
        <pre style="white-space:pre-wrap;background:#fff1f1;padding:12px;border-radius:6px;">${safeError}</pre>
      </div>
    `,
    tags: [
      { name: "type", value: "fallback-alert" },
      { name: "checkout_session", value: safeTagValue(orderContext?.checkoutSessionId) }
    ]
  });
}

function safeTagValue(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

module.exports = { sendEmail, sendCustomerAudit, sendFallbackAlert };
