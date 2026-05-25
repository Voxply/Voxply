# Voxply

A decentralized platform where players can hang out, talk, and play
together. Voice chat, text messaging, federated alliances of hubs, and
community-built games — all keypair-based identity, no central servers.

## Repositories

| Repo | Local path | Contents |
|---|---|---|
| [Voxply](https://github.com/Voxply/Voxply) *(this repo)* | `docs/` | Architecture docs, ROADMAP, design decisions, API spec |
| [Voxply-server](https://github.com/Voxply/Voxply-server) | `hub/` | Hub server, seed server, identity crate |
| [Voxply-desktop](https://github.com/Voxply/Voxply-desktop) | `desktop/` | Tauri + React desktop client, voice crate |
| [Voxply-android](https://github.com/Voxply/Voxply-android) | `android/` | Tauri Android client |
| [Voxply-web](https://github.com/Voxply/Voxply-web) | `web/` | Browser client |
| [Voxply-discovery](https://github.com/Voxply/Voxply-discovery) | `discovery/` | Hub discovery web app |

## Documentation

- [`docs/README.md`](docs/README.md) — architecture, federation, identity,
  alliances, voice, data model, client structure, decisions, threat model,
  and glossary.
- [`ROADMAP.md`](ROADMAP.md) — what's next, known issues, undesigned
  wishlist, and explicit "won't do" decisions.
- [`openapi.yaml`](openapi.yaml) — full API spec (OpenAPI 3.0). Reference for client implementors.

## Features

- **Channels** — unified text + voice in every room. Categories,
  drag-drop reorder, markdown, attachments, reactions, replies,
  mentions, edit/delete.
- **Voice** — Opus over UDP with RNNoise denoise, voice activity
  detection, push-to-talk, self-mute / self-deafen.
- **Direct messages** — federated outbox with retry, attachments,
  typing indicator, unread tracking.
- **Alliances** — multi-hub groups sharing channels and messages via
  federation.
- **Identity** — Ed25519 keypair, 24-word BIP39 recovery phrase, no
  accounts, no passwords.
- **Roles & moderation** — custom roles, ban / mute / timeout / kick,
  channel ban, voice mute, hub approval queue.
- **Security lobby** — PoW-gated entry, bot challenge (click + SVG
  puzzle), role questionnaire / onboarding survey.
- **Bots** — self-service bot creation, slash commands, webhook delivery.

## Built with AI assistance

This project was built with substantial help from
[Claude](https://claude.ai) (Anthropic's AI assistant). The product
owner directs architecture, features, and tradeoffs; Claude drafts
most of the code, tests, and documentation, which is then reviewed,
adjusted, and accepted.

Calling this out for transparency — it's not a fully hand-written
codebase, and pretending otherwise wouldn't be honest.

## License

[GNU Affero General Public License v3.0](LICENSE).
