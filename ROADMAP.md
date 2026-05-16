# Voxply Roadmap

Tracks **what's next, what's broken, and what we'd like to build but
haven't designed yet**. Everything else — architecture, design rationale,
shipped features, design questions — lives in the wiki at
[`docs/`](docs/README.md).

## 🔨 Next up

- **Prefs blob sync** — QR pairing infrastructure is in place; the encrypted blob key is a placeholder (32 zero bytes). Real X25519 ECIES wrap + blob fetch on new-device pair is the remaining piece.

## 🚧 Blocked

- **Android client icons** — placeholder solid-color PNGs in place. Waiting on logo (see [`docs/brand.md`](docs/brand.md)). Run `cargo tauri icon <1024x1024.png>` once ready.

## 📌 Wishlist (undesigned)

Things we want to build but haven't committed to a design yet. Designed
items live in the wiki — see
[`future-features.md`](docs/future-features.md),
[`farm-model.md`](docs/farm-model.md),
[`gaming.md`](docs/gaming.md).

- **Performance ceiling** — load test WS broadcast, search, voice relay
- **Accessibility + i18n** — keyboard nav audit, screen-reader, localization

## ⚠️ Known issues

- No custom display font — system stack only

## 💤 Won't do

- **Load-aware DM routing across a user's hubs** — failover only; load-balancing needs gossip + cross-hub consistency. See [decisions.md](docs/decisions.md)
- **Concurrent mic test while in voice** — two cpal input streams unreliable cross-platform; live meter covers it
