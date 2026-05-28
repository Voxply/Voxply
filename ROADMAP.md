# Voxply Roadmap

Tracks **what's next, what's broken, and what we'd like to build but
haven't designed yet**. Everything else — architecture, design rationale,
shipped features, design questions — lives in the wiki at
[`docs/`](docs/README.md).

## 🔨 Next up

- **Farm discovery website integration** (Voxply-discovery) — `POST /farms/register`
  signed self-submission, `GET /farms` catalog with country/region/language/tag filters,
  revalidation cron. Detailed design in [`farm-impl.md`](docs/farm-impl.md) section E.

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

_(Farm Phase 2 shipped — see commit history)_
_(Farm Phase 3 client shipped — FarmSettingsPage, CreateHubWizard, hub sidebar popover)_

## ⚠️ Known issues

_(none currently)_

## 💤 Won't do

- **Load-aware DM routing across a user's hubs** — failover only; load-balancing needs gossip + cross-hub consistency. See [decisions.md](docs/decisions.md)
- **Concurrent mic test while in voice** — two cpal input streams unreliable cross-platform; live meter covers it
