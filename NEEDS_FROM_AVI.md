# What I Need From Avi

**Updated 2026-08-31.** Everything a machine could do is done. What is left needs your card,
your money, your registrar login, your postal address, or your say-so.

Evidence for every claim below: `.flywheel/003/debrief-01.md`.

---

## The one-line answer

**The product is live, proven, and safer than it was this morning. The phone lane can start
tomorrow. The email lane cannot start for 2-3 weeks no matter what you do today, because a new
sending domain has to warm up first.**

---

## What changed today (no action needed)

- **The whole fulfilment chain was proven end to end, without spending $249.**
  `scripts/proof-charge-local.js` drives the real webhook handler with a signed session and real
  Places / OpenRouter / Resend keys. Result: 5/5 legs green in **72.9s** against the 300s ceiling,
  Resend 200, and a real audit for a real business delivered to your inbox. Two negative paths
  asserted in the same run: unsigned request rejected, and a foreign product's sale on the shared
  Stripe account dropped without touching the pipeline.
- **Two ways a paid order could have gone wrong were found and fixed** — see the section below.
  This is the part worth reading.
- **Trace instrumentation is deployed to production.** Your proof charge will now print a
  five-leg ledger with per-leg timings and the Resend message id.
- **Booking link created and live:** <https://cal.com/avi-harrison-0zhwud/google-presence-review>
- **Send list cut applied:** `outreach/prospects-final.csv` — 101 rows, 9 dropped
  (`outreach/prospects-dropped.csv` records which and why).
- **A privacy hole in a PUBLIC repo was closed.** `.flywheel/`, `.warrant/` and `outreach/` were
  sitting untracked in a public GitHub repo. One `git add -A` would have published an analysis
  naming five of your Google accounts and every service they log into, plus 110 scraped prospect
  addresses. All three are now gitignored. History scanned: no keys were ever committed.

## The two defects, in plain terms

Both were found by the cardless proof run. Both would have hit real customers.

1. **The link Google itself gives a business owner did not work.** When you open your own
   listing and copy the URL, Google frequently hands you a `maps.google.com/?cid=…` link. That
   form carries no place identifier, redirects only to another cid link, and the page has no
   business name in it. The old code fed the whole URL into Google's text search, which returned
   nothing — so a customer who pasted exactly what Google gave them got a **failed order**: money
   taken, no report, owner alert, manual fulfilment. Now it is caught and refused with an
   instruction you can act on in seconds, and the checkout page asks people not to paste one.

2. **A mistyped business name would have produced an audit about a stranger.** The fallback took
   Google's single best text-search match with no verification at all. Live demonstration:
   `"Zzyzx Nonexistent Plumbing Of Nowhere"` resolved to **Quix Plumbing Service, Utica Ave,
   Brooklyn** — a real, unrelated company. Nothing would have stopped a $249 report about them
   being emailed to your customer. Resolution now has to share a distinctive word with what the
   customer typed, ignoring legal suffixes and the trade vocabulary every business shares.

   **The trade-off you are accepting:** the guard is deliberately loose, but it will occasionally
   block a legitimate order whose typed name is very unlike their Google listing. That order does
   not fail silently — you get the owner alert with both names and fulfil it by hand in a minute.
   A false block costs you a minute. A false pass costs you the customer.

---

## Your list, in order

### 1. Confirm two emails landed (1 minute)
Two real emails were sent to you today from `reports@saboxai.com`:
a one-line Resend probe, and a **full MapGap audit for Watson's Plumbing & Heating**. That second
one is exactly what a paying customer receives. If both arrived, delivery is confirmed end to end;
server-side proof stops at Resend's 200 and cannot see your inbox.

### 2. The $249 proof charge — now a confirmation, not a discovery (5 minutes)
Everything downstream of Stripe is proven. What a real charge still proves is that the **live**
Stripe keys and signing secret are wired right in production. Runbook:
`.flywheel/002/proof-charge-runbook.md`. Watch it live with:

```bash
cd ~/Desktop/claudemac/chatgptauto1 && bash scripts/watch-proof-charge.sh
```

then buy at <https://buy.stripe.com/aFa14p2wGbIOf5beKA5gc0i> using a Google Maps link you can
check. Don't refund it — the $7.52 fee is the cost either way, and a 100%-refund first
transaction is the exact shape Stripe's risk model watches on young accounts.

### 3. Decide the sending identity — this is the real gate (your call, then ~$20)
The recommendation stands and has not changed: **do not cold-send from
`aviharrison957@gmail.com`.** It is the recovery address for five Google accounts and the login
for Stripe, Vercel, Namecheap, Apple and Chase. Google enforces bulk-sender policy at the account
level and the action is suspension. Buy a cousin domain (~$12/yr, `saboxaudits.com` reads best)
plus one Workspace seat ($7/mo), publish SPF/DKIM/DMARC before the first send, then warm it for
2-3 weeks. Full reasoning: `.flywheel/002/sending-decision.md`; records to paste:
`.flywheel/002/dns-records.md`.

**Reply "cousin domain" and I will do everything except the purchase and the DNS paste.**

### 4. A real postal address for the CAN-SPAM footer (30 seconds)
A street address or PO Box. No cold email may legally go out without it.

### 5. saboxai.com DNS — 5 minutes at Namecheap, worth doing regardless
Root SPF is **missing** today; Workspace mail passes on DKIM alone, one bad key from silent
failure. This improves delivery of the **paid audit emails**, independent of any outreach.
Exact records: `.flywheel/002/dns-records.md`. Edit the existing DMARC row, never add a second.

### 6. Decide: should `chatgptauto1` be private? (10 seconds)
It is public today. Nothing secret is in it and the sensitive directories are now ignored, but a
public repo for a product taking real money is a choice, not an accident. Say "make it private"
and I will.

---

## The phone lane needs none of this and can start tomorrow

`outreach/call-queue.csv` — 52 businesses, every one with a working number, ranked by
money-left-on-the-table: **15 Tier A**, 17 Tier B, 20 Tier C. Script with opener, gap lines, the
ask, four objections, a voicemail version and per-metro call windows:
`outreach/call-script.md`. No deliverability, no warmup, no CAN-SPAM dependency, no domain.

**This is the lane that fills the 2-3 weeks the email domain spends warming.** If you do one
thing this week, do this.

---

## Still true: nothing has been sent

No cold email has left this machine. There is no cron entry, no launchd agent, and no
send-capable script anywhere in `outreach/`. The only code that talks to Resend is the product's
audit delivery, and it only runs on a paid Stripe webhook.
