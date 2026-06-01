# Skill Base

**English** | [中文](docs/zh/README.md)

[![npm version](https://img.shields.io/npm/v/skill-base.svg)](https://www.npmjs.com/package/skill-base)
[![Node version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> Private distribution for Agent Skills. Publish once; install, update, and roll back across Cursor, Claude Code, Codex, OpenClaw, and similar assistants — one small server, one CLI (`skb`).

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/demo.gif" alt="Skill Base demo" />
</p>

## Why

Teams already write Skills, but they often live in `.cursor/skills`, `.claude/skills`, and repo-specific paths synced by Git. That breaks down when:

- **IDEs disagree on layout** — each assistant expects different folders.
- **Non-engineers need standards too** — PM/QA should not need repo access for team rules.
- **Updates do not propagate** — project A updates a Skill; project B drifts until someone copies files again.

Skill Base makes Skills **publishable, versioned, and installable** team assets. See [Architecture](docs/architecture.md) for the engineering rationale.

## What it does

| Capability | How |
|------------|-----|
| **Publish** | Web upload, `skb publish`, or GitHub import (public repos) |
| **Install / update** | `skb install` / `skb update` with IDE-aware paths and local install tracking |
| **Browse** | Web UI for search, versions, changelogs, tags, favorites |
| **Desktop** | Native client — [download](docs/desktop.md) |
| **Visibility** | `public` / `private` skills; owner / collaborator / user permissions |

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/desktop-market.png" alt="Skill Base desktop — Skill Market" width="720" />
</p>

## Quick start

**Server** (Node.js >= 18):

```bash
npx skill-base -d ./skill-data -p 8000
```

Open the URL, complete first-time setup, create an admin account.

**CLI:**

```bash
pnpm add -g skill-base-cli
skb init -s http://localhost:8000
skb search vue
skb install some-skill --ide cursor
skb login    # required for publish
skb publish ./my-skill --changelog "First release"
```

Details: [Getting Started](docs/getting-started.md) · CLI: [docs/zh/cli.md](docs/zh/cli.md) (中文)

## Design philosophy (short)

- **Skills are the unit** — not a generic file dump or agent orchestrator.
- **SQLite + ZIP on disk** — `skills.db` indexes; each release is a versioned archive. Backup = copy one directory.
- **One Node process** — no Redis, no queue, no microservice mesh for a problem this size.

Longer write-up: [Architecture](docs/architecture.md).

## Documentation

| Doc | Contents |
|-----|----------|
| [Getting Started](docs/getting-started.md) | Server, CLI, first install/publish |
| [Usage](docs/usage.md) | Web UI, GitHub import, OpenClaw prompts, Skill format |
| [Deployment](docs/deployment.md) | Docker, PM2, flags, sessions, backup |
| [Architecture](docs/architecture.md) | Data model and stack choices |
| [Desktop](docs/desktop.md) | Download and features |
| [CLI](docs/zh/cli.md) | `skb` command reference (中文) |
| [API](docs/zh/api.md) | HTTP API (中文) |
| [Changelog](CHANGELOG.md) | Server / npm release notes |
| [Author](docs/author.md) | Maintenance contract, Author's Lab |
| [Docs index](docs/README.md) | Bilingual documentation map |

中文入口：[docs/zh/README.md](docs/zh/README.md)

## Author's Lab

Side projects from the same maintainer. Stable links only — no filler.

| | |
|--|--|
| [skillbase.reaidea.com](https://skillbase.reaidea.com) | Hosted Skill Base |
| [reaidea.com](https://reaidea.com) | Author homepage and future tools |

More entries land in [docs/author.md](docs/author.md) when they ship.

## Maintenance

This repo is maintained by a **part-time independent developer** on evenings and weekends.

Issues and PRs are welcome. There is no on-call SLA; clear, scoped PRs are easier to merge than open-ended feature asks.

Full note: [docs/author.md](docs/author.md).

## License

[MIT](LICENSE)
