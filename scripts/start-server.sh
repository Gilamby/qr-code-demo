#!/bin/bash
# =========================================================
#  App (her)starten op de server, op de achtergrond.
#    bash scripts/start-server.sh          herstart (na een update)
#    bash scripts/start-server.sh check    alleen starten als de app niet reageert
#  Voor crontab (zie docs/hosting.md):
#    @reboot      -> na een herstart van de server start de app vanzelf
#    elke minuut  -> "check": reageert de app niet (bv. vastgelopen), dan alles opnieuw starten
#  De app draait onder een bewaker (scripts/run-forever.sh): crasht hij, dan staat hij binnen 2 seconden weer aan.
#  Log: ~/qr-app.log (boven 10 MB wordt het oude log ~/qr-app.log.1)
# =========================================================
cd "$(dirname "$0")/.." || exit 1
LOG="$HOME/qr-app.log"
PORT=$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"'"'"' ')
PORT=${PORT:-3001}

if [ "$1" = "check" ]; then
  curl -sf -m 5 "http://127.0.0.1:$PORT/api/health" > /dev/null && exit 0
  echo "$(date '+%F %T') app reageerde niet: opnieuw starten" >> "$LOG"
fi

if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 10485760 ]; then mv "$LOG" "$LOG.1"; fi
pkill -f "scripts/run-foreve[r].sh"; pkill -f "server/dist/mai[n].js"; sleep 1
# De bewaker (run-forever.sh) start de app en start hem opnieuw als hij ooit stopt
nohup setsid bash scripts/run-forever.sh > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 20); do                                   # max. 20 seconden wachten tot hij antwoordt
  sleep 1
  if curl -sf -m 2 "http://127.0.0.1:$PORT/api/health" > /dev/null; then echo "App draait (poort $PORT)."; exit 0; fi
done
echo "App start niet. Kijk in $LOG:"; tail -20 "$LOG"; exit 1
