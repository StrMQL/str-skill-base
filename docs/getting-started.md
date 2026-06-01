# Getting Started

**English** | [中文](zh/getting-started.md)

Node.js >= 18. The server uses `node-sqlite3-wasm` for SQLite, so normal startup does not require native `better-sqlite3` compilation.

## 1. Start the server

```bash
npx skill-base -d ./skill-data -p 8000
```

On first visit, the web UI runs initialization; follow the prompts to create an admin account.

Other common invocations:

```bash
npx skill-base
npx skill-base --host 127.0.0.1
npx skill-base --base-path /skills/
npx skill-base --cache-max-mb 100
npx skill-base --session-store sqlite
```

Server flags and environment variables are documented in [Deployment](deployment.md).

### WAL migration (upgrades from older releases)

If you are upgrading from a release that wrote SQLite in WAL mode, Skill Base migrates the database on first start: it tries `sqlite3` on your `PATH`, then a bundled helper, then continues on the WASM driver without manual steps.

Bundled migration helpers ship for macOS `arm64` / `x64`, Linux `x64`, and Windows `x64`. On other platforms, set `SKILL_BASE_SQLITE3_PATH` to a local `sqlite3` binary for the first startup.

## 2. Install the CLI

```bash
pnpm add -g skill-base-cli
```

Or use `npx skill-base-cli` without a global install.

## 3. Point the CLI at your server

```bash
skb init -s http://your-team-server
```

Use the site root URL (no `/api` suffix). The config is saved to `~/.skill-base/config.json`.

Login is only required for **publish** (and other write operations that need auth). Search and install usually work without login:

```bash
skb login
skb whoami          # confirm token; --json / -q for scripts
```

## 4. Install, update, publish

```bash
skb search vue
skb install vue-best-practices
skb install vue-best-practices@v20260115
skb install vue-best-practices -d ./.cursor/skills
skb install team-vue-rules --ide cursor
skb install git-commit-rules --ide cursor --global
skb list
skb update team-vue-rules
skb publish ./my-skill --changelog "API auth rules updated"
```

Supported `--ide` targets include Cursor, Claude Code, GitHub Copilot, Windsurf, Qoder, QoderWork, and OpenCode.

Full command reference: [CLI](zh/cli.md) (中文).

## When Skill Base fits

- Your team uses more than one AI IDE
- Skills must be reused across projects
- Standards evolve often and you need version history
- PM, QA, and ops want direct access to Skills
- You do not want heavy infra for a small platform

## Next steps

- [Usage](usage.md) — Web UI, GitHub import, OpenClaw prompts, Skill format
- [Deployment](deployment.md) — Docker, PM2, backup, session storage
- [Desktop](desktop.md) — Native client download and features
- [Architecture](architecture.md) — Why the stack looks like this
- [Docs index](README.md) — Bilingual map
