# Voxply Roadmap

Tracks **what's next, what's broken, and what we'd like to build but
haven't designed yet**. Everything else — architecture, design rationale,
shipped features, design questions — lives in the wiki at
[`docs/`](docs/README.md).

## 🔨 Next up

_(nothing — all pre-launch blockers are resolved)_

## 🚧 Blocked

- **Demo hub** — code is ready (`DEMO_HUB_URL` constant + conditional button). Blocked on ops: a Voxply-operated hub instance needs to be deployed and the constant flipped to its URL before the "Try a demo hub" button goes live.

## 📌 Wishlist (undesigned)

Things we want to build but haven't committed to a design yet. Designed
items live in the wiki — see
[`future-features.md`](docs/future-features.md),
[`gaming.md`](docs/gaming.md).

### Carry-over

- **E2E group DMs** — Signal-style sender-key scheme (v2 of
  e2e-encryption.md); blocks until 1:1 E2E is proven stable in production.
- **Gaming Tier 3** — MMO + persistent shared world; stretch goal.
  Proximity voice is already a general platform primitive; only the
  persistent-world layer is undesigned.

## 🚀 Recently shipped

- **Whisper UI** — `useWhisper` hook with inbound event tracking and
  list persistence. `WhisperPanel` in the voice bar with User/Channel/Saved
  Lists tabs, target checkboxes, one-click activate, save-as-list form.
  Inbound whisper badge on participant rows in the channel sidebar.
  Design in [`whisper.md`](docs/whisper.md).
- **Hub server operations** — backup/restore CLI, data retention sweep,
  Prometheus `/metrics`, hub key rotation (`voxply-hub rotate-key` +
  `GET /key-rotation`). Design in [`hub-operations.md`](docs/hub-operations.md).
- **Hub admin tooling** — web admin panel at `/admin/panel` (token-gated,
  embedded HTML), `voxply-hub admin` CLI subcommands, farm heartbeat +
  fleet console. Design in [`hub-admin-panel.md`](docs/hub-admin-panel.md).
- **Hub moderation enhancements** — federated ban lists (`GET /federation/banlist`,
  6h background sync), auto-mod webhook (500ms, fail-open, HMAC-SHA256),
  content reporting (`POST /messages/:id/report`, admin review queue).
  Design in [`moderation-enhancements.md`](docs/moderation-enhancements.md).
- **Discovery: full suite** — hub uptime tracking, global search, farm
  browsing catalog, anonymous aggregate analytics, hub config template
  catalog, hub creation wizard (`/new`). Design in
  [`discovery-v2.md`](docs/discovery-v2.md) and
  [`hub-creation-wizard.md`](docs/hub-creation-wizard.md).
- **Hub first-run bootstrap** — `VOXPLY_TEMPLATE_URL` / `VOXPLY_BOOTSTRAP_TOKEN`
  on empty-DB first launch; applies channels, roles, hub name from template.
  Design in [`hub-creation-wizard.md`](docs/hub-creation-wizard.md).
- **Client quality-of-life** — global message search (FTS5), message drafts,
  custom emojis per hub, events/calendar (`EventCard`, `EventsPanel`),
  native polls (`PollCard`, live bars), thread collapse/expand, notification
  grouping (3s per-hub debounce). Design in [`client-qol.md`](docs/client-qol.md).
- **Events / calendar** — `hub_events` + `event_rsvps` tables, full REST,
  `EventCard`, `EventsPanel`, Tauri commands. Design in [`client-qol.md`](docs/client-qol.md).
- **Native polls** — `polls` + `poll_votes`, live broadcast, `PollCard`,
  Tauri command. Design in [`client-qol.md`](docs/client-qol.md).
- **Video in voice channels** — WebRTC mesh, active-speaker management
  (top-3, 3s linger), `VideoGrid` (equal grid ≤4, active-speaker+thumbnails
  5+, self-view overlay), `BackgroundProcessor` (MediaPipe none/blur/image),
  camera toggle + background picker in voice bar, hub signaling envelopes.
  Scale: mesh works up to ~20; SFU hook designed-in for large events.
  Design in [`video-voice.md`](docs/video-voice.md).
- **Voice advanced settings** — Standard / Music / Custom audio quality
  profiles. `EffectiveVoiceConfig` resolved at pipeline start; Denoiser
  bypass; VAD gate per-profile; custom Opus bitrate, app mode, channels,
  frame size, complexity. Settings persisted to `voice.json`.
  Design in [`voice-advanced-settings.md`](docs/voice-advanced-settings.md).
- **Windows Authenticode signing** — CI signing wired in `release.yml`;
  activates once `WINDOWS_CERT_THUMBPRINT` secret is set (cert
  procurement via SignPath.io OSS tier still pending).
- **Missions system** — API routes in Voxply-discovery, Missions panel +
  PoW claim flow in desktop, spark balance + cosmetic catalog with
  entitlement blobs. Design in [`missions.md`](docs/missions.md).
- **Per-participant voice volume** — `sender_id` in UDP fan-out,
  per-sender gain pipeline, volume slider in channel sidebar, persistence
  to `voice_gains.json`. Design in [`voice-volume.md`](docs/voice-volume.md).
- **Proximity voice** — voice zones in hub (WS protocol, in-memory state,
  `manage_voice` permission), client-side attenuation (4 models), game SDK
  calls (`voxply:createVoiceZone`, `voxply:setVoicePosition`). Design in
  [`proximity-voice.md`](docs/proximity-voice.md).
- **Gaming Tier 2 client SDK** — `voxply:game:ready/start/send/end/
  snapshot/sharedKvGet|Set/setJoinPolicy` postMessage calls, incoming
  event delivery to iframe, Activities live-session badge, session
  create/join/leave Tauri commands. Full Tier 2 now complete.

## ⚠️ Known issues

- **Group DMs are plaintext** — hub operator can read group DM content; 1:1 DMs are E2E encrypted. Warning shown before entering group DMs. E2E group DMs (sender-key scheme) are in the wishlist.
- **Windows installer unsigned** — users see SmartScreen "Windows protected your PC" warning; workaround: "More info → Run anyway". Permanent fix once EV cert is procured (see code-signing.md).

## 💤 Won't do

- **Load-aware DM routing across a user's hubs** — failover only; load-balancing needs gossip + cross-hub consistency. See [decisions.md](docs/decisions.md)
- **Concurrent mic test while in voice** — two cpal input streams unreliable cross-platform; live meter covers it
