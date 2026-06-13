# Voxply pilot on web.videogamezone.eu — runbook

First external hub operator pilot. The hub belongs to the friend (owner);
we provide the artifacts and support. Companion docs: `docs/docs/hosting.md`,
`docs/docs/hub-operator-guide.md`, `DEMO-HUB.md` (workspace root).

Surveyed 2026-06-12: OVH VPS, Ubuntu 24.04 LTS, 2 vCPU / 3.7 GiB (2.5 free),
26 GB disk free, Docker 29.5.3, nginx with 13 vhosts, MySQL, mail.
Wildcard DNS `*.videogamezone.eu` → 135.125.204.25 (direct, not Cloudflare).
Wildcard LE cert `*.videogamezone.eu` already on the box.
Ports 3000 TCP / 3001 UDP free.

## Files in this folder

| File | Goes to | Needs root |
|---|---|---|
| `voxply.videogamezone.eu` | `/etc/nginx/sites-available/` + symlink in `sites-enabled/` | yes |
| `docker-compose.yml` | `~/voxply/docker-compose.yml` (anachim's home) | no |

## Gate (before anything on the server)

The published hub image lacks the CORS layer and `--doctor` (both on
`develop`, hub commit `054fa09`). Either:

- **A (preferred):** merge `develop` → `main` in Voxply-server, cut v0.2.1
  so CI publishes `ghcr.io/voxply/hub:latest`; or
- **B (pilot shortcut):** build from `develop` locally, then
  `docker save voxply-hub:develop | ssh anachim@web.videogamezone.eu docker load`
  and switch the image line in the compose file.

## One-time setup (friend / root)

1. `sudo usermod -aG docker anachim` — note: docker group ≈ root-equivalent;
   his call. Re-login for it to take effect.
2. Install vhost — friend chose the symlink-from-home variant so we can
   edit it without root (file stays at `/home/anachim/voxply/`):
   `sudo ln -s /home/anachim/voxply/voxply.videogamezone.eu /etc/nginx/sites-enabled/`
   `sudo nginx -t && sudo systemctl reload nginx`
   (`nginx -t` BEFORE reload — protects the other 13 sites.)
   ⚠️ While the symlink exists, NEVER delete or chmod the file in ~/voxply:
   a dangling include fails `nginx -t` for the WHOLE config and blocks every
   future reload (incl. certbot renewals) for all 13 sites.
   Edits to the file still need a root `systemctl reload nginx` to apply.
3. Firewall: allow **3001/udp** in ufw (if active: `sudo ufw allow 3001/udp`)
   AND in the OVH control panel firewall if one is attached to the IP.
   Voice fails silently without this.

## Owner key (friend, before first boot)

He installs the desktop client, copies his pubkey from Settings → Identity
(64 hex chars), and it goes into `VOXPLY_OWNER_PUBKEY` in the compose file.
Set before first boot — a fresh hub has no owner otherwise.

## Launch (anachim, no root)

```bash
mkdir -p ~/voxply && cd ~/voxply        # compose file goes here
docker compose up -d
docker compose exec hub /voxply-hub --doctor   # expect PASS lines
curl -s https://voxply.videogamezone.eu/health  # {"status":"ok",...}
curl -s https://voxply.videogamezone.eu/info    # hub identity JSON
```

## Verification checklist

- [ ] `/health` returns ok over TLS
- [ ] Desktop client joins `https://voxply.videogamezone.eu`
- [ ] Web client (voxply.github.io/Voxply-web) joins it — proves CORS in prod
- [ ] Two clients in a voice channel — proves UDP 3001 end to end
- [ ] Friend's existing sites still up (spot-check 2–3 vhosts)
- [ ] Back up `hub_identity.json` from the `voxply_hub-data` volume once:
      `docker compose cp hub:/data/hub_identity.json ~/voxply/hub_identity.backup.json`
      (it IS the hub's identity; keep a copy off the box)

## Rollback / full cleanup ("don't break anything" guarantee)

```bash
cd ~/voxply && docker compose down -v   # container + data volume gone
# ORDER MATTERS: remove the symlink BEFORE deleting anything in ~/voxply
sudo rm /etc/nginx/sites-enabled/voxply.videogamezone.eu
sudo nginx -t && sudo systemctl reload nginx
rm -rf ~/voxply                          # only after the symlink is gone
# (no ufw rule was needed — no firewall on the box)
```

Nothing else on the box is touched: no packages installed, no system
config edited, data confined to the Docker volume and `~/voxply`.

## Open items

- [ ] v0.2.1 release (gate A) or dev image transfer (gate B)
- [ ] Friend: docker group, vhost install, UDP 3001, owner pubkey
- [ ] After stable: list his hub on discovery (his call), federation test
      against one of our hubs — first real two-operator alliance test
