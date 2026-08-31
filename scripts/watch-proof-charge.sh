#!/usr/bin/env bash
# Live watcher for a real MapGap order moving through the pipe.
#
#   bash scripts/watch-proof-charge.sh
#
# Streams production runtime logs and renders one line per pipeline leg as it happens.
# Leave it running in its own terminal, then make the purchase. Ctrl-C to stop.
#
# Legs it shows (server-side):
#   1 checkout_received   signed checkout.session.completed accepted as MapGap's
#   2 place_resolved      Google Places returned the business
#   3 audit_generated     the model produced the report HTML
#   4 resend_accepted     Resend returned 2xx and gave us a message id
#   5 fulfilled           chain complete, marked idempotent
# Failure legs: failed / fallback_alert_sent / duplicate_ignored
#
# Leg 6 (actual inbox delivery) is NOT observable here — Resend acceptance is the last
# server-side event. Confirm delivery in the inbox, or with:
#   bash scripts/watch-proof-charge.sh --check-delivery
set -uo pipefail
TARGET="${MAPGAP_PROD_URL:-mapgap-report.vercel.app}"

if [ "${1:-}" = "--check-delivery" ]; then
  echo "Delivery is confirmed out-of-band. Check either:"
  echo "  - the customer inbox you used at checkout (subject: 'Your MapGap Report for <business>')"
  echo "  - https://resend.com/emails  -> find the message id printed by the resend_accepted leg"
  exit 0
fi

echo "watching $TARGET  (Ctrl-C to stop)"
echo "make the purchase now; legs will appear below as they happen"
echo

DIR="$(cd "$(dirname "$0")" && pwd)"
vercel logs "$TARGET" --follow --json 2>/dev/null | python3 -u "$DIR/_trace_render.py"
