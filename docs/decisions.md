# Design Decisions

Why Voxply is shaped the way it is. Each entry: the decision, the
alternative we considered, and why we chose this. New decisions go at
the top.

## Notifications: client-side filtering, two distinct features, dot-on-active-hub fixed

**Decision**: a four-part answer to the notification model question.

1. **Subscription protocol stays client-driven (status quo).** The client
   sends `subscribe_all` on connect; the hub continues to firehose every
   channel the user can read. The client filters by per-channel
   `NotifyMode`. Per-channel `subscribe`/`unsubscribe` based on mode is
   designed-but-deferred — the wire shape (`WsClientMessage::Subscribe`
   / `Unsubscribe`) already exists in `chat_models.rs:175-181` so the
   switchover is a client-side change when scale demands it.
2. **Two distinct features, both gated by the same `NotifyMode`.**
   These are not two tiers of one thing; they are separate features that
   happen to share the mode knob.
   - **Notification** = proactive interruption: audio ping + OS
     notification. "Someone is calling for your attention right now."
     Fires when `allowBump` AND the channel is not currently visible
     (not active channel) AND either it's a mention OR mode is `all`
     AND the app is not focused.
   - **Unread pin** = passive reminder: the dot on a channel row and
     the badge on a hub icon in the sidebar. "There are messages waiting
     when you're ready." Fires whenever `allowBump` AND channel is not
     active.
   - Behavior under each mode:
     - `all` → unread pin for every message; notification per the
       notification rule above. Pin fires **even on the active hub**
       when the user is not in that channel. The current "no pin on
       active hub unless mention" gap is treated as a bug and removed.
     - `mentions` → unread pin **only** on mention; notification only
       on mention. Non-mention messages produce neither.
     - `silent` → no pin, no notification, ever.
   - Rule: **notification implies unread pin; unread pin does not imply
     notification**. We do not expose a fourth "pin but no sound" mode.
     Keeping the matrix at three modes is what made the user's mental
     model fit on one line.
3. **Permission gate: hidden channels produce neither pin nor
   notification.** Before processing a `chat-message` event, the client
   checks that `channel_id` exists in its local `channels` array. If
   not, the message is silently dropped — no pin, no notification, no
   unread bump — even if the body contains a mention of the user's
   display name. Today this guards against race conditions (deleted
   channels, channels not yet loaded, firehose entries the client never
   listed). Tomorrow, when per-channel ACLs land, this is the same gate
   that keeps invisible channels invisible. The hub-side firehose is
   not authoritative about what the user can see; the client's
   `channels` list is.
4. **"Hey dude, unread messages" is the existing sidebar pin + hub
   badge + tray badge. No new global banner.** Add one concrete
   affordance: a **"Jump to first notification"** button at the top of
   `ContentArea` when the selected channel has a tracked first-notifying
   message above the current scroll position. Semantics: scroll to the
   first message in the channel's history that *matched the user's
   notify criteria* — i.e., the message that caused the unread pin to
   appear. In `mentions` mode with 50 unread and one mention, this
   jumps to the mention, not to message #1. The client tracks a
   `firstNotifyingMessageId` per channel (string id, client-side state
   only; nothing new on the server). It is set when the pin first
   transitions from clear to set, and cleared when the pin clears.
   The existing `newWhileScrolledUp` pill already covers the "messages
   arrived while you were scrolled up" case; the new button covers
   "you switched into a channel with backlog you haven't seen."

**Alternatives considered**:
- **Server-side mode sync (Option B)**: client tells the hub its
  per-channel modes; server filters. Rejected — couples UI prefs to the
  protocol, and per-user filtering on the broadcast path costs more
  CPU than the firehose saves bandwidth at our scale.
- **Per-channel subscribe/unsubscribe today (Option A)**: cleaner
  long-term but pays migration cost now for a problem (bandwidth) we
  do not have. The wire shape is reserved so we can flip later without
  a protocol break.
- **Mentions-mode pins for all messages (just no notification)**:
  rejected — defeats the user's stated goal of "no pin noise for
  ignored channels." Mentions-only must mean mentions-only on both
  features.
- **Independent pin/notification toggles per channel**: rejected —
  combinatorial explosion in the UI for a use case nobody asked for.
  Three modes, one knob, two features that read it.
- **Global "you have unread messages" toast**: rejected — redundant with
  the tray badge and the window-title unread count, and intrusive when
  the user is in a non-message view (game, settings) on purpose.

**Why this combination wins**:
- Keeps the protocol unchanged today; the future-proof shape is already
  on the wire.
- Fixes the active-hub pin gap that contradicts the user's "pin for
  every message in `all` mode" expectation.
- The notification-implies-pin rule means the pin is a strict superset
  of the notification — users never get notified about something that
  isn't also visible in the sidebar after the fact.
- Naming the two features distinctly ("notification" vs "unread pin")
  prevents the design conversation from collapsing them whenever a new
  edge case shows up.
- The hidden-channel gate keeps the `channels` array as the single
  client-side authority on visibility, which is the same shape per-
  channel ACLs will need.
- Adds one piece of UX ("jump to first notification") that takes the
  user directly to the message that caused the pin, not to arbitrary
  unread #1 — without inventing a new global notification surface.

**Implementation impact**:
- *Client* (`App.tsx` chat-message handler around line 1020-1070):
  - Add the hidden-channel gate as the **first** check in the handler:
    if `!channels.some(c => c.id === msg.channel_id)`, return early.
    No pin, no notification, no unread bump, no mention check.
  - Remove the `(!isActiveHub || isMention)` gate on `bumpUnread` so the
    pin fires for `all`-mode messages on the active hub too.
  - The notification block stays scoped to mentions for `mentions` mode;
    for `all` mode the gate becomes
    `(isMention || (mode === "all" && !document.hasFocus()))`.
- *Client* (per-channel state): track `firstNotifyingMessageId: string
  | null` keyed by channel id. Set it to the incoming message id at the
  moment the pin transitions clear → set; leave it alone on subsequent
  pin-bumps; clear it when the pin clears (channel read).
- *Client* (`ContentArea`): add a "Jump to first notification"
  affordance. On channel select, if `firstNotifyingMessageId` is present
  and that message is not in view, render the button. Click scrolls to
  that message id; the button hides on scroll-into-view or on click.
- *Server*: no changes. The reserved per-channel `Subscribe` /
  `Unsubscribe` wire types stay reserved. The hidden-channel gate is
  client-side only — the hub keeps firehosing.
- *Docs*: cross-link this entry from `client.md` notification bullets.

**Deferred**:
- Per-channel firehose-off (Option A migration): defer until a real
  bandwidth/battery measurement justifies it. Trigger conditions:
  (a) median user is on >10 hubs with >50 channels each, or
  (b) mobile client lands and battery telemetry shows WS traffic as a
  top drain.
- Quiet hours / DND windows: not in this decision. If added later, they
  layer on top as a global override that downgrades all modes one step
  (`all` → `mentions`, `mentions` → `silent`, `silent` stays).
- Per-user mute (mute a person across all channels): orthogonal, lives
  in the block/ignore system in `client.md`, not here.

## Client state stays in App.tsx; no per-domain hooks, no context

**Decision**: after the JSX-extraction refactor, `App.tsx` keeps owning
all 172 hooks, all effects, and all event handlers as a single flat
state container. Components stay pure renderers that receive what they
need as props. We do not split state into per-domain custom hooks, and
we do not introduce React context for any application-state domain.

**Alternatives considered**:
- **Custom hooks per domain** (`useHubs`, `useMessaging`, `useVoice`,
  `useUI`, ...). App.tsx becomes a composer.
- **React context per domain** with leaf components consuming directly,
  removing prop drilling through `ContentArea` (~50 props) and
  `ChannelSidebar` (~30 props).
- **Hybrid**: hooks for data domains, context only for truly global
  values (theme, publicKey, blockedUsers).

**Why staying flat wins**:
- **The handlers are cross-domain.** `handleSend` touches messages,
  typing, attachments, reply target, unread, notifications. Selecting a
  hub mutates hubs, channels, messages, roles, approval status, voice,
  and admin tabs. Adding a friend touches friends, conversations, and
  view. Domains as drawn in the proposal are not closed sets; a
  `useMessaging` hook would either pull `useTyping`/`useAttachments`/
  `useUnread`/`useNotifications` in as deps (so its public surface
  re-exposes everything), or the handler would have to live above the
  hooks anyway. Both paths reintroduce App.tsx.
- **Effects already cross domains.** The hub-WS event listener writes
  into messages, channels, users, voice, typing, alliances, DMs,
  unread, and friends in one block. Splitting it across hooks means
  six hooks all subscribing to the same Tauri event stream and
  fighting over shared invariants like "active hub changed → reset".
- **Context costs more than it saves here.** The two fat-prop
  components (`ContentArea`, `ChannelSidebar`) are *not* deep trees —
  they are direct children of App.tsx. The "drilling" is one level.
  Context would replace one explicit interface with implicit coupling
  and make those components untestable without a provider harness.
  TypeScript inference on context with `T | undefined` defaults is
  also strictly worse than the current explicit prop interfaces.
- **C# mental model.** The dev is new to React. One big stateful
  parent + dumb children is easy to reason about (it maps to a
  ViewModel with child controls). Custom hooks plus context plus
  cross-hook coordination is a step into idiomatic-React territory
  with no payoff at the current size.
- **No state-library convention.** We've already committed to "React
  state + context covers everything." That convention does not say
  "use context aggressively"; it says "don't reach for Redux/Zustand."
  Plain hooks satisfy it.

**What this means in practice**:
- No `useFooDomain()` files under `src/hooks/`. If a piece of logic
  is genuinely reusable and pure (e.g., a typing-debounce helper, a
  reconnect-backoff helper), it can become a small custom hook — but
  scoped to one concern, not a domain.
- No new `*Context` providers. The existing top-level theme application
  via `data-theme` on the root element stays as-is.
- The fat prop interfaces on `ContentArea` and `ChannelSidebar` stay.
  They are the bill we pay for the explicit data flow.
- Future extraction targets are *handlers*, not state. If App.tsx grows
  again, pull pure helpers (URL builders, message formatters, sort
  comparators) into `src/utils/` — not into stateful hooks.

**Revisit when**:
- A second top-level surface starts mounting independently of App.tsx
  (e.g., a separate window, a popover that lives outside the React
  tree). At that point a context for shared identity/theme might pay
  off.
- The dev is comfortable enough with React idioms that the
  cross-domain coordination cost in App.tsx outweighs the cognitive
  cost of context wiring. That is a judgement call, not a metric.

**Supersedes**: the "future refactor could split state into context
providers per domain" hedge in [client.md](client.md). That option is
now explicitly off the table until the revisit conditions hit.

## Personal state lives on a home hub list; community state stays direct

**Decision**: a user designates a master-signed, ordered list of
**home hubs** that hold their *personal-axis* state — devices, prefs,
DMs, friends. Community-axis state (channel messages, voice,
alliances) still flows direct between client and the relevant
community hub. Writes to personal-axis state replicate across the
list; reads can hit any hub in the list.

**Alternative considered**: continue with no home hub at all (the
prior decision), pushing every personal-axis feature to invent its
own ad-hoc per-hub or per-device sync.

**Why a list wins**:
- Multi-device needs a single canonical place to publish device
  certs and revocations. Without one, every community hub would
  need its own copy and would drift.
- DMs need a canonical inbox view so phone + desktop see the same
  list. Spraying across community hubs without a canonical view
  forces every device to log into every hub.
- A *list* (rather than a single home hub) preserves the failover
  resilience that drove "DM failover, not load-balanced routing"
  below — any hub in the list can serve, and there is no single
  point of failure.
- Master-signed designations mean consumers never have to trust an
  individual home hub — they verify the master signature.

**What this supersedes**: the "Client connects directly to many hubs"
entry below was correct *for community traffic* but forced
personal-axis state into bad shapes. It is now scoped to community
traffic only; personal state goes through home hubs.

**Design docs**: [home-hub.md](home-hub.md) (storage layer) and
[multi-device.md](multi-device.md) (identity + pairing protocol).

## Channels are unified text + voice

**Decision**: every channel is both a chat room and a voice room. There
is no "text channel" vs "voice channel" type. Joining voice is something
a user *does* in a channel — not a property of the channel.

**Alternative considered**: a split model — separate channel types,
each doing one thing.

**Why unified wins**:
- Channel-as-place model: a channel is a *place*. People are there,
  talking and typing.
- Halves the channel count for the same expressiveness — communities
  don't need a "#raids" text channel and a separate "Raid Voice"
  channel; they have one "raids" room where both happen.
- Permissions, moderation, bans, naming, history all attach to the
  same entity.
- Schema is simpler: `channels` has no `kind` column. Voice is
  runtime state (`state.voice_channels` map keyed by channel id), not a
  persistent property.

**Implication for design**: when adding any channel feature, ask "does
this make sense for both chat and voice in the same room?" If yes,
build it once. If no, the feature probably belongs as a *channel
property* (e.g., `min_talk_power`) rather than a new channel kind.

## Client connects directly to many hubs

**Status**: partially superseded — see "Personal state lives on a home
hub list" above. This decision still holds for **community traffic**
(channels, voice, alliances), but **personal-axis state** (devices,
prefs, DMs, friends) now flows through a master-signed home hub list.

**Decision**: the desktop client connects to each hub directly. Hubs
are independent — they don't proxy each other's traffic.

**Alternative considered**: a "home hub" model where your home hub
proxies everything else.

**Why direct (for community traffic)**: simpler. Each hub is a self-
contained community. Cross-hub features (alliances, federated DMs)
are explicit opt-in protocols on top, not the default. The client
becomes the multi-hub orchestrator, not the hub server.

**Why this had to bend for personal-axis state**: see the home hub
list decision above — multi-device, DM unification, and prefs sync
all needed an anchor that "no home hub" couldn't provide.

## DM failover, not load-balanced routing

**Decision**: a user publishes an **ordered list** of delivery hubs in
their friend record. Sender tries primary → secondary → etc. on failure.

**Alternative considered**: load-aware / traffic-aware routing across
hubs.

**Why failover wins**: load-balancing needs gossip, cross-hub
consistency, and shared state we don't have. Failover gets ~90% of the
benefit at near-zero coordination cost. Don't add load-aware routing
without real telemetry justifying it.

## One device per account (today)

**Decision**: A recovery phrase is the secret. Pasting it on a device
*replaces* that device's identity; it doesn't sync.

**Alternatives considered**:
- HD-wallet style master seed → per-device subkeys via HKDF.
- "Home hub" picks a primary device and syncs an encrypted prefs blob.

**Why simple wins now**: multi-device adds key management, conflict
resolution, and revocation work that we don't yet need. The simple model
ships and is forward-compatible: the recovery phrase can later be
treated as a master seed without breaking existing identities (migrate
by deriving the existing key as "subkey 0").

**Revisit when**: design is now committed in
[multi-device.md](multi-device.md) (identity model + QR pairing
protocol) and [home-hub.md](home-hub.md) (storage layer). The
implementation is phased; this entry stays accurate as a description
of the *current shipped* behavior until phases 3-5 land.

## ROADMAP.md is gitignored

**Decision**: ROADMAP.md is the durable local task list. Not committed.

**Why**: it's a working document that changes hourly during a session;
versioning it produces noise without value. Public state lives in
README.md and `docs/`.

## Federated, not centralized

**Decision**: Communities are hubs. Hubs federate. No central server.

**Why**:
- Lets a community own its data and moderation policy.
- A single takedown doesn't kill the network.
- Matches the "many private servers" mental model people already have.

**Cost**: harder onboarding (you need a hub URL), harder discovery,
harder cross-community state. We accept these in exchange for community
sovereignty.

## Three crates, not a monorepo soup

**Decision**: `shared/`, `server/`, `client/` as the top-level split,
each with one or two crates.

**Why**: identity rules and voice rules must agree exactly between client
and server. One crate per cross-cutting concern prevents drift. Beyond
that, server and client have completely different shapes — separate
crates avoid a giant feature-flagged build.

## Tauri, not Electron

**Decision**: Tauri 2 + React for the desktop app.

**Why**: smaller binaries, native voice access via cpal, real OS APIs
without an Electron runtime. The cost is fewer pre-built integrations,
but for a voice-first app the OS-native audio path is non-negotiable.

## SQLite, not Postgres

**Decision**: each hub embeds SQLite.

**Why**: a hub is single-tenant by design. SQLite means zero-ops for the
operator (no DB to set up), trivial backups (one file), and good enough
performance for community-scale traffic. If we later want multi-tenant
hub farms, the storage layer can change underneath without affecting
the federation protocol.

## DMs as outbox, not session

**Decision**: federated DMs are mailbox-style — sender's hub queues
the message and pushes it to the recipient's hub.

**Why**: recipient's hub may be offline. Familiar mental model. Avoids
"home hub" picking — both hubs hold a copy by design. See
[federation.md](federation.md).

## No proof-of-work yet

**Decision**: anti-spam is in the ROADMAP, not shipped. The PoW
primitives exist (`shared/voxply-identity/src/pow.rs`) but aren't
enforced.

**Why**: premature spam mitigation in a private-network product would
just annoy real users. Add when there's actual abuse to mitigate.
