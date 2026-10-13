#!/usr/bin/env bash
# Reference deployment script: GitHub -> versioned release -> switch symlink -> restart.
# Run as the application user (optimasys-qr). Usage:  deploy/deploy.sh [branch|tag|commit]   (default: main)
# The team's own CI/CD can do the same steps; this script documents what is needed.
set -euo pipefail

APP_DIR=${APP_DIR:-/srv/optimasys-qr}
REPO=${REPO:-git@github.com:OWNER/REPO.git}      # set to the real repository
REF=${1:-main}                                   # branch, tag or commit to deploy
KEEP=5                                           # number of releases to keep
RESTART=${RESTART:-sudo /bin/systemctl restart optimasys-qr}   # allow only this command via sudoers (see docs/hosting.md)
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/api/health}

cd "$APP_DIR"
[ -d repo.git ] || git clone --mirror "$REPO" repo.git
git --git-dir=repo.git fetch --prune --quiet
SHA=$(git --git-dir=repo.git rev-parse --short=12 "$REF")
REL="$APP_DIR/releases/$SHA"

if [ ! -d "$REL" ]; then
  mkdir -p "$REL.tmp"
  git --git-dir=repo.git archive "$SHA" | tar -x -C "$REL.tmp"
  cd "$REL.tmp"
  npm ci --no-audit --no-fund          # includes build tools (TypeScript, esbuild)
  npm run build                        # server (TypeScript -> server/dist) + minified front-end (build/)
  npm prune --omit=dev --no-audit --no-fund
  cd "$APP_DIR"
  mv "$REL.tmp" "$REL"
fi

ln -sfn "$REL" "$APP_DIR/current.new" && mv -T "$APP_DIR/current.new" "$APP_DIR/current"
$RESTART

# Health check
for i in $(seq 1 20); do
  if curl -fs "$HEALTH_URL" >/dev/null; then echo "Deployed $SHA"; break; fi
  sleep 1
  [ "$i" = 20 ] && { echo "Health check failed for $SHA"; exit 1; }
done

# Remove old releases
ls -1dt "$APP_DIR"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
