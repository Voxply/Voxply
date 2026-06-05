# Hub Operator Guide

Practical reference for running a Voxply hub in production. For architecture
background, see [architecture.md](architecture.md) and
[threat-model.md](threat-model.md). For the full build and systemd setup, see
[hosting.md](hosting.md).

---

## Environment variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `VOXPLY_HTTP_PORT` | HTTP / WebSocket port | `3000` |
| `VOXPLY_VOICE_UDP_PORT` | Voice UDP relay port | `3001` |
| `VOXPLY_TLS_CERT` | Path to TLS cert PEM. Enables HTTPS. | unset |
| `VOXPLY_TLS_KEY` | Path to TLS private key PEM. Required with cert. | unset |
| `VOXPLY_FARM_URL` | URL of the farm this hub belongs to (optional). | unset |

The hub binds to `0.0.0.0` on both ports. Data files (`hub.db`,
`hub_identity.json`) are written to the process working directory; set
`WorkingDirectory=` in your service unit to control where they land.

---

## First-run bootstrap

On an empty database, the hub runs all migrations automatically. The first
user to successfully authenticate becomes the **Owner** (the `builtin-owner`
role is granted with no existing owners present).

To pre-configure a hub for unattended deployment, set
`VOXPLY_TEMPLATE_URL` to a JSON bootstrap URL and
`VOXPLY_BOOTSTRAP_TOKEN` to authenticate against it. The hub fetches
the template on first run and creates channels, roles, and settings from it.
See [hub-creation-wizard.md](hub-creation-wizard.md) for the template schema.

---

## Backup and restore

The entire hub state lives in two files:

| File | Contents | Notes |
|------|----------|-------|
| `hub.db` | All community data (messages, roles, certs, sessions, …) | SQLite; WAL mode. |
| `hub_identity.json` | Hub Ed25519 key pair | **Critical** — back this up off-site. Loss = hub identity loss. |

**Backup procedure** (while hub is running):

```bash
# SQLite hot backup — safe while hub is online
sqlite3 hub.db ".backup /backup/hub-$(date +%F).db"

# Copy the identity file
cp hub_identity.json /backup/hub_identity.json
```

Or stop the hub and copy both files directly.

**Restore procedure**:

1. Stop the hub process.
2. Copy `hub.db` and `hub_identity.json` back to the working directory.
3. Start the hub. It resumes from the backup state.

Also available via the CLI subcommand:

```bash
voxply-hub backup --out /backup/hub.tar.gz
voxply-hub restore --from /backup/hub.tar.gz
```

---

## Upgrade path

1. Stop the current hub process.
2. Replace the binary with the new version.
3. Start the hub. New migrations run automatically on startup.

Voxply uses additive migrations only — there are no destructive schema
changes in minor/patch upgrades. If a migration fails (e.g., disk full),
the hub exits and the database is left untouched.

---

## Basic hardening checklist

- [ ] **TLS**: terminate TLS at the hub (via `VOXPLY_TLS_CERT` / `VOXPLY_TLS_KEY`)
  or at a reverse proxy (nginx/Caddy). Never expose HTTP to the public internet.
- [ ] **Firewall**: allow only ports 443 (HTTPS) and `VOXPLY_VOICE_UDP_PORT`
  (UDP). No SSH from the internet.
- [ ] **Service user**: run the hub as a dedicated non-root user.
  `hub_identity.json` must be readable only by that user (`chmod 600`).
- [ ] **Backups**: schedule daily `sqlite3 hub.db ".backup ..."` + off-site copy
  of `hub_identity.json`.
- [ ] **Auth rate limiting**: the hub limits auth attempts to 10 per IP per
  60-second window automatically. For additional protection, put a WAF in front
  (e.g., Cloudflare, rate-limit at nginx).
- [ ] **Approval gate**: consider enabling *require approval* in Hub Settings
  so new members are vetted before joining a community hub.
- [ ] **PoW level**: set a minimum proof-of-work level (Hub Settings → Auth)
  for open hubs to deter spam registrations.
- [ ] **Monitoring**: `GET /health` returns `{"status":"ok","version":"...","uptime_seconds":...,"db_status":"ok"}`.
  Point your uptime checker at it.

---

## Health check

```
GET /health
```

Returns:

```json
{
  "status": "ok",
  "version": "0.2.0",
  "uptime_seconds": 86400,
  "db_status": "ok"
}
```

`db_status` is `"ok"` when a `SELECT 1` probe against the pool succeeds,
`"error"` otherwise.

---

## Hub admin CLI

```bash
# Create an invitation link (bypasses approval gate)
voxply-hub admin invite --expires 24h

# Revoke a session by token
voxply-hub admin revoke-session <token>

# Promote a user to Owner
voxply-hub admin grant-role <pubkey> builtin-owner

# Key rotation (updates hub_identity.json and publishes /key-rotation)
voxply-hub rotate-key
```

For the full admin CLI reference, see [hub-admin-panel.md](hub-admin-panel.md).

---

## Observability

Prometheus-compatible metrics are exposed at `GET /metrics` (text format).
Key metrics:

| Metric | What it measures |
|--------|-----------------|
| `hub_active_ws_connections` | WebSocket connections right now |
| `hub_messages_total` | Chat messages sent (counter) |
| `hub_auth_attempts_total` | Auth verifications (labelled `ok`/`failed`) |
| `hub_voice_participants` | UDP voice relay participants right now |
| `hub_db_query_duration_seconds` | SQLite query latency histogram |

Logs are emitted in JSON to stdout (structured, `tracing`-based). Pipe to
`journald`, Loki, or any JSON log aggregator.
