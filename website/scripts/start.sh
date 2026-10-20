#!/bin/bash
# =========================================================
#  Website qr-codex.com (her)starten op de server, op de achtergrond.
#    bash scripts/start.sh          herstart (na een update)
#    bash scripts/start.sh check    alleen starten als de website niet reageert (voor crontab)
#  Log: ~/qr-website.log
# =========================================================
cd "$(dirname "$0")/.." || exit 1
LOG="$HOME/qr-website.log"
PORT=$(grep -E '^PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d '"'"'"' ')
PORT=${PORT:-3200}

if [ "$1" = "check" ]; then
  curl -sf -m 5 "http://127.0.0.1:$PORT/robots.txt" > /dev/null && exit 0
  echo "$(date '+%F %T') website reageerde niet: opnieuw starten" >> "$LOG"
fi
node scripts/env.mjs
if [ ! -d .next ]; then echo "Eerst bouwen: npm ci && npm run build"; exit 1; fi
# oude bewaker en oude website stoppen
pkill -f "scripts/run-websit[e].sh"
if [ -f .website.pid ]; then kill "$(cat .website.pid)" 2>/dev/null; pkill -P "$(cat .website.pid)" 2>/dev/null; fi
sleep 2
nohup setsid bash scripts/run-website.sh > /dev/null 2>&1 < /dev/null &
for i in $(seq 1 30); do
  sleep 1
  if curl -sf -m 2 "http://127.0.0.1:$PORT/robots.txt" > /dev/null; then echo "Website draait (poort $PORT)."; exit 0; fi
done
echo "Website start niet. Kijk in $LOG:"; tail -20 "$LOG"; exit 1
