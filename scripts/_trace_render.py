#!/usr/bin/env python3
"""Render MAPGAP_TRACE lines from `vercel logs --json` into a live human-readable ledger.

Reads log lines on stdin, writes one ledger line per pipeline leg. Tolerant of both raw log
lines and lines where the trace sits JSON-escaped inside an outer envelope, so it keeps working
across Vercel CLI output-shape changes. Used by scripts/watch-proof-charge.sh.
"""
import sys, json, time

LEG = {
    "checkout_received":   ("1/5", "checkout received "),
    "place_resolved":      ("2/5", "place resolved    "),
    "audit_generated":     ("3/5", "audit generated   "),
    "resend_accepted":     ("4/5", "resend accepted   "),
    "fulfilled":           ("5/5", "FULFILLED         "),
    "duplicate_ignored":   ("--",  "duplicate ignored "),
    "failed":              ("!!",  "FAILED            "),
    "fallback_alert_sent": ("!!",  "owner alerted     "),
}


def detail(leg, d):
    g = d.get
    if leg == "checkout_received":
        amt = (g("amountTotal") or 0) / 100
        return "%s %.2f  livemode=%s  %s" % (g("currency", ""), amt, g("livemode"), g("email", ""))
    if leg == "place_resolved":
        return "%s  hasWebsite=%s  %sms" % (g("business"), g("hasWebsite"), g("ms"))
    if leg == "audit_generated":
        return "%s  %sB  tokens=%s  %sms" % (g("model"), g("htmlBytes"), g("tokens"), g("ms"))
    if leg == "resend_accepted":
        return "%s  id=%s  http=%s" % (g("kind"), g("messageId"), g("status"))
    if leg == "fulfilled":
        return "%s  %s  total=%sms" % (g("business"), g("email", ""), g("totalMs"))
    if leg == "duplicate_ignored":
        return "first fulfilled at %s" % g("firstFulfilledAt")
    if leg == "failed":
        return str(g("error", ""))
    if leg == "fallback_alert_sent":
        return "event %s" % g("event")
    return json.dumps(d)


def emit(p):
    leg = p.get("leg", "?")
    num, label = LEG.get(leg, ("??", (leg + "                  ")[:18]))
    ts = time.strftime("%H:%M:%S")
    print("  %s  [%s] %s %s" % (ts, num, label, detail(leg, p)), flush=True)
    if leg == "fulfilled":
        print("        ^ server-side chain complete. Now confirm the email actually landed.", flush=True)
    if leg in ("failed", "fallback_alert_sent"):
        print("        ^ STOP. Do not proceed to send-readiness. Capture this line.", flush=True)


def find_trace(line):
    """Pull the JSON object that follows the MAPGAP_TRACE marker, escaped or not."""
    if "MAPGAP_TRACE" not in line:
        return None
    frag = line[line.index("MAPGAP_TRACE") + len("MAPGAP_TRACE"):].strip()
    unescaped = frag.replace('\\"', '"').replace("\\\\", "\\")
    for candidate in (frag, unescaped):
        depth = 0
        for j, ch in enumerate(candidate):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(candidate[: j + 1])
                    except Exception:
                        break
    return None


RAW_NOTES = (
    ("fulfillment failed", "PIPELINE ERROR"),
    ("stripe webhook rejected", "SIGNATURE REJECTED"),
    ("fallback alert also failed", "ALERT ALSO FAILED"),
    ("ignoring session", "FOREIGN LINK DROPPED"),
    ("fulfilled:", "FULFILLED (untraced build)"),
)


def main():
    for raw in sys.stdin:
        raw = raw.rstrip("\n")
        if not raw.strip():
            continue
        p = find_trace(raw)
        if p:
            emit(p)
            continue
        low = raw.lower()
        for needle, note in RAW_NOTES:
            if needle in low:
                print("  %s  [raw] %s: %s" % (time.strftime("%H:%M:%S"), note, raw[-200:]), flush=True)
                break


main()
