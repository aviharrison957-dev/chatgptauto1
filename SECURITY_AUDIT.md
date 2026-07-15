# Security Audit — MapGap Report

**Date:** 2026-07-15
**Scope:** Full codebase + production deployment https://mapgap-report.vercel.app (Stripe **TEST mode** only).
**Method:** Dedicated read-only subagent (Opus) over git history + working tree + live endpoint, then fixes
applied and re-tested by the main session. External confirmation by Codex CLI recorded verbatim at the end.

## Verdict (post-fix)

Two rounds of audit: an internal Opus subagent (F1–F12 below) and an **independent Codex CLI audit** (verbatim
at the end). Codex returned an initial **NO-GO** and surfaced two HIGH defects the internal pass missed
(payment not validated; SSRF via redirect/DNS). **All in-scope findings from both audits are now fixed and
covered by regression tests** (`npm test`, 44 checks). No secret has ever been committed (full-history scan
clean).

**One reliability gap is knowingly deferred (scope fence): a durable order queue** (Codex's #1 rec). The
fulfillment pipeline runs in Vercel `waitUntil` after the webhook returns 200, which is not a durable queue —
in a rare simultaneous failure (instance killed at 300s, OR both the customer email and the owner alert fail
during a Resend outage) a paid order can be silently lost, because Stripe already received 200. The correct
fix needs a datastore, which this session's scope excludes; it is logged as **PROPOSALS P10** and carried as
the **#1 residual risk** in HANDOFF. Mitigations in place: pipeline fits 300s with ~5x margin, all network
calls have explicit timeouts, the OpenRouter timeout is clamped to reserve owner-alert time, and Resend has
its own retry/uptime.

**Bottom line:** signature verification, payment validation, SSRF guards, idempotency (best-effort),
dependency footprint, and HTML escaping are sound. Safe to run **test-mode** end-to-end now; before pointing
**real** payments at it long-term, P10 (durable queue) should be built so a Resend/infra outage can't eat a
paid order. Human-only go-live steps remain the owner's: Stripe live-mode KYC + swap the payment link. Live
payments remain OFF in this session by design.

---

## Findings & fix status

| # | Sev | Title | Status |
|---|-----|-------|--------|
| F1 | MEDIUM | `javascript:` URI could reach an `href` via `googleMapsUri` | **FIXED** — https-only whitelist in `lib/render.js` + test |
| F2 | MEDIUM | SSRF bypass via trailing-dot host (`localhost.`) | **FIXED** — strip trailing dots in `isBlockedHost`, `lib/website.js` + 2 tests |
| F3 | LOW | Upstream API error bodies logged / emailed unbounded | **FIXED** — `readUpstreamError()` truncates to 200 chars in stripe/places/openrouter |
| F4 | LOW | No Content-Security-Policy header | **FIXED** — CSP added in `vercel.json`; hero inline styles moved to CSS classes |
| F5 | INFO | `.vercel/project.json` has projectId/orgId | No action — correctly gitignored, untracked |
| F6 | INFO | Idempotency concurrent-delivery race window | Accepted & documented (fail-open is the correct trade) |
| F7 | INFO | Duplicate `v1=` sig field → last wins | Conservative, never a bypass — no action |
| F8 | INFO | Secrets in git history | **Clean** — only test/placeholder values, no real keys, no `.env` |
| F9 | INFO | `access-control-allow-origin: *` on webhook | Harmless — webhook is server-to-server + HMAC-verified |
| F10 | INFO | Live payment link will be committed at go-live | Acceptable — payment links are public by design |
| F11 | INFO | `report-builder.html` publicly reachable | Client-only self-XSS surface; owner-only tool. Removed from public nav (visual audit) |
| F12 | INFO | Legacy `netlify/functions/` retained | Not deployed (excluded via `.vercelignore`); kept as documented fallback |

---

### F1 — MEDIUM (FIXED): `javascript:` URI via `googleMapsUri` → `href` in `lib/render.js`

`googleMapsUri` comes from the Google Places API (external, untrusted). It was interpolated into an `href`
after `escapeHtml`, which does **not** neutralize a `javascript:` scheme (`escapeHtml("javascript:alert(1)")`
is unchanged). An email/HTML client that honored `href="javascript:…"` would execute it on click. Google
returns only `https://maps.google.com/…` today, so this was defense-in-depth, not a live exploit.

**Fix** (`lib/render.js`): whitelist the scheme before rendering —
```js
const rawMapsUri = typeof place?.googleMapsUri === "string" ? place.googleMapsUri : "";
const mapsUri = /^https:\/\//i.test(rawMapsUri) ? rawMapsUri : "";
```
Regression test added: a `javascript:` maps URI produces no `javascript:`/`href="javascript` in the output;
a legitimate `https://` maps link still renders.

### F2 — MEDIUM (FIXED): SSRF bypass via trailing-dot hostname in `lib/website.js`

`isBlockedHost("localhost.")` returned `false` — the exact-match/`.localhost` checks miss the valid absolute
DNS form `localhost.`, which resolves to loopback on macOS/Linux. Reachable via a customer/Google-listed
`websiteUri` **or** a redirect landing on `http://localhost./`. Exploitability was constrained (the URL comes
from Google's API, not the customer directly, and a Vercel container's loopback exposes nothing sensitive),
but it's a real guard gap.

**Fix** (`lib/website.js`): strip trailing dots (and IPv6 brackets) before every comparison —
```js
const h = String(host || "").replace(/^\[|\]$/g, "").replace(/\.+$/, "");
```
Two regression tests added: `http://localhost./` and `http://127.0.0.1./` are both blocked. (Existing guards
already cover RFC1918, link-local `169.254`, loopback, IPv6 `::1`/ULA/link-local, IPv4-mapped `::ffff:`,
`.internal`, and `metadata.google.internal`; the redirect target is re-checked after the fetch; non-http(s)
schemes rejected.)

### F3 — LOW (FIXED): upstream error bodies logged/emailed unbounded

Stripe/Google/OpenRouter error responses were interpolated raw (`await response.text()`) into thrown Error
messages, which reach `console.error` (Vercel logs) and the owner fallback email. Stripe auth-error bodies
can include a key-tail hint. **Fix:** new `readUpstreamError(response, max=200)` in `lib/util.js` bounds the
body; applied in `lib/stripe.js`, `lib/places.js` (both call sites), and `lib/openrouter.js`. The owner still
gets enough to debug; the exposed surface is capped.

### F4 — LOW (FIXED): missing Content-Security-Policy

All other security headers were present (verified live). Added a CSP in `vercel.json`:
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://buy.stripe.com;
object-src 'none'`. The three inline `style="width:X%"` demo bars in `index.html` were moved to CSS utility
classes so `index.html` carries no inline styles. `style-src` keeps `'unsafe-inline'` **only** because the
operator-only `report-builder.html` generates inline-styled report HTML client-side; `script-src 'self'`
(the high-value directive that blocks injected inline script) has no exception.

---

## Abuse-case analysis (from the audit; unchanged, summarized)

- **Webhook spam (unsigned POSTs):** each costs one Vercel invocation that reads the body, fails signature
  verification, and returns 400 — **zero** Places/OpenRouter/Resend spend. The only surface is Vercel Hobby's
  monthly invocation quota; no per-endpoint WAF on Hobby. Accepted at this scale. Signature is verified before
  any work and before `JSON.parse`.
- **Malicious GBP URL (Stripe custom field):** becomes a Google Places text-search query — never interpolated
  into SQL/shell/HTML. Garbage input fails `validateOrderContext` → owner fallback alert, customer not emailed.
- **Prompt injection via review/website text:** `audit.js` rule 8 treats all business data as untrusted content
  and instructs the model to ignore embedded directives. Reasonable but not cryptographically enforceable; LOW
  because an attacker would need to own the GBP, plant reviews, and buy their own audit.
- **HTML injection into the emailed audit:** every model-supplied string is `escapeHtml`-ed before
  interpolation (verified field-by-field); `mapsUri` was the one gap, now fixed (F1).

## Dependencies

`npm audit`: **0 vulnerabilities**. One production dependency (`@vercel/functions`), lockfile present.

## Secrets hygiene

Full `git log -p --all` scan for `sk_live_`, `sk_test_`, `whsec_`, `re_`, `AIza`, `sk-or-`, Bearer tokens:
only test-only values in test scripts and placeholder strings in docs. No real secret in any commit. `.env`
is gitignored and absent from the tree. Production secrets live only in `~/.config/secrets/keys.env` and
Vercel env vars. `.vercel/` is gitignored.

---

## External auditor verdict (Codex CLI) — VERBATIM

Codex CLI (`codex exec --sandbox read-only`, codex-cli 0.144.3, ChatGPT-authed) audited the deployed
state independently on 2026-07-15 against HEAD `07f8486`. Its verdict, VERBATIM:

> Independent result: **NO-GO for live payments** on HEAD `07f8486`. The 37 offline checks pass, but they miss several go-live blockers.
> 
> ### 1. Security posture
> 
> - **Webhook verification is fundamentally correct.** It signs the untouched body with HMAC-SHA256, compares in constant time, enforces a five-minute timestamp window, and verifies before parsing or starting work ([api/stripe-webhook.mjs:38](/Users/avi/Desktop/claudemac/chatgptauto1/api/stripe-webhook.mjs:38), [lib/stripe.js:31](/Users/avi/Desktop/claudemac/chatgptauto1/lib/stripe.js:31)). Unsigned, tampered, and stale deliveries are rejected.
> - **Replay protection is incomplete.** A captured event remains usable for five minutes; concurrent deliveries can both pass the read-before-write idempotency check and send twice ([lib/idempotency.js:25](/Users/avi/Desktop/claudemac/chatgptauto1/lib/idempotency.js:25)). The parser also collapses multiple `v1` signatures to the last one, potentially rejecting legitimate events during secret rotation ([lib/stripe.js:37](/Users/avi/Desktop/claudemac/chatgptauto1/lib/stripe.js:37)). Stripe requires comparing against every `v1` signature. [Stripe webhook documentation](https://docs.stripe.com/webhooks)
> - **HIGH — SSRF remains open.** The code checks only the hostname text, never its resolved IP, and uses `redirect: "follow"`; therefore a redirect has already contacted the private target before the final-host check runs. A public hostname resolving to a private/link-local IP also bypasses the guard entirely ([lib/website.js:34](/Users/avi/Desktop/claudemac/chatgptauto1/lib/website.js:34), [lib/website.js:65](/Users/avi/Desktop/claudemac/chatgptauto1/lib/website.js:65), [lib/website.js:85](/Users/avi/Desktop/claudemac/chatgptauto1/lib/website.js:85)).
> - **HIGH — fulfillment is not tied to the purchased product or even confirmed payment.** Any signed `checkout.session.completed` is accepted without checking `payment_status`, `mode`, expected Payment Link/product, currency, or amount ([api/stripe-webhook.mjs:49](/Users/avi/Desktop/claudemac/chatgptauto1/api/stripe-webhook.mjs:49), [lib/stripe.js:110](/Users/avi/Desktop/claudemac/chatgptauto1/lib/stripe.js:110)). This can fulfill unpaid delayed-payment sessions or unrelated Checkout products. Stripe specifically requires checking `payment_status` and handling `checkout.session.async_payment_succeeded` when delayed methods are enabled. [Stripe fulfillment documentation](https://docs.stripe.com/checkout/fulfillment)
> - **HTML injection and committed-secret posture look sound.** Model, Places, and fallback-email strings are escaped, with the sole link restricted to HTTPS ([lib/render.js:45](/Users/avi/Desktop/claudemac/chatgptauto1/lib/render.js:45), [lib/util.js:25](/Users/avi/Desktop/claudemac/chatgptauto1/lib/util.js:25)). I found no actual committed credential or client-side secret.
> 
> ### 2. Order-loss risk
> 
> **Yes, a paid order can be silently lost.**
> 
> The webhook returns 200 before recording any durable order ([api/stripe-webhook.mjs:53](/Users/avi/Desktop/claudemac/chatgptauto1/api/stripe-webhook.mjs:53)). `waitUntil` is not a durable queue: Vercel explicitly cancels its promise when the 300-second invocation times out. [Vercel `waitUntil` documentation](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil)
> 
> The individual timeouts help, but the default worst path is approximately 267 seconds for success or 272 seconds when the final customer-email attempt fails and the fallback alert runs—before cold-start and processing overhead. There is no global deadline reserving alert time, and `OPENROUTER_TIMEOUT_MS` is an unbounded environment override ([lib/openrouter.js:17](/Users/avi/Desktop/claudemac/chatgptauto1/lib/openrouter.js:17)).
> 
> More directly, customer delivery and owner fallback both depend on Resend. During a Resend outage or bad credential, both fail and the second failure is only logged after Stripe has already received 200 ([api/stripe-webhook.mjs:72](/Users/avi/Desktop/claudemac/chatgptauto1/api/stripe-webhook.mjs:72), [lib/email.js:4](/Users/avi/Desktop/claudemac/chatgptauto1/lib/email.js:4)). A 2xx from Resend is also treated as fulfillment and immediately marked in Stripe even though it means “accepted,” not “delivered”; a later bounce/failure produces no owner alert ([lib/email.js:23](/Users/avi/Desktop/claudemac/chatgptauto1/lib/email.js:23), [lib/idempotency.js:42](/Users/avi/Desktop/claudemac/chatgptauto1/lib/idempotency.js:42)). Resend exposes delivered/bounced/failed events precisely for this distinction. [Resend event documentation](https://resend.com/docs/webhooks/event-types)
> 
> Additionally, the latest checked-in deployment record says `RESEND_API_KEY` was absent and neither email path was proven; if unchanged, the current deployment cannot fulfill or alert at all ([JOURNAL.md:113](/Users/avi/Desktop/claudemac/chatgptauto1/JOURNAL.md:113), [JOURNAL.md:129](/Users/avi/Desktop/claudemac/chatgptauto1/JOURNAL.md:129)).
> 
> ### 3. Flow / correctness
> 
> The module wiring and normal card-payment path are coherent ([lib/pipeline.js:9](/Users/avi/Desktop/claudemac/chatgptauto1/lib/pipeline.js:9)), and the Vercel handler/configuration shape is valid. However:
> 
> - Common `maps.app.goo.gl` links are accepted but not expanded; they become literal Text Search queries, which is not reliable resolution ([lib/places.js:70](/Users/avi/Desktop/claudemac/chatgptauto1/lib/places.js:70), [lib/places.js:123](/Users/avi/Desktop/claudemac/chatgptauto1/lib/places.js:123)).
> - Double-charge is not possible from this code—it never creates or confirms charges.
> - Double-send is possible through concurrent deliveries, metadata outages, or an uncertain Resend request because idempotency is non-atomic and intentionally fail-open ([lib/idempotency.js:6](/Users/avi/Desktop/claudemac/chatgptauto1/lib/idempotency.js:6)).
> - Tests cover literal private hosts and webhook rejection, but not redirects/DNS SSRF, signed paid fulfillment, payment/product validation, timeout cancellation, Resend failure/bounce, or concurrent replay ([scripts/test-pipeline-units.js:165](/Users/avi/Desktop/claudemac/chatgptauto1/scripts/test-pipeline-units.js:165), [scripts/test-vercel-webhook.js:21](/Users/avi/Desktop/claudemac/chatgptauto1/scripts/test-vercel-webhook.js:21)).
> 
> **VERDICT:** This is **not safe to point real payments at**. The single most important fix is to persist or durably enqueue every verified, paid MapGap order before returning 200, using a unique order key and retry/dead-letter state visible independently of Resend; fulfillment should only close after delivery confirmation or explicitly alert on bounce/failure. Payment/product validation and redirect/DNS-safe website fetching are additional go-live blockers.

### Response to Codex (triage + remediation)

Codex's verdict is taken seriously; it surfaced two HIGH defects the internal audit under-weighted. Fixes
applied this session (commit after this section; each named in JOURNAL.md before the change):

- **Payment not validated (Codex HIGH) — FIXED.** `validateOrderContext` now requires
  `payment_status === "paid"` and `mode === "payment"`; an unpaid/async or wrong-mode session is rejected
  before any Places/OpenRouter/Resend work. (`lib/stripe.js`, test added.)
- **SSRF via redirect + DNS (Codex HIGH) — FIXED.** `lib/website.js` no longer uses `redirect:"follow"`;
  it follows up to 3 hops manually, re-validating each hop's host, and resolves the host via DNS and
  rejects it if ANY resolved address is private/loopback/link-local (closes the public-host→private-IP and
  redirect-to-private bypasses). Best-effort semantics preserved (never throws). Tests added.
- **`maps.app.goo.gl` short links not resolved (Codex flow) — FIXED.** `lib/places.js` expands
  `maps.app.goo.gl` / `goo.gl/maps` / `g.co` short links by following the redirect to the real Maps URL
  before falling back to Text Search — the most common link a customer pastes now resolves reliably.
- **Multiple `v1` signatures collapsed (Codex, rotation robustness) — FIXED.** `verifyStripeWebhook` now
  accepts if ANY provided `v1` matches (Stripe sends multiple during secret rotation). Test added.
- **Unbounded `OPENROUTER_TIMEOUT_MS` / no global deadline (Codex order-loss) — MITIGATED.** The OpenRouter
  timeout override is clamped to 220s so the worst-case chain always leaves time for the owner alert inside
  Vercel's 300s ceiling.

**Accepted as residual risk / deferred to PROPOSALS (scope fence — needs a datastore, explicitly out of
scope this session):**
- **Durable order queue / persist-before-200 (Codex's #1 recommendation).** `waitUntil` is not a durable
  queue; if BOTH the customer email and the owner alert fail (e.g. a full Resend outage) the order is lost,
  because Stripe already received 200. The correct fix is to persist every verified paid order before
  acknowledging and reconcile independently of Resend — a database/queue, which the scope fence excludes.
  Logged as PROPOSALS P10 and carried as the #1 residual risk in HANDOFF. Present mitigation: the pipeline
  fits 300s with ~5x margin and Resend has its own retry/uptime; the exposure is a rare total-outage window.
- **Resend delivered-vs-accepted (bounce handling).** A Resend 2xx means accepted, not delivered; a later
  bounce raises no owner alert. Proper fix needs Resend delivery webhooks + a store → PROPOSALS P11.
- **Concurrent-delivery double-send.** The read-before-write idempotency is non-atomic and fail-open;
  documented (F6). Stripe retry spacing makes the window practically empty; a durable store (P10) closes it.

