# Hosting guide (Optimasys infrastructure)

How to run QR Generator on the standard Optimasys setup: **native Node.js 22, systemd, nginx + Cloudflare, a dedicated Unix account, and SQLite** (MongoDB later if wanted). No Docker is needed.

## At a glance

| | |
|---|---|
| Runtime | Node.js 22 LTS (works on Node 20.19+ as well) |
| Start command | `node server/dist/main.js` (after `npm ci && npm run build`) |
| Listens on | `HOST:PORT`, default `127.0.0.1:3000` behind nginx |
| Database | SQLite in `DATA_DIR` (WAL mode): the default, no `DATABASE_URL` needed. MongoDB 6.0+ (`DATABASE_URL=mongodb://…`) and PostgreSQL also work |
| Persistent data | `DATA_DIR`: the SQLite database (`optimasys.db`), uploaded files (PDF/MP3) and `secret.key` |
| Health check | `GET /api/health` returns `{"ok":true,…}` (checks the database too) |
| Logs | stdout/stderr, read with `journalctl -u optimasys-qr` |
| Ready-made files | `deploy/optimasys-qr.service`, `deploy/optimasys-qr-backup.service` + `.timer`, `deploy/nginx-optimasys-qr.conf`, `deploy/deploy.sh` |

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
/var/lib/optimasys-qr/ DATA_DIR, outside every release: optimasys.db (SQLite), files/, secret.key
```

## 2. Configuration (`shared/.env`)

Start from `.env.example` in the repository. The values that matter on the server:

```ini
PUBLIC_URL=https://qr.example.com          # goes into every printed QR code: choose once, never change
PORT=3000
TRUST_PROXY=loopback                       # nginx on the same machine passes the visitor IP
# DATABASE_URL stays empty: SQLite in DATA_DIR. (Later: mongodb://… to switch to MongoDB, see section 3.)
DATA_KEY=<openssl rand -hex 32>            # encrypts Wi-Fi passwords in the database; store it in your secret manager
FILE_SECRET=<openssl rand -hex 32>         # signs file links of password-protected pages
SMTP_HOST=… SMTP_PORT=587 SMTP_USER=… SMTP_PASS=… MAIL_FROM="Optimasys QR <no-reply@optimasys.com>"
SUPPORT_EMAIL=support@…                    # team account, created (already verified) at startup if it doesn't exist
SUPPORT_PASSWORD="…"                       # only on the server; quotes if it has spaces; 8+ chars, capital, number, special char
# ADMIN_EMAILS=a@…,b@…                     # more team members (optional)
```

**Licences / accounts.** Customers can't sign up themselves. A team member (`SUPPORT_EMAIL`, `ADMIN_EMAILS`) adds a customer on the **Customers** page. The customer gets an email to choose a password (valid 7 days) and is then logged in. Without SMTP, the page shows the invitation link to send manually. `ALLOW_SIGNUP=true` opens self sign-up again, for development only.

`NODE_ENV`, `HOST` and `DATA_DIR` are set in the systemd unit.

Keep `DATA_KEY` **separate from database backups**: without it, encrypted fields are unreadable, and anyone with the key and a backup can read them.

## 3. Database

**SQLite (default).** With `DATABASE_URL` empty, the app uses `DATA_DIR/optimasys.db` with WAL mode, a busy timeout and foreign keys. Tables are created automatically at startup; there is no separate migration step.

- **Backups:** `deploy/optimasys-qr-backup.timer` runs `scripts/backup.js` every night (≈03:15): a consistent copy of the database (safe while the app runs) plus `DATA_DIR/files`, into `/var/backups/optimasys-qr` (keeps the last 14). Install steps are at the top of `deploy/optimasys-qr-backup.service`. Copy that folder to your central backup, and keep `DATA_KEY` separately.
- One app process per database file. That is plenty for this app: in tests it handled more than 1,000 scans per second.

**MongoDB (optional, later).** Set `DATABASE_URL=mongodb://…` and restart.
- MongoDB 6.0+, standalone is fine (no transactions used, so no replica set needed). One database and one user with `readWrite` on that database only.
- Collections and indexes are created automatically at startup.
- Move existing SQLite data once with `DATABASE_URL=mongodb://… npm run migrate:mongo` (safe to run again). Backups: `mongodump`, plus `DATA_DIR/files`.

## 4. Deployment (GitHub → versioned release)

`deploy/deploy.sh [branch|tag|commit]` does this. By default it deploys branch `optimasys-qr-demo` from https://github.com/Gilamby/qr-code-demo (public, so no key is needed to read it; set `REPO` if the code moves to an Optimasys organisation). `APP_DIR`, `RESTART` and `HEALTH_URL` can be overridden. CI/CD can run the same commands instead.

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
- read data: `sqlite3 /var/lib/optimasys-qr/optimasys.db` (read-only queries), or `mongosh "$DATABASE_URL"` when MongoDB is used.

## 8. Monitoring and maintenance

- Health: `GET /api/health` returns `200 {"ok":true}`, or `503` when the database is unreachable.
- Hourly, the app removes expired sessions and links, and accounts that were never verified after 7 days.
- Monthly: update the geo database for country/city statistics (`docs/statistieken.md`).
- Checking it works: `npm test` runs the full API test suite (accounts, codes per customer, files, scans, analytics, security, billing, contact). With `DATABASE_URL=…` it runs against another database; use an empty test database.
