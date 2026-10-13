# Hosting guide (Optimasys infrastructure)

How to run Optimasys QR on the standard Optimasys setup: **native Node.js 22, systemd, nginx + Cloudflare, a dedicated Unix account and MongoDB**. No Docker is needed.

## At a glance

| | |
|---|---|
| Runtime | Node.js 22 LTS (works on Node 20.19+ as well) |
| Start command | `node server/dist/main.js` (after `npm ci && npm run build`) |
| Listens on | `HOST:PORT`, default `127.0.0.1:3000` behind nginx |
| Database | MongoDB 6.0+ (`DATABASE_URL=mongodb://…`). SQLite (no `DATABASE_URL`) and PostgreSQL also work |
| Persistent data | `DATA_DIR`: uploaded files (PDF/MP3), `secret.key`, and the SQLite file only if SQLite is used |
| Health check | `GET /api/health` returns `{"ok":true,…}` (checks the database too) |
| Logs | stdout/stderr, read with `journalctl -u optimasys-qr` |
| Ready-made files | `deploy/optimasys-qr.service`, `deploy/nginx-optimasys-qr.conf`, `deploy/deploy.sh` |

## 1. Unix account and directories

```bash
useradd --system --create-home --home-dir /srv/optimasys-qr --shell /bin/bash optimasys-qr
mkdir -p /srv/optimasys-qr/{releases,shared} /var/lib/optimasys-qr
chown -R optimasys-qr:optimasys-qr /srv/optimasys-qr /var/lib/optimasys-qr
chmod 700 /var/lib/optimasys-qr
```

```
/srv/optimasys-qr/
  repo.git/            bare mirror of the GitHub repository (used by deploy.sh)
  releases/<git-sha>/  one directory per deployed version (last 5 kept)
  current -> releases/<git-sha>
  shared/.env          configuration, never in git (chmod 600)
/var/lib/optimasys-qr/ DATA_DIR, outside every release: files/, secret.key (and optimasys.db with SQLite)
```

## 2. Configuration (`shared/.env`)

Start from `.env.example` in the repository. The values that matter on the server:

```ini
PUBLIC_URL=https://qr.example.com          # goes into every printed QR code: choose once, never change
PORT=3000
TRUST_PROXY=loopback                       # nginx on the same machine passes the visitor IP
DATABASE_URL=mongodb://optimasys_qr:PASSWORD@127.0.0.1:27017/optimasys_qr?authSource=optimasys_qr
DATA_KEY=<openssl rand -hex 32>            # encrypts Wi-Fi passwords in the database; store it in your secret manager
FILE_SECRET=<openssl rand -hex 32>         # signs file links of password-protected pages
SMTP_HOST=… SMTP_PORT=587 SMTP_USER=… SMTP_PASS=… MAIL_FROM="Optimasys QR <no-reply@optimasys.com>"
```

`NODE_ENV`, `HOST` and `DATA_DIR` are set in the systemd unit.

Keep `DATA_KEY` **separate from database backups**: without it, encrypted fields are unreadable, and anyone with the key and a backup can read them.

## 3. MongoDB

- Any MongoDB 6.0 or newer works: a standalone server is fine. The app does not use multi-document transactions, so no replica set is required.
- Create one database and one user with `readWrite` on that database only:

  ```js
  use optimasys_qr
  db.createUser({ user: "optimasys_qr", pwd: "…", roles: [{ role: "readWrite", db: "optimasys_qr" }] })
  ```
- The database name comes from `DATABASE_URL` (default `optimasys`). Collections and indexes are created automatically at startup. There is no separate migration step.
- Collections: `users`, `sessions`, `emailVerifications`, `passwordResets`, `qrCodes`, `scanStats` (daily counts per code, no IP addresses), `files` (metadata only; the files themselves are in `DATA_DIR/files`).
- **Backups:** `mongodump --uri="$DATABASE_URL" --archive=… --gzip`, plus a copy of `DATA_DIR/files`. `npm run backup` copies the files directory.
- **Existing data in SQLite?** Run `DATABASE_URL=mongodb://… npm run migrate:mongo` once. It copies accounts, sessions, codes, statistics and file metadata, and skips anything that already exists, so it is safe to run again. Then move `DATA_DIR/files` and the key.

**Starting with SQLite instead:** leave `DATABASE_URL` empty and the app uses `DATA_DIR/optimasys.db` (WAL mode). Switch later with `npm run migrate:mongo`.

## 4. Deployment (GitHub → versioned release)

`deploy/deploy.sh [branch|tag|commit]` (default `main`) does this; set `REPO` to the GitHub repository. `APP_DIR`, `RESTART` and `HEALTH_URL` can be overridden. CI/CD can run the same commands instead.

1. Export the commit into `releases/<sha>` (`git archive`).
2. `npm ci` installs dependencies, including the build tools.
3. `npm run build` compiles the NestJS server (TypeScript → `server/dist`) and the minified front-end (`build/`).
4. `npm prune --omit=dev` removes the build tools.
5. Point `current` at the new release and run `systemctl restart optimasys-qr`.
6. Wait for `/api/health` to answer.

Rollback: point `current` at the previous release and restart.

`better-sqlite3` and other native modules download prebuilt binaries during `npm ci`. If that is blocked, the server needs `python3`, `make` and `g++` to compile them.

Allow the app user to restart only its own service:

```
# /etc/sudoers.d/optimasys-qr
optimasys-qr ALL=(root) NOPASSWD: /bin/systemctl restart optimasys-qr, /bin/systemctl status optimasys-qr
```

## 5. systemd

Copy `deploy/optimasys-qr.service` to `/etc/systemd/system/`, then:

```bash
systemctl daemon-reload
systemctl enable --now optimasys-qr
```

The unit runs as `optimasys-qr`, binds to `127.0.0.1`, can only write to `/var/lib/optimasys-qr` (`ProtectSystem=strict`), and restarts automatically. On `SIGTERM` the app closes its database connection cleanly.

## 6. nginx + Cloudflare

Copy `deploy/nginx-optimasys-qr.conf` and replace the domain. Two things matter:

- **Real visitor IP:** `real_ip_header CF-Connecting-IP` with Cloudflare's IP ranges. nginx then passes the real IP in `X-Forwarded-For`, and the app trusts only localhost (`TRUST_PROXY=loopback`). The visitor IP is used for country/city in scan statistics and for login rate limits. It is **not** stored.
- **Upload size:** `client_max_body_size 16m` (logos, PDF and MP3 files).

Cloudflare: SSL mode *Full (strict)* with an Origin Certificate. Do not cache `/api/*` or `/q/*`; caching static files is fine.

## 7. Developer access (without root)

The developer logs in over SSH as `optimasys-qr` and can:

- see logs: `journalctl -u optimasys-qr -f` (add the user to the `systemd-journal` group);
- see status and restart: `sudo systemctl status|restart optimasys-qr` (sudoers line above);
- deploy: `~/current/deploy/deploy.sh` or through CI;
- read data: `mongosh "$DATABASE_URL"` with the app's own database user.

## 8. Monitoring and maintenance

- Health: `GET /api/health` returns `200 {"ok":true}`, or `503` when the database is unreachable.
- Hourly, the app removes expired sessions and links, and accounts that were never verified after 7 days.
- Monthly: update the geo database for country/city statistics (`docs/statistieken.md`).
- Checking it works: `DATABASE_URL=mongodb://…/optimasys_qr_test npm test` runs the full API test suite against a real MongoDB, including 50 simultaneous scans on one code. Use an empty test database.
