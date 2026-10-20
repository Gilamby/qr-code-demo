#!/bin/bash
# Bewaker: start de website opnieuw als hij stopt. Niet zelf starten: scripts/start.sh doet dat.
cd "$(dirname "$0")/.." || exit 1
LOG="$HOME/qr-website.log"
set -a; [ -f .env ] && . ./.env; set +a
export NODE_ENV=production
PORT=${PORT:-3200}
while true; do
  if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 10485760 ]; then mv "$LOG" "$LOG.1"; fi
  node node_modules/next/dist/bin/next start -p "$PORT" -H 127.0.0.1 >> "$LOG" 2>&1
  echo "$(date '+%F %T') website gestopt (code $?): over 3s opnieuw starten" >> "$LOG"
  sleep 3
done
