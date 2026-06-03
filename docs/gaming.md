# Gaming

Voxply's "gaming" pillar is a **distribution + runtime platform**, not
a set of games we ship. Game authors publish games, hub admins install
them, users play them inside the hub UI. The platform is what we build —
a runtime that hub admins use to bring games into their community.

## Tiers

Three tiers, simplest first. Tier 1 is the only one shipping today.

### Tier 1 — flash-style

Small single-player or turn-based HTML5 games embedded in a sandbox.
Low-risk surface; no multiplayer machinery. Good for casual hub use.

- Currently per-hub installation
- Iframe sandbox
- Today's reference game: dice game
  (`desktop/public/demo-games/dice.html` in Voxply-desktop)

**Authoring a Tier 1 game** — see
[the manifest reference and SDK below](#authoring-a-tier-1-game).

### Tier 2 — party multiplayer

Small-group multiplayer (≤20) over the existing hub WebSocket. Party-
game and social-deduction shape. State lives on the hub for the game's
lifetime.

**Not built.**

### Tier 3 — MMO

Persistent shared game state scoped to one hub or alliance. Much bigger
engineering; real stretch goal. Proximity voice (volume attenuates with
in-game distance) is the voice integration that makes Tier 3 feel real.

**Not built.**

## What the platform provides

When the SDK ships, it will expose:

- **Game bundle format** — manifest + HTML5/WASM entry + assets
- **Sandbox runtime** — iframe first, WASM module host later
- **SDK** — APIs for hub/user context, state sync, voice attenuation,
  per-user / per-hub persistence (see
  [the SDK reference](#the-postmessage-sdk))
- **Game registry** — decided: URL-first with an optional self-submitted
  catalog mirroring hub discovery (see [Game registry](#game-registry))
- **Hub admin UI** — browse installed, install, enable/disable per
  channel, set permissions, uninstall (see
  [Hub admin install experience](#hub-admin-install-experience))
- **User UI** — launch via the Activities button (see below) or a
  dedicated game tab

## Activities button

A dedicated button in the channel toolbar — next to voice/camera
controls — that opens a compact picker showing every game installed on
the hub. Clicking a game opens it in a full modal overlay (keyboard,
mouse, and gamepad all work naturally inside the modal). No chat
command required; no bot needed.

This is the primary launch surface for hub-installed games. It lives at
the channel level rather than a global sidebar so the context is clear:
you're launching a game *here*, for the people in *this channel*. The
modal keeps chat accessible in the background; closing it drops the user
back into the channel.

Two entry points feed into the same modal runtime:

| Source | How it's triggered |
|---|---|
| Activities button | User clicks the toolbar button, picks from the hub game list |
| Bot launch card | Bot message contains a `game` payload; user clicks Play on the card |

Both render the same Tier 1 iframe sandbox. The Activities button path
needs no bots and works today once the UI is wired; the bot launch card
path is deferred to when the bot `game` response field is designed
([bots.md](bots.md) — What's deferred).

## What we explicitly DO NOT build

Games. The platform ships with one or two reference games (chess, dice)
to demo the SDK. Beyond that, every game is third-party.

## Open design questions

Resolved in this doc:

- ~~Game registry — central vs hub-operated~~ → decided:
  [Game registry](#game-registry).

Still open (Tier 2 / Tier 3 territory):

- Iframe-only, or native WASM via the desktop client?
- Game state storage — hub DB, IPFS, author's choice? (Tier 1 answer:
  hub DB for the small per-user KV; see [SDK](#the-postmessage-sdk).)
- Multiplayer protocol — dedicated WS per game instance, or main chat WS?
- Alliance scope — separate instance per hub or shared state across the alliance?

## Games at the farm level

The [farm model](farm-model.md) shipped (phases 1-3 in
[farm-impl.md](farm-impl.md)). Games now belong at the **farm level**,
not per hub. This section is the concrete Tier 1 mapping; the Tier 2/3
machinery (matchmaking, persistent shared state, WS multiplexer) stays
deferred.

**Decision**: a Tier 1 game is installed **once on the farm**, and each
hub on that farm **enables or disables** it. The farm holds the game
record (manifest metadata, the small per-user KV store, the permission
grant); each hub holds only its own enable/disable flag and per-channel
visibility. This is the two-axis rule applied: the catalog and the
per-user KV are personal-/farm-axis state, the enable decision is
community-axis state.

**Alternative considered**: keep games per-hub even on a farm (today's
shape, just N copies). Rejected — it duplicates the manifest, fractures
the per-user KV (a user's saved progress wouldn't follow them between
two hubs on the same farm), and forces a re-install on every hub. The
whole point of the farm layer is one source of truth.

**Alternative considered**: a farm-global "auto-enabled everywhere"
model with no per-hub opt-in. Rejected — a hub admin must stay in
control of what appears in *their* community. Install is a farm
operator action; enable is a hub admin action. Two distinct
permissions, two distinct layers.

What lives where:

| Concern | Where | Repo |
|---|---|---|
| Game manifest / metadata | farm `games` table | Voxply-server `farm/` |
| Game files | author's hosting (unchanged — farm does not proxy) | n/a |
| Per-user-per-game KV | farm `game_kv` table (farm-axis, follows the user) | Voxply-server `farm/` |
| Permission grant (capabilities) | farm `games` row | Voxply-server `farm/` |
| Enable/disable per hub | hub `enabled_games` table | Voxply-server `hub/` |
| Per-channel visibility | hub `channel_games` table | Voxply-server `hub/` |

**Install (farm operator / farm admin)**: `POST /farm/games` with the
same manifest shape as [the manifest](#the-manifest). Routes mirror the
hub install paths but live on the farm. The farm admin identity
(`farms.admin_pubkey`, [farm-impl.md](farm-impl.md) Phase 3) gates
install/uninstall.

**Enable (hub admin)**: a hub admin with `manage_games` calls the hub's
`POST /games/:game_id/enable`, which writes a row in the hub's
`enabled_games` table. The hub fetches the manifest from the farm
(`GET /farm/games/:id`) and caches it. The Activities button on that
hub then lists only enabled games. Disabling is the inverse; it does not
touch the farm record or the per-user KV.

**Per-user KV at the farm**: the [`voxply:kvGet`/`voxply:kvSet`
SDK calls](#5-persistent-per-user-storage-voxplykvget--voxplykvset)
resolve to the farm's `game_kv` store keyed by `(game_id, user_pubkey)`,
**not** scoped to a hub. A user's progress in a game follows them across
every hub on the farm that has the game enabled. This is the concrete
payoff of "one source of truth."

**Pre-farm and un-farmed hubs**: a hub with `farm_url == null`
([farm-impl.md](farm-impl.md) Phase 1) keeps today's per-hub install and
the per-hub KV described in the SDK section. The SDK shape is identical;
only the storage backend differs (hub DB vs farm DB). Games don't know
which they're talking to.

Cross-farm sessions (Tier 2+) follow the same shape as
[federated DMs](federation.md): one **host farm** owns authoritative
state; **joining farms** opt their users in via signed "member in good
standing" tokens. Out of scope for Tier 1.

## Game registry

The open question — central catalog, per-hub list, or both — is decided.

**Decision**: **URL-first installation is the protocol primitive; an
optional self-submitted catalog is a convenience layer on top.** A game
is always installable by pasting a manifest URL (or quick-installing by
entry URL). Separately, the `Voxply-discovery` service grows a
`/games` catalog populated by **author self-submission with a
signed manifest** — the same signed-listing primitive hub discovery and
farm discovery already use ([hub-discovery.md](hub-discovery.md),
[farm-impl.md](farm-impl.md) Section E). The catalog is a place to
*find* games; it is never required to *install* one.

**Alternatives considered**:

- **A central project-hosted catalog as the only install path.**
  Rejected on the same sovereignty grounds as a central hub registry
  (see [decisions.md](decisions.md), hub discovery). A central catalog
  the project gatekeeps would make the project the arbiter of which
  games exist on a federated network — exactly the central authority the
  whole product refuses to have. It also can't be enforced: a hub admin
  can always install by URL, and a fork strips the catalog check.
- **Per-hub list only, no catalog at all** (today's shape, frozen).
  Rejected as the *whole* answer: it works but offers no discovery — an
  admin has to already know a game's URL. The URL primitive stays; the
  catalog is additive on top, not a replacement.
- **A federated registry (DHT / gossip of game manifests).** Rejected —
  same verdict as DHT-based hub discovery: massive complexity for
  marginal gain at current scale. A signed-listing aggregator gets the
  discovery benefit at near-zero protocol cost.

How the two layers compose:

- **Protocol primitive (always works)**: paste a manifest URL or
  quick-install by entry URL. No catalog, no network dependency on the
  project. This is what ships first and what a fork or an air-gapped
  deployment relies on.
- **Catalog (convenience)**: `GET https://discovery.voxply.app/games`
  returns a public, self-submitted, self-signed list of games. The
  admin install dialog can browse it inline ("Browse the catalog") and
  one-click an entry, which resolves to the same manifest-URL install
  path under the hood. The catalog ranks by self-declared `tags` and a
  signed install-count attestation is **deferred** — ranking is
  alphabetical / newest-first until a real anti-gaming design exists
  ([monetization.md](monetization.md) flags paid-placement ranking as
  its own open problem; the free catalog inherits that deferral).

**Catalog ownership is cryptographic, not account-based**: a game
listing is signed by the author's Ed25519 key (the same key shape used
everywhere). No accounts on the catalog. Submitting, updating, and
removing a listing are all signed operations. The discovery service
verifies the signature and re-probes the manifest URL on a schedule;
unreachable or signature-mismatched listings are dropped. This is the
hub/farm listing primitive applied verbatim — see
[farm-impl.md](farm-impl.md) Section E for the exact register /
deregister / revalidate shape to mirror.

**Where it lives**: the catalog endpoints (`POST /games/register`,
`DELETE /games/register`, `GET /games`) are in `Voxply-discovery`, not
in the hub or farm binary. The contract is the boundary; the discovery
repo owns the listing DB, the revalidation cron, and rate limits. The
hub/farm side ships nothing for the catalog beyond the existing
manifest-URL install — the catalog is purely a client-facing browse
surface plus a directory service. **Deferred to the same Voxply-discovery
work as the farm listing extension.**

## How to apply when gaming comes up

The question to ask is "what does the platform need" (SDK, registry,
sandbox), not "what game should we write". Reject scope that drifts into
building games beyond minimal reference demos.

---

## Authoring a Tier 1 game

This section is the practical reference for anyone writing a game or
trying to install one. It covers the manifest format, the install flow,
the iframe sandbox model, and the postMessage SDK.

### The manifest

A game is a JSON file conventionally named `manifest.json`. The
**minimum viable manifest** is two fields:

```json
{
  "name": "My Cool Game",
  "entry_url": "https://example.com/my-cool-game/index.html"
}
```

That's it. The hub fills in everything else: `id` is derived from a
hash of `entry_url` (so the same URL re-installed = upsert, which is
the natural "update this game" behavior), `version` defaults to
`"1.0.0"`. Game authors with no opinions on either don't need to think
about them.

The full schema, with everything optional except `name` and
`entry_url`:

```json
{
  "name": "My Cool Game",
  "entry_url": "https://example.com/my-cool-game/index.html",

  "id": "my-cool-game",
  "version": "1.0.0",
  "description": "Optional one-line description.",
  "thumbnail_url": "https://example.com/my-cool-game/thumb.png",
  "author": "Your Name",
  "min_players": 1,
  "max_players": 1
}
```

| Field | Required | What it is |
|-------|----------|------------|
| `name` | **yes** | Display name in the sidebar and game launcher. |
| `entry_url` | **yes** | The URL the iframe loads. Must start with `http://`, `https://`, `data:`, or `/`. `javascript:`, `file:`, and other schemes are rejected. |
| `id` | no | Stable unique identifier. Defaults to a hash of `entry_url`. Set it explicitly only if you want to keep the same id across hosting moves (entry_url changes). |
| `version` | no | Free-form string, conventionally semver. Defaults to `"1.0.0"`. Purely informational today. |
| `description` | no | One-line description. |
| `thumbnail_url` | no | URL of a thumbnail (currently used in the title hover, future: rendered inline). |
| `author` | no | Free-form attribution. |
| `min_players` | no | Defaults to 1. Used by Tier 2 matchmaking when it ships. |
| `max_players` | no | Defaults to 1. Same. |

### How install works

A hub member with the `manage_games` permission (or `admin`) opens
**Install game** in the games sidebar. There are three install paths:

1. **Quick install** (default) — type a name and the game URL. The hub
   builds a minimal manifest internally, derives the id, and installs.
   No JSON authoring required. Right pick for one-off / personal games.
2. **Manifest URL** (advanced section in the dialog) — paste a URL that
   returns a `manifest.json`. The hub fetches it, validates, and stores
   the metadata. Right pick for games an author has properly published.
3. **Inline manifest** via the Tauri command directly — used by the
   bundled demo dice game (its `entry_url` points at
   `/demo-games/dice.html` shipped inside the desktop client).

A fourth path joins these once the catalog ships: **Browse the catalog**
resolves a selected entry to its manifest URL and runs path 2 under the
hood (see [Game registry](#game-registry)).

Once installed, the game shows up in the sidebar **for every member of
that hub** and clicking it opens the iframe in the main panel.

The hub does **not proxy** the game. It only stores the manifest. The
iframe loads `entry_url` directly from the user's machine, so the
author's hosting (CDN, S3, GitHub Pages, etc.) is what serves the game.

### Hub admin install experience

The three install paths above are the *entry* to a small admin surface.
The full Tier 1 admin experience — a **Games** tab in Hub Settings
(`Voxply-desktop`, mirrored in `Voxply-web` / `Voxply-android`), gated by
`manage_games` — covers four jobs:

1. **Browse installed games.** A list of every game installed on the
   hub: name, thumbnail, author, version, who installed it and when, and
   its current per-channel availability and granted capabilities. This
   is the admin's inventory view, distinct from the player-facing
   Activities picker.
2. **Install / update / uninstall.** The dialog above, plus the catalog
   browse path. Update is an upsert at the same `entry_url`/`id` (see
   [Updating a game](#updating-a-game)). Uninstall deletes the manifest
   row and any capability grants; the hosted game is unaffected.
3. **Enable / disable per channel.** A game can be available in **all
   channels** (default) or **a chosen subset**. Storage: a hub
   `channel_games(game_id, channel_id)` table — empty set means "all
   channels," any rows mean "only these." The Activities button reads
   this: a game restricted to `#gaming` does not appear in the picker in
   `#general`. This keeps the channel-as-place model intact — the games
   you can launch *here* depend on *here*.
4. **Set per-game permissions.** The capability grant UI, below.

Wire contract for the hub side (Voxply-server `hub/`):

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/games` | member | List games visible to the caller (player view: enabled + channel-scoped). |
| GET | `/admin/games` | `manage_games` | Full inventory incl. capabilities and channel scope. |
| POST | `/admin/games` | `manage_games` | Install (quick / manifest URL / inline). |
| DELETE | `/admin/games/:id` | `manage_games` | Uninstall. |
| PUT | `/admin/games/:id/channels` | `manage_games` | Set the channel-scope set (empty = all). |
| PUT | `/admin/games/:id/permissions` | `manage_games` | Set the capability grant (see below). |

The player-facing `GET /games` already exists in spirit (it backs the
sidebar today); `admin/games/*` is the new admin surface.

### Game permissions model

**Decision**: every Tier 1 game starts with the **minimal sandbox**
(read-only context: who am I, where am I, theme, KV scoped to itself).
A hub admin may *grant* a game extra **capabilities** beyond that
baseline. Capabilities are opt-in per game per hub, never default-on,
and the player sees what's granted before they launch.

**Alternative considered**: a fixed sandbox with no capability system —
every game is read-only forever, "post a message" and "read history"
simply don't exist in Tier 1. Rejected: the most-requested real games
(a trivia bot that posts the question, a poll game that announces
results) need *some* write surface, and shoving them to Tier 2 just
because they post one message is the wrong cut line. A scoped,
admin-granted capability is the right middle.

**Alternative considered**: author-declared required capabilities in the
manifest that auto-grant on install. Rejected — that lets an author
escalate by editing their own manifest. The admin must grant; the
manifest may *request* (advisory only), the admin decides.

The Tier 1 capability set (small and closed — no free-form capabilities):

| Capability | What it unlocks | Default |
|---|---|---|
| `post_message` | The game may post a chat message in the launching channel **as the launching user**, via `voxply:postMessage`. Rate-limited; subject to the same permission checks as the user typing it. | off |
| `read_channel_history` | The game may read recent messages in the launching channel via `voxply:getRecentMessages`, scoped to what the launching user can already see. | off |
| `list_channel_users` | The game may read the online-user list for the launching channel via `voxply:getChannelUsers`. | off |

A game with no grants is the today's read-only sandbox — `voxply:getUser`
and theme only. The three capabilities map one-to-one to the three
write/read-extending SDK calls below; an SDK call backed by an ungranted
capability returns `{ type: "voxply:error", code: "permission_denied" }`
rather than silently failing.

**Scoping rules (all enforced hub-side, never client-trusted):**

- A capability never lets the game exceed the *launching user's* own
  permissions. `post_message` posts as the user and is rejected if the
  user couldn't post there anyway (muted, no `send_messages`, etc.).
  `read_channel_history` returns only what the user can see.
- Capabilities are scoped to the **launching channel and the launching
  user's session**. A game can't post to a channel the user didn't
  launch it in, and can't act after the modal closes.
- Grants are per-hub. The same game on two hubs (or two farms) carries
  independent grants.

**How it's presented to the user**: when a player opens a game that has
any capability granted, the launch modal shows a one-line consent strip
before the game renders — e.g. *"This game can post messages as you in
#gaming and read recent messages here."* Read-only games (no grants)
show nothing; the common case stays frictionless. The strip is
informational, not a per-launch prompt the user must accept every time —
the admin's grant is the authorization; the strip is disclosure. A
"Don't show again for this game" affordance collapses it to a small
shield icon on subsequent launches.

**Storage**: the grant is a bitset/JSON column on the hub's game row
(`game_permissions`), set via `PUT /admin/games/:id/permissions`. On the
farm-level model it lives on the farm `games` row so the grant is
consistent across hubs that enable the game — though the *enable*
decision and any per-hub *tightening* stay hub-side. (Open nuance: a
hub may want to enable a game but decline a capability the farm granted.
Tier 1 rule: the hub grant is the floor-AND — effective capability =
farm grant ∩ hub grant. Deferred refinement: per-hub *expansion* beyond
the farm grant.)

### Iframe sandbox model

The game runs in a Tauri webview iframe that's sandboxed. Practical
implications for game authors:

- **No access to the parent's DOM**, cookies, or storage. Cross-origin
  isolation is enforced by the browser.
- **The game can use its own `localStorage`/`sessionStorage`** scoped
  to the `entry_url`'s origin.
- **Same-origin XHR/fetch** is fine. CORS rules apply for anything
  else.
- **No native APIs**: no filesystem, no microphone, no Tauri commands.
  If you need any of that, you need a proper integration (not a Tier
  1 game).

### The postMessage SDK

The parent client sets up a `message` listener on the iframe. Today
the SDK is intentionally tiny — just one call.

**Get the current user**:

```js
window.parent.postMessage({ type: "voxply:getUser" }, "*");

// Reply arrives as:
window.addEventListener("message", (e) => {
  if (e.data?.type === "voxply:user") {
    const user = e.data.data;
    // user = { public_key: "...", display_name: "...", avatar: ... }
  }
});
```

**Theme**: the parent appends `?theme=<calm|classic|linear|light>` to
the iframe `src`. Read it from `location.search` and apply your own
theming — your CSS can't read the parent's CSS variables across the
iframe boundary. The dice game has a working pattern.

### SDK calls — Tier 1

The SDK is a request/reply `postMessage` protocol. The game posts
`{ type: "voxply:<verb>", reqId?, ... }` to `window.parent`; the parent
replies with `{ type: "voxply:<result>", reqId?, data | error }`. A
`reqId` echo lets the game correlate concurrent calls (optional but
recommended). Every call that an ungranted capability backs returns
`{ type: "voxply:error", code: "permission_denied", reqId }`.

The Tier 1 surface is six calls. The first two are baseline (no
capability needed); the next three are capability-gated (see
[Game permissions model](#game-permissions-model)); the last is the
persistent KV store.

**Decision on what Tier 1 exposes**: read-context + a small scoped
write surface + per-user KV. Voice attenuation, real-time presence
events, and any multi-client state sync are explicitly Tier 2/3 and are
*not* in this SDK. The cut line is "does it need server-coordinated
shared state or the voice relay" — if yes, it's not Tier 1.

#### 1. Hub & channel context — `voxply:getContext`

Baseline (no capability). Returns where the game is running so it can
title itself, pick a theme accent, or seed a per-channel leaderboard
key. Does **not** include the user list (that's a separate, gated call).

```js
window.parent.postMessage({ type: "voxply:getContext", reqId: 1 }, "*");
// → { type: "voxply:context", reqId: 1, data: {
//      hub: { id, name, icon_url },
//      channel: { id, name },
//      farm: { url } | null   // null on un-farmed hubs
//    } }
```

`farm` is `null` on a hub with `farm_url == null` — a game can use its
presence to decide whether KV will follow the user across hubs.

#### 2. Get the current user — `voxply:getUser`

Baseline. The existing call (above), unchanged. Returns
`{ public_key, display_name, avatar }`.

#### 3. List channel users — `voxply:getChannelUsers`

Requires `list_channel_users`. Returns the users currently present in
the launching channel — enough for "pick an opponent" or showing who's
around for a party game without Tier 2 machinery.

```js
window.parent.postMessage({ type: "voxply:getChannelUsers", reqId: 2 }, "*");
// → { type: "voxply:channelUsers", reqId: 2, data: {
//      users: [ { public_key, display_name, online: true } ]
//    } }
```

Snapshot only — Tier 1 does **not** push presence-change events to the
game. Live presence (join/leave events to the iframe) is Tier 2; a game
that wants fresh data re-requests.

#### 4. Post a message — `voxply:postMessage`

Requires `post_message`. Posts a chat message **as the launching user**
in the launching channel. The hub applies the same permission checks as
a user typing it (mute, `send_messages`, rate limit). A trivia game
announcing a question, a dice game posting its roll to chat.

```js
window.parent.postMessage({
  type: "voxply:postMessage", reqId: 3,
  text: "🎲 rolled a 6!"
}, "*");
// → { type: "voxply:posted", reqId: 3, data: { message_id } }
//   | { type: "voxply:error", reqId: 3, code: "permission_denied" | "rate_limited" }
```

The message is authored by the user, not by a synthetic "game" identity
(Tier 1 has no bot identity — that's [bots.md](bots.md)). The client may
prefix or badge game-posted messages so readers can tell. Posting is
text-only in Tier 1; no embeds, no attachments.

#### 5. Read recent messages — `voxply:getRecentMessages`

Requires `read_channel_history`. Returns a bounded window of recent
messages in the launching channel, scoped to what the launching user can
already see. For a game that reacts to chat (a word game reading
guesses, a quiz scoring answers typed in chat).

```js
window.parent.postMessage({
  type: "voxply:getRecentMessages", reqId: 4, limit: 50
}, "*");
// → { type: "voxply:recentMessages", reqId: 4, data: {
//      messages: [ { id, author_pubkey, author_display, text, ts } ]
//    } }
```

`limit` is capped hub-side (e.g. 100). Snapshot only — no live message
stream to the iframe in Tier 1.

#### 6. Persistent per-user storage — `voxply:kvGet` / `voxply:kvSet`

Baseline (no capability — a game can always persist *its own* state for
*its own* player). A tiny key/value store scoped to
`(game_id, user_pubkey)`, persisted server-side so it follows the user
across devices and (on a farm) across hubs. This closes the "state that
follows a user" gap the doc currently lists under
[What doesn't work yet](#what-doesnt-work-yet).

```js
window.parent.postMessage({
  type: "voxply:kvSet", reqId: 5, key: "highscore", value: 4200
}, "*");
// → { type: "voxply:kvOk", reqId: 5 }

window.parent.postMessage({ type: "voxply:kvGet", reqId: 6, key: "highscore" }, "*");
// → { type: "voxply:kvValue", reqId: 6, data: { key, value: 4200 } }
//   | { type: "voxply:kvValue", reqId: 6, data: { key, value: null } }  // unset
```

Scope and limits:

- Keyed by `(game_id, user_pubkey)`. A game cannot read another game's
  KV or another user's KV. There is **no** shared/global KV in Tier 1 —
  a shared leaderboard across players is coordinated state and is Tier 2.
- Values are small JSON (cap ~8 KB per key, ~64 keys per game-user). The
  store is for save-state and prefs, not a database. Over-limit writes
  return `{ type: "voxply:error", code: "quota_exceeded" }`.
- **Where it persists**: on an un-farmed hub, the hub DB (per-hub —
  progress does *not* cross to other hubs). On a farm, the farm
  `game_kv` table (farm-axis — progress follows the user across every
  hub on the farm with the game enabled). The SDK shape is identical;
  the game doesn't know or care which backs it. See
  [Games at the farm level](#games-at-the-farm-level).

This KV is **personal-/farm-axis** state, not community-axis: it lives
with the user, not with the community. That placement is deliberate and
matches the two-axis rule — a per-user highscore is the user's, not the
hub's.

### SDK calls — what's NOT in Tier 1

Spelled out so authors don't build against vapor:

- **Live events to the iframe** (message arrived, user joined, theme
  changed). Tier 1 is request/reply only; the game polls.
- **Voice attenuation / proximity voice.** Tier 3.
- **Shared / multi-client state sync.** Tier 2 — needs the hub WS
  multiplexer.
- **A synthetic game/bot identity** that posts on its own behalf.
  `voxply:postMessage` posts as the *user*. A game acting as an
  independent author is the [bot](bots.md) design space.
- **Native APIs** (filesystem, mic, Tauri commands). Hard-blocked by the
  iframe sandbox; see [Iframe sandbox model](#iframe-sandbox-model).

### Minimal complete example

A "hello, $username" game in one HTML file:

```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Hello</title></head>
<body>
  <h1 id="greeting">Hello!</h1>
  <script>
    const themeParam = new URLSearchParams(location.search).get("theme");
    if (themeParam) document.documentElement.dataset.theme = themeParam;

    const onUser = (e) => {
      if (e.data?.type !== "voxply:user") return;
      document.getElementById("greeting").textContent =
        `Hello, ${e.data.data.display_name || "player"}!`;
    };
    window.addEventListener("message", onUser);
    window.parent.postMessage({ type: "voxply:getUser" }, "*");
  </script>
</body>
</html>
```

Host this file at, say, `https://yoursite.example/hello/index.html`.
Then create a manifest at `https://yoursite.example/hello/manifest.json`:

```json
{
  "id": "hello-game",
  "name": "Hello",
  "version": "1.0.0",
  "entry_url": "https://yoursite.example/hello/index.html",
  "description": "Says hi to whoever is playing."
}
```

Hub admin pastes the manifest URL → game appears in everyone's sidebar.

### Updating a game

Re-install at the same `entry_url` (or with the same explicit `id`).
The hub does an upsert: name / description / version / entry_url all
replace; install metadata (who installed it, when) is preserved.

### Uninstalling

Hub admin clicks **Uninstall** on the game in the sidebar. The
manifest row is deleted. The hosted game itself is unaffected — the
hub only forgot about it.

### What's currently shipped vs designed

**Shipped today**: per-hub install (quick / manifest URL / inline), the
iframe sandbox, the manifest format, the Activities button entry, and
the single `voxply:getUser` SDK call.

**Designed in this doc, not yet built**: the catalog browse path, the
Hub Settings → Games admin surface (channel scope, capability grants),
the five additional SDK calls (`getContext`, `getChannelUsers`,
`postMessage`, `getRecentMessages`, `kvGet`/`kvSet`), the capability /
permissions model, and the farm-level install + per-hub enable mapping.
These are the Tier 1 platform; a backend/frontend engineer implements
against the wire contracts above.

## What's deferred to Tier 2

The clean line between Tier 1 (this doc) and Tier 2 is **shared,
server-coordinated, multi-client state**. Everything Tier 1 exposes is
either read-only context, a per-user store, or a write that acts as the
launching user — none of it requires a game instance the hub manages
across multiple connected clients. The moment a feature needs that, it
is Tier 2:

- **Multiplayer game instances** — a shared session ≤20 players over the
  hub WebSocket, state living on the hub for the game's lifetime. The
  WS multiplexer, matchmaking, and instance lifecycle are all Tier 2.
- **Live events pushed to the iframe** — message-arrived, user-joined,
  game-state-changed events delivered to the running game instead of the
  game polling. Tier 1 is request/reply only.
- **Shared / global KV** — a leaderboard or shared world all players read
  and write. Tier 1's KV is strictly per-user. Shared state needs the
  conflict and authority story Tier 2 owns.
- **A synthetic game identity** that posts and acts on its own behalf
  (not as the launching user). Overlaps the [bot](bots.md) design space;
  not Tier 1.
- **Cross-farm sessions** — host-farm-authoritative state with joining
  farms opting users in via signed tokens, mirroring federated DMs.
  Tier 2+.
- **Matchmaking / `min_players`/`max_players` enforcement** — the
  manifest carries the fields today (informational); the matchmaker that
  uses them is Tier 2.

And to Tier 3:

- **Proximity voice** — volume attenuating with in-game distance. Needs
  voice-relay integration; the SDK has no voice surface in Tier 1 or 2.
- **Persistent shared world (MMO)** — durable shared state scoped to a
  hub or alliance.

### Still deferred even within Tier 1

- **Catalog ranking by install count / quality** — alphabetical /
  newest-first until a signed install-attestation and anti-gaming design
  exist (shares the deferral with [monetization.md](monetization.md)
  paid-placement ranking).
- **Per-hub capability *expansion* beyond a farm grant** — Tier 1 rule
  is effective = farm grant ∩ hub grant; letting a hub grant *more* than
  the farm did is a later refinement.
- **Embeds / attachments in `voxply:postMessage`** — text-only for now.
- **Native WASM module host** — iframe-only sandbox in Tier 1; a
  WASM-module runtime is a separate open question.

---

## Tier 2 — party multiplayer (design)

This section is the full design for small-group multiplayer (≤20
players). It fulfils the boundary the
[What's deferred to Tier 2](#whats-deferred-to-tier-2) list above draws:
shared, server-coordinated, multi-client state. It builds directly on
the Tier 1 platform — same bundle format, same iframe sandbox, same
Activities-button launch surface, same admin Games tab and capability
model, same `reqId` postMessage SDK. Tier 2 adds a **session** (a live
game instance with a roster) and a **relay** (the hub passing game
events between players). Nothing about Tier 1 changes; a Tier 1 game is
a Tier 2 game that never opens a session.

> Status: **SHIPPED** (server-side). Session lifecycle, WS relay, host
> promotion, snapshot durability, shared KV, session reaper, and 7
> integration tests all landed in `hub/`. Client SDK postMessage
> additions (voxply:game:* calls) and the Activities-button live-session
> badge are the remaining client-side work.

### Decision 1 — multiplayer protocol: piggyback the chat WS with a `game_*` envelope family

**Decision**: Tier 2 game traffic rides the existing per-hub chat
WebSocket (`hub/src/routes/ws.rs` in Voxply-server) as a small family of
new envelope variants (`game_*`), not a dedicated socket per game
instance. The client already holds one authenticated WS to each hub;
game events carry a `session_id` and are demultiplexed client-side to
the right game iframe. This is also what unblocks the "live events
pushed to the iframe" item in the deferred list — the same WS that
relays moves delivers join/leave/state events the game subscribes to.

**Alternative considered**: a dedicated WebSocket per game instance —
opened when a player joins a session, closed when they leave. Cleaner
isolation (game traffic never touches chat code); a game author could
in principle be handed a raw socket URL.

**Tradeoff that decided it**: a dedicated socket means a second auth
handshake per session (re-verifying identity and channel membership on a
connection carrying none of the existing session state), a second
connection to keep alive across sleep/wake and network changes, and a
second reconnect/backoff path — all to carry a few KB/s of party-game
state. The chat WS already solves auth, membership, presence, reconnect,
and per-channel broadcast; Tier 2 needs every one, and a parallel socket
re-pays for all of them. The mixing concern (game events interleaved
with chat events) is a client-side demultiplex problem, not a transport
problem: a `match envelope.type` routes `game_*` to a session registry
and everything else to the existing chat handler. This is the same call
the screen-share decision made ([decisions.md](decisions.md) — "Screen
share v1: hub-relayed WS chunks") — reuse the typed envelope channel,
migrate to a dedicated transport only if a real ceiling bites. Party
games at ≤20 players sending discrete moves will not approach that
ceiling; an MMO (Tier 3) might, which is where a dedicated multiplexer
is already pencilled in (the [farm-level note](#games-at-the-farm-level)
and *What's deferred to Tier 3*).

### Decision 2 — game state storage: in-memory on the hub, opt-in snapshot to DB

**Decision**: authoritative session state lives **in memory on the
hub** for the session's lifetime, in a `state.game_sessions` map keyed
by `session_id` — the same runtime-state shape as `state.voice_channels`
([decisions.md](decisions.md) — "Channels are unified text + voice"). A
game author *may* opt into durability by returning a serializable
snapshot blob via `voxply:game:snapshot`; the hub persists the latest
snapshot to a single `game_sessions` DB row so a hub restart mid-match
can offer players a resume. Without that opt-in a restart ends the
session (players notified, modal closes) — the right default for a
10–30 minute party game.

**Alternatives considered**:

- **Hub DB as the authoritative store (write every move).** Rejected as
  the default: a social-deduction round generates many small state
  transitions a minute; round-tripping each through SQLite's
  single-writer model ([decisions.md](decisions.md) — "SQLite, not
  Postgres") puts game-tick latency on the same writer serving chat, and
  abandoned matches leave rows to garbage-collect. Party-game state is
  ephemeral; durability is the exception.
- **In-memory only, no durability path.** Rejected as too rigid: a long
  social-deduction match losing everything to a restart is a bad
  experience and some authors will want persistence. The opt-in snapshot
  gives them an escape hatch without taxing games that don't need it.
- **Author's choice via an SDK persistence callback with no hub
  default.** Rejected: it forces a storage decision onto every author
  before they've written game logic, and most party-game authors have no
  opinion. A sensible default with an opt-in upgrade is the Tier 1
  manifest philosophy applied to state.

**Two-axis placement**: session state is **community-axis** — it lives
on the community hub owning the launch channel, like channel messages
and voice. This is distinct from the Tier 1 per-user KV
(`voxply:kvGet`/`kvSet`), which is **personal-/farm-axis** (the user's
highscore follows the user). Tier 2 introduces the **shared KV** the
Tier 1 KV section explicitly defers — a leaderboard or shared world all
players read and write. Shared KV is community-axis too: it is scoped to
`(game_id, channel_id)` and lives with the session's hub, not with any
user. We flag this so Tier 3's persistent per-user progression doesn't
accidentally write personal-axis data onto a community hub — that stays
on the home hub list ([home-hub.md](home-hub.md)).

### Session lifecycle

A **session** is one live instance of one installed game, bound to one
channel, with a roster and a host. States: `lobby` → `in_progress` →
`ended`, plus terminal `abandoned`.

1. **Create.** A member who can see the channel and holds the new
   `start_game` permission picks a game from the Activities button and
   clicks Start. The client calls `POST /games/:game_id/sessions` with
   the channel id. The hub checks the game is enabled in that channel
   (the Tier 1 `channel_games` scope), creates the in-memory session,
   marks the creator **host**, and broadcasts `game_session_created` to
   the channel so members see a join card. The host's iframe opens in
   the modal in `lobby` state.
2. **Join.** A member clicks Join on the card (or via the Activities
   button, which shows a "live session" badge). The client calls
   `POST /games/sessions/:id/join`; the hub adds the player to the
   roster (rejecting if full per `max_players`, or if the session no
   longer accepts joins per the game's join policy), broadcasts
   `game_player_joined`, and opens the joiner's iframe.
3. **In progress.** The host's game (or any player's — the game decides)
   calls `voxply:game:start` to flip to `in_progress`. Players exchange
   moves: a game posts via `voxply:game:send`, the hub relays to the
   roster as `game_event`. The hub does **not** interpret payloads — it
   is a typed relay (same posture as the screen-share chunk relay). Turn
   ownership, move validity, and win conditions live in the iframe.
4. **Host disconnect.** Not the end of the session. On host WS drop the
   hub starts a grace timer (default 60s). If the host returns, they
   resume. If not, the hub **promotes** the next player in join order
   (broadcasting `game_host_changed`) and play continues. A session ends
   on host loss only if the host was the last player.
5. **End.** A session ends when (a) the game calls `voxply:game:end`
   (normal completion — hub broadcasts `game_session_ended` with an
   optional result blob the game supplies, e.g. final scores for a
   results card), or (b) the roster empties (last player leaves or
   times out past grace — terminal `abandoned`).
6. **Cleanup.** On `ended`/`abandoned` the hub drops the in-memory
   session, deletes any snapshot row, and removes the `session_id` from
   each connected client's registry. A reaper sweeps sessions idle past
   a hub-configurable TTL (default 2 hours) to catch games that never
   call `end`.

### Data model

**In-memory (`hub/src/state.rs` in Voxply-server)** — a
`game_sessions: DashMap<SessionId, GameSession>`:

```
GameSession {
  session_id, game_id, channel_id,
  host_pubkey, status: Lobby | InProgress | Ended | Abandoned,
  players: Vec<{ pubkey, display_name, joined_at, connected: bool }>,
  max_players, created_at, last_event_at,
  snapshot: Option<Bytes>,   // latest author-supplied blob, if opted in
}
```

Runtime state, not a schema property — gone on restart unless a snapshot
was taken.

**DB (`hub/src/db/migrations.rs` in Voxply-server)** — one new table,
written only on snapshot opt-in, plus the shared KV deferred from Tier 1:

```
game_sessions(
  session_id  TEXT PRIMARY KEY, game_id TEXT, channel_id TEXT,
  host_pubkey TEXT, status TEXT,
  snapshot    BLOB,            -- author-supplied, opaque to the hub
  updated_at  INTEGER )

game_shared_kv(
  game_id TEXT, channel_id TEXT, key TEXT, value TEXT,
  updated_at INTEGER,
  PRIMARY KEY (game_id, channel_id, key) )   -- community-axis leaderboard/shared world
```

No per-player or per-move table — the roster lives in memory; if
durability needs it, it goes in the snapshot blob (author owns its
shape). Tier 1 manifest tables are unchanged; `min_players` /
`max_players` (already in the schema) are now read.

### Hub routes (Voxply-server, `hub/src/routes/games.rs`)

| Method | Route | Auth | What |
|---|---|---|---|
| POST | `/games/:game_id/sessions` | `start_game` + game enabled in channel | Create a session; returns `session_id` |
| GET | `/games/sessions?channel_id=` | member | List live sessions in a channel (Activities badges) |
| POST | `/games/sessions/:id/join` | member | Join the roster |
| POST | `/games/sessions/:id/leave` | member | Leave (host loss triggers promotion/grace) |
| GET | `/games/sessions/:id` | roster member | Fetch session + latest snapshot (resume after restart) |
| DELETE | `/games/sessions/:id` | host or `manage_games` | Force-end |

Move/event traffic does **not** use HTTP — it flows over the WS
envelopes below. These routes are session *management*; the WS is the
relay.

**New WS envelopes** (`hub/src/routes/chat_models.rs` in Voxply-server,
alongside the existing chat and screen-share variants):

- Hub → client: `game_session_created`, `game_player_joined`,
  `game_player_left`, `game_host_changed`, `game_event` (opaque payload
  + `from_pubkey` + `session_id`), `game_session_ended`.
- Client → hub: `game_send` (relay a move), `game_set_status`
  (lobby→in_progress, gated to host/policy), `game_snapshot` (durability
  opt-in), `game_end`.

The hub validates envelope shape, the sender's roster membership, and
(for status changes) host authority — then relays. It never parses the
payload.

### SDK additions for Tier 2

Tier 2 extends the `reqId` postMessage SDK. The parent client owns the
WS; the iframe talks only to the parent via `postMessage`, and the
parent translates to/from `game_*` envelopes — the same isolation
boundary the Tier 1 capability calls already cross. Multiplayer requires
the new **`multiplayer`** capability (admin-granted per game per hub,
same model as the Tier 1 capabilities); a game without it cannot open or
join a session.

Calls the game sends to the parent (`window.parent.postMessage`):

| Call | Purpose |
|---|---|
| `voxply:game:ready` | Iframe loaded; parent replies with the initial `voxply:game:state` (roster, your role host/player, status) |
| `voxply:game:start` | Flip lobby → in_progress (host / policy gated) |
| `voxply:game:send` `{ payload, to? }` | Broadcast a move to the roster, or `to` a single pubkey for private deals (hub still only relays) |
| `voxply:game:snapshot` `{ blob }` | Opt into durability; parent forwards `game_snapshot` |
| `voxply:game:sharedKvGet` / `sharedKvSet` `{ key, value? }` | Read/write the community-axis shared KV (leaderboard/shared world) |
| `voxply:game:end` `{ result? }` | Normal completion; parent forwards `game_end`, hub broadcasts the results card |
| `voxply:game:setJoinPolicy` `{ join_during_play: bool }` | Late-join allowed once `in_progress`? (deduction usually false; co-op true) |

Events the parent delivers to the game (`window.addEventListener`) —
this is the live-event push Tier 1 lacks:

| Event | When |
|---|---|
| `voxply:game:state` | Initial snapshot after `ready`, and on resume |
| `voxply:game:event` `{ from, payload }` | Another player's move arrived |
| `voxply:game:playerJoined` / `playerLeft` `{ pubkey, display_name }` | Roster change |
| `voxply:game:youAreHost` | This client was promoted to host |
| `voxply:game:ended` `{ reason }` | Session ended (normal / abandoned / host-lost / hub-restart) |

`voxply:getUser`, the theme convention, and the Tier 1 capability calls
are unchanged and compose with the above — a multiplayer game also
holding `post_message` can relay moves *and* announce a result to the
channel.

### How Tier 2 connects to the Activities button and bot launch card

Both Tier 1 launch surfaces feed the **same** modal runtime; Tier 2 adds
session awareness, not a new surface.

- **Activities button** (Tier 1 design, channel toolbar). For a
  multiplayer game (`max_players > 1`), the picker shows a live-session
  badge if `GET /games/sessions?channel_id=` returns one. Picking the
  game either **starts** a session (none live, user has `start_game`) or
  **joins** the live one. The modal opens the iframe and the SDK
  handshake begins. The full-modal / chat-in-background / gamepad model
  and the per-channel `channel_games` scoping from Tier 1 are unchanged.
- **Bot launch card** ([bots.md](bots.md) — *What's deferred →
  Bot-launched games*). That entry already anticipates Tier 2 and names
  the missing piece: a "multiplayer-state bridge (game posts moves to the
  bot via postMessage; bot relays over WS so other channel members see
  the same state)." Tier 2 **supplies that bridge directly** — the game
  relays through the hub's `game_*` envelopes, not through the bot. When
  the bot `BotResponse.game` field ships, clicking Play calls the same
  `POST /games/:game_id/sessions` path as the Activities button. The bot
  is a launch trigger, not part of the multiplayer data path. (The bots
  doc can drop its placeholder "needs a multiplayer-state bridge" caveat
  once this lands — the bridge is here.)

### Decision 3 — alliance scope: hub-local for v1

**Decision**: a Tier 2 session is **hub-local** in v1. It lives on the
hub owning the channel; only that hub's members (visible in that
channel) can join. A session does not span an alliance even when the
channel is an alliance shared channel. This matches the existing Tier 1
deferral "Cross-farm sessions — host-farm-authoritative state with
joining farms opting users in via signed tokens" — that work stays
deferred; Tier 2 v1 does not attempt it.

**Alternative considered**: alliance-wide sessions — a game in an
alliance shared channel admits players from every hub in the alliance,
one hub holding authoritative state and the others relaying their
players' moves to it (the **host-farm / joining-farm** shape from
federated DMs and the [farm-level note](#games-at-the-farm-level)).

**Tradeoff that decided it**: the host/joining relay is a real
federation protocol — signed cross-hub move forwarding, a "member in
good standing" token per joining player, presence reconciliation when a
joining hub drops, and a failover story for the authoritative hub
mid-match. That is Tier 3-grade coordination for a party game, and it is
exactly the cross-farm shape the farm-level note says games should adopt
*once the farm model lands*. Building it on bare hub federation now would
either duplicate that work or pre-commit the protocol before the farm
layer exists to host it. Hub-local v1 ships the whole party-game
experience for the common case (one community playing together) at zero
federation cost, and the authoritative-hub seam (session state is
already owned by one hub) is the exact extension point alliance scope
plugs into later.

### What's deferred to Tier 3

- **Alliance / cross-hub sessions** — the host-hub-authoritative +
  joining-hub relay protocol above, aligned with the farm-level games
  destination ([farm-model.md](farm-model.md)).
- **Persistent shared world state** — Tier 2 shared state is per-session
  (snapshot is a restart cushion; shared KV is per-channel-game, not a
  world). A durable world scoped to a hub or alliance is the defining
  Tier 3 property.
- **Per-user progression / cross-hub game profiles** — ranks,
  inventories that follow a player across sessions and hubs. This is
  *personal-axis* and belongs on the home hub list
  ([home-hub.md](home-hub.md)), not a community hub — kept out of Tier 2
  to avoid writing personal state onto a community hub. (Tier 1's
  per-user KV already covers a *single-player* save that follows the
  user; Tier 3's progression is the multiplayer-history extension.)
- **Proximity voice** — volume attenuating with in-game distance. Tier 2
  sessions use normal channel voice unchanged.
- **Matchmaking pool** — Tier 2 join is "see a live session in this
  channel and join it." A farm-wide pool across channels/hubs is
  farm-level.
- **A dedicated game transport** — if telemetry shows the chat WS
  saturating on game traffic, the dedicated-socket / WS-multiplexer
  rejected in Decision 1 is the documented escape hatch; it is the same
  multiplexer the farm-level note reserves for Tier 2-at-scale.
- **Authoritative server-side game logic** — the v1 hub is a pure relay;
  the game arbitrates rules in the iframe. Server-side rule validation
  (anti-cheat) is a per-game concern Tier 2 deliberately does not build
  (a party game among a known community is low-stakes).
