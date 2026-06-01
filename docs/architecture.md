# Architecture and Design Philosophy

**English** | [中文](zh/architecture.md)

Skill Base is a **distribution hub for Agent Skills**, not a generic file store and not an agent orchestration platform. The server does auth, storage, versioning, and distribution. Nothing else.

## Why this shape exists

Teams already write Skills, but they often land in `.cursor/skills`, `.claude/skills`, `.github/instructions`, and sync via Git. That works until:

- **IDE layouts diverge** — Cursor, Claude Code, Qoder, Windsurf, OpenCode each expect different on-disk paths.
- **Non-engineers are blocked** — PMs and QA need the same standards without repo access or `git pull`.
- **Cross-project reuse drifts** — When a shared Skill updates in project A, project B does not follow unless someone copies files by hand.

Skill Base turns Skills into publishable, installable, versioned, rollback-friendly team assets.

## Data model

Three layers, no hidden magic:

| Layer | Role |
|-------|------|
| `skills.db` | Index: skills, versions, users, permissions, optional sessions |
| `skills/<skill-id>/<version>.zip` | Immutable release artifacts |
| Node.js service | HTTP API + static web UI |

`skills.db` is an index, not a blob store. ZIP files are the source of truth per release. You can inspect, copy, and back up the data directory with ordinary tools.

Permissions stay flat: **owner**, **collaborator**, **user**. Skills are `public` by default; `private` limits visibility to owner, collaborators, and admins. Publish to an existing `skill_id` without permission is rejected.

## Why Node.js + SQLite, not microservices

Deliberate omissions:

- No MySQL/Postgres cluster for a problem that fits one file
- No Redis for session or cache when process memory or one SQLite table suffices
- No object storage when versioned ZIPs on disk are enough
- No message queue for uploads — synchronous HTTP + filesystem writes are predictable

**Node.js + Fastify** keeps the deploy unit one process. **SQLite** (`node-sqlite3-wasm`) removes native compile friction and keeps backup = copy a folder. **ZIP per version** makes rollbacks obvious: pick an older file.

An in-process LRU cache (default 50 MB, `CACHE_MAX_MB` / `--cache-max-mb`) speeds read-heavy paths. Writes invalidate relevant cache entries; there is no distributed cache to reconcile.

## What we did not build

- Multi-tenant SaaS billing, org hierarchies, or RBAC matrices
- Skill runtime execution or tool routing inside the server
- Real-time collaboration on Skill markdown
- Mandatory cloud dependencies

If you need those, use a different product. Skill Base optimizes for teams that want **private, self-hosted Skill distribution** with minimal moving parts.

## GitOps-friendly operations

Because state is files + one database:

- Snapshot the data directory for backup
- Optionally commit the data directory to an internal Git repo
- Run multiple instances only when you accept shared SQLite session storage (`SESSION_STORE=sqlite`) and a shared `skills.db`

## Boundaries

- **In scope:** publish, version, install, update, visibility, webhooks on metadata changes, GitHub import of public repos, CLI and desktop clients against the same API.
- **Out of scope:** running agents, scheduling jobs, storing arbitrary non-Skill assets, replacing your IDE's native skill discovery.

The goal is to make team standards **flow** — not to look impressive on a slide deck.
