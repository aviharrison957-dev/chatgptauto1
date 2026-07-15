# Security Audit — MapGap Report

**Date:** 2026-07-15
**Scope:** Full codebase + production deployment https://mapgap-report.vercel.app (Stripe **TEST mode** only).
**Method:** Dedicated read-only subagent (Opus) over git history + working tree + live endpoint, then fixes
applied and re-tested by the main session. External confirmation by Codex CLI recorded verbatim at the end.

## Verdict (post-fix)

The two MEDIUM findings and both LOW findings are **fixed and covered by regression tests** (`npm test`,
37 checks). No secret has ever been committed (full-history scan clean). Webhook signature verification,
idempotency, dependency footprint, and HTML escaping are sound. **Safe to point real payments at, once the
owner completes the human-only go-live steps** (Stripe live-mode KYC + swap the payment link). Live payments
remain OFF in this session by design.

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

_Recorded in Step 6 below._
