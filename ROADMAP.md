# Voxply Roadmap

Tracks **what's next, what's broken, and what we'd like to build but
haven't designed yet**. Everything else — architecture, design rationale,
shipped features, design questions — lives in the wiki at
[`docs/`](docs/README.md).

## 🔨 Next up

- **External bots — remaining UI** — shipped. No remaining frontend items.
  Completed: component interaction WS send with optimistic disable, BotCard popover,
  ExternalBotSection with invite token + channel scope selector, WebhooksSection,
  Integrations tab in HubAdminPage (desktop + web).

- **Android client — bots rendering parity** — shipped. BOT/APP badges, ephemeral
  message styling, `MessageEmbeds`, `MessageComponents`, and Bots subsection in
  member list all ported. Component interaction dispatch is a no-op on Android
  pending the hub HTTP interaction endpoint.

- **Activities button** — design complete (`docs/gaming.md`). Channel toolbar button
  opens a game picker modal over hub-installed games; feeds the same Tier 1 iframe
  sandbox. Implement in desktop + web + Android clients.

## 🚧 Blocked

_(nothing blocked)_

## 📌 Wishlist (undesigned)

Things we want to build but haven't committed to a design yet. Designed
items live in the wiki — see
[`future-features.md`](docs/future-features.md),
[`farm-model.md`](docs/farm-model.md),
[`gaming.md`](docs/gaming.md).

- **Performance ceiling** — load test WS broadcast, search, voice relay
- **Accessibility + i18n** — keyboard nav audit, screen-reader, localization

## 🧭 Designed, not started

- **Farm model — Phase 1 (farm-level auth) + Phase 2 (hub multi-tenancy)** —
  detailed design in [`farm-impl.md`](docs/farm-impl.md). New `farm/` crate
  in Voxply-server, signed token shape, hub-side verification with cached
  farm pubkey, three-step migration (dual-issue → stand up farm → hubs return
  410 for old tokens), `POST /farm/hubs` with per-creator quota.

## ⚠️ Known issues

_(none currently)_

## 💤 Won't do

- **Load-aware DM routing across a user's hubs** — failover only; load-balancing needs gossip + cross-hub consistency. See [decisions.md](docs/decisions.md)
- **Concurrent mic test while in voice** — two cpal input streams unreliable cross-platform; live meter covers it
