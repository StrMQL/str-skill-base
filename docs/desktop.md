# Desktop Client

**English** | [中文](zh/desktop.md)

Prefer a native app over the browser or terminal? The desktop client connects to your Skill Base server, browses the team catalog, and installs or updates skills into the right folders for Cursor, Claude Code, Codex, Qoder, and other agents — without hand-copying paths.

## Download

**CI builds from `main`:** [GitHub Releases → desktop-latest](https://github.com/ginuim/skill-base/releases/tag/desktop-latest)

- macOS `.dmg`
- Windows `.exe` (NSIS)
- Linux `.AppImage` / `.deb`

End users do not need Node.js installed.

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/desktop-market.png" alt="Skill Base desktop — Skill Market" width="720" />
</p>

## Features

**Skill Market** — Search team skills, favorites, and install from the grid (same server as the web UI).

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/desktop-local.png" alt="Skill Base desktop — Local Assets" width="720" />
</p>

**Local Assets** — One view of every on-disk copy of a skill across agent directories, with up-to-date / update-available status.

**Install** — Choose global agents, project agents, or custom folders; optionally overwrite an existing folder with the same name.

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/desktop-install.png" alt="Skill Base desktop — Install to agents" width="720" />
</p>

## Build from source

| Directory | Stack | Build |
|-----------|-------|-------|
| `desktop-tauri/` | Tauri 2 + bundled Node 20 bridge | `pnpm install && pnpm build` |

CI: [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml) updates `desktop-latest` on every push to `main`.

Developer docs:

- [desktop-tauri/README.md](../desktop-tauri/README.md) — dev, build, troubleshooting
- [desktop-tauri/ACCEPTANCE.md](../desktop-tauri/ACCEPTANCE.md) — 21-channel IPC parity checklist
