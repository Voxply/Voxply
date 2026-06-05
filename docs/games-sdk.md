# Games SDK Reference

Quick reference for third-party game developers building on the Voxply
platform. For design rationale, the permission model, and the registry, see
[gaming.md](gaming.md).

---

## What Tier 1 provides

Tier 1 games are **HTML5 pages** loaded in a sandboxed iframe. The game
communicates with the Voxply client via `window.parent.postMessage`. No
build tools, no SDK package — just standard web APIs plus the six calls
documented here.

All calls are **request/reply**: the game posts a request object and listens
for a matching reply. Use `reqId` (any value you choose) to correlate
concurrent calls.

```js
// Request shape
window.parent.postMessage({ type: "voxply:<verb>", reqId: 1, ...args }, "*");

// Reply shape
window.addEventListener("message", (e) => {
  if (e.data?.reqId === 1) {
    const { type, data, code } = e.data;
    // type is "voxply:<result>" on success, "voxply:error" on failure
  }
});
```

---

## The manifest

A game is installed by URL. The minimum `manifest.json` is two fields:

```json
{
  "name": "My Game",
  "entry_url": "https://example.com/my-game/index.html"
}
```

Full manifest schema (all fields except `name` and `entry_url` are optional):

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | — | **Required.** Display name. |
| `entry_url` | string | — | **Required.** URL the iframe loads. `https://`, `http://`, `data:`, or `/` only. |
| `id` | string | hash of `entry_url` | Stable identifier. Set explicitly only to preserve the id across URL changes. |
| `version` | string | `"1.0.0"` | Free-form; purely informational. |
| `description` | string | `""` | One-line description shown in the game browser. |
| `thumbnail_url` | string | `""` | URL of a thumbnail image. |
| `author` | string | `""` | Attribution string. |
| `min_players` | number | `1` | Used by future Tier 2 matchmaking. |
| `max_players` | number | `1` | Used by future Tier 2 matchmaking. |

The hub does **not** proxy the game. It stores the manifest and loads
`entry_url` directly from the player's client. Host your game on any
static hosting (GitHub Pages, S3, CDN, etc.).

---

## SDK calls — Tier 1

### 1. `voxply:getContext` — hub and channel info

**Capability required**: none (baseline).

```js
window.parent.postMessage({ type: "voxply:getContext", reqId: 1 }, "*");
// → {
//     type: "voxply:context", reqId: 1,
//     data: {
//       hub: { id: string, name: string, icon_url: string | null },
//       channel: { id: string, name: string },
//       farm: { url: string } | null  // null on un-farmed hubs
//     }
//   }
```

Use `farm` to decide whether KV storage will follow the user across hubs.

---

### 2. `voxply:getUser` — the launching user

**Capability required**: none (baseline).

```js
window.parent.postMessage({ type: "voxply:getUser", reqId: 2 }, "*");
// → {
//     type: "voxply:user", reqId: 2,
//     data: { public_key: string, display_name: string, avatar: string | null }
//   }
```

---

### 3. `voxply:getChannelUsers` — who is in this channel

**Capability required**: `list_channel_users` (admin-granted per hub).

```js
window.parent.postMessage({ type: "voxply:getChannelUsers", reqId: 3 }, "*");
// → {
//     type: "voxply:channelUsers", reqId: 3,
//     data: { users: [ { public_key, display_name, online: true } ] }
//   }
// | { type: "voxply:error", reqId: 3, code: "permission_denied" }
```

Snapshot only — Tier 1 does not push presence events. Re-request for fresh data.

---

### 4. `voxply:postMessage` — post a chat message as the user

**Capability required**: `post_message` (admin-granted per hub).

```js
window.parent.postMessage({
  type: "voxply:postMessage", reqId: 4,
  text: "🎲 rolled a 6!"
}, "*");
// → { type: "voxply:posted", reqId: 4, data: { message_id: string } }
// | { type: "voxply:error", reqId: 4, code: "permission_denied" | "rate_limited" }
```

Posts as the launching user in the launching channel. Text only; no embeds or
attachments in Tier 1.

---

### 5. `voxply:getRecentMessages` — read recent chat history

**Capability required**: `read_channel_history` (admin-granted per hub).

```js
window.parent.postMessage({
  type: "voxply:getRecentMessages", reqId: 5, limit: 50
}, "*");
// → {
//     type: "voxply:recentMessages", reqId: 5,
//     data: {
//       messages: [
//         { id, author_pubkey, author_display, text, ts }
//       ]
//     }
//   }
// | { type: "voxply:error", reqId: 5, code: "permission_denied" }
```

`limit` is capped server-side (max 100). Returns only messages the
launching user can already see. Snapshot only.

---

### 6. `voxply:kvGet` / `voxply:kvSet` — persistent per-user storage

**Capability required**: none (baseline — a game can always store its own player's state).

```js
// Write
window.parent.postMessage({
  type: "voxply:kvSet", reqId: 6, key: "highscore", value: 4200
}, "*");
// → { type: "voxply:kvOk", reqId: 6 }

// Read
window.parent.postMessage({
  type: "voxply:kvGet", reqId: 7, key: "highscore"
}, "*");
// → { type: "voxply:kvValue", reqId: 7, data: { key: "highscore", value: 4200 } }
// | { type: "voxply:kvValue", reqId: 7, data: { key: "highscore", value: null } }  // unset
```

- Scope: `(game_id, user_pubkey)`. Each game gets its own namespace per player.
- On a **farm**: KV is stored on the farm, so it follows the user across every
  hub on the farm that has the game enabled. On a standalone hub it's stored
  locally and does not follow the user to other hubs.
- `value` must be JSON-serialisable. Keys are strings (max 256 chars).
  Values are capped at 8 KB.

---

## Theme

The client appends `?theme=<calm|classic|linear|light>` to the iframe `src`.
Read it from `location.search` and apply your own styling — CSS variables from
the parent frame are not accessible across the iframe boundary.

---

## Error codes

| Code | Meaning |
|------|---------|
| `permission_denied` | The hub admin has not granted the required capability for this game. |
| `rate_limited` | The request was throttled (applies to `postMessage`). |
| `invalid_request` | The request payload was malformed. |

---

## Tier 2 / Tier 3

Real-time multiplayer (Tier 2) and persistent shared worlds (Tier 3) are
designed in [gaming.md](gaming.md) but not yet shipped. Tier 2 will expose
`voxply:game:ready`, `voxply:game:send`, `voxply:game:snapshot`, and related
session-management calls. Tier 3 is undesigned; see
[future-features.md](future-features.md).

---

## Reference game

`desktop/public/demo-games/dice.html` (shipped in the desktop client) is a
working Tier 1 game that calls `voxply:getUser`, reads the theme query
parameter, and uses `voxply:postMessage`. Use it as a starter template.
