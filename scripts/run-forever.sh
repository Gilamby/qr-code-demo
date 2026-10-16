#!/bin/bash
# =========================================================
#  Bewaker: houdt de app altijd draaiend.
#  Stopt de app (crash, geheugen, database even weg), dan start deze lus hem binnen 2 seconden opnieuw.
#  Crasht hij steeds direct na het starten (bv. database langer weg), dan wacht hij 30 seconden tussen pogingen.
#  Niet zelf starten: scripts/start-server.sh doet dat.
# =========================================================
cd "$(dirname "$0")/.." || exit 1
LOG="$HOME/qr-app.log"
fails=0
while true; do
  if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 10485760 ]; then mv "$LOG" "$LOG.1"; fi
  started=$(date +%s)
  node server/dist/main.js >> "$LOG" 2>&1
  code=$?
  ran=$(( $(date +%s) - started ))
  if [ "$ran" -lt 30 ]; then fails=$((fails + 1)); else fails=0; fi
  wait=2; [ "$fails" -gt 5 ] && wait=30
  echo "$(date '+%F %T') app gestopt (code $code, draaide ${ran}s): over ${wait}s opnieuw starten" >> "$LOG"
  sleep "$wait"
done
