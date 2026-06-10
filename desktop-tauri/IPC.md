# Desktop IPC Channels (22)

Skill Base Desktop 前端通过 `window.skb.invoke(channel, ...args)` 调用后端。
前端通过 `window.skb.invoke(channel, ...args)` 调用后端；Tauri 走 Rust `skb_invoke` → Node bridge HTTP。

## Channels

| Channel | Args | Returns | Notes |
|---------|------|---------|-------|
| `config:get` | — | `{ baseUrl, username, hasToken, projectRoot }` | |
| `config:setServer` | `url: string` | `{ baseUrl }` | |
| `config:getGlobalTargets` | — | `Target[]` | |
| `config:getProjectTargets` | `cwd?: string` | `Target[]` | |
| `config:getProjectTargetTemplates` | — | `Target[]` | |
| `project:getRoot` | — | `string` | |
| `project:setRoot` | `root: string` | `string` | |
| `project:pickRoot` | — | `string \| null` | native dialog |
| `project:pickInstallDir` | `defaultPath?: string` | `string \| null` | native dialog |
| `shell:revealPath` | `rawPath: string` | `{ ok: true }` | native reveal |
| `auth:openLogin` | — | `void` | opens browser |
| `auth:exchangePat` | `code: string` | `{ username }` | |
| `auth:whoami` | — | `{ ok, baseUrl, user?, reason?, detail? }` | |
| `auth:logout` | — | `{ ok: true }` | |
| `skills:search` | `q?: string` | `Skill[]` | |
| `skills:getVersions` | `skillId: string` | `Version[]` | |
| `skills:getRemote` | `skillId: string` | `Skill` | |
| `skills:getInstalled` | — | `InstalledSkill[]` | |
| `skills:install` | `InstallPayload` | `{ ok, ... }` | may return `NESTED_IDE_PATH` / `EXISTS` |
| `skills:update` | `UpdatePayload` | `{ ok, ... }` | may return `PICK_PATHS` |
| `skills:delete` | `{ skillId, installPaths?, all? }` | `{ ok, deleted, skipped }` | deletes local install dirs and records |
| `skills:openWebPage` | `{ skillId, version?, page?, version_a?, version_b? }` | `{ url }` | opens browser |

## Shared implementation

Logic lives in `cli/lib/desktop-handlers.mjs` (`registerDesktopHandlers`).
Channel list: `cli/lib/desktop-ipc-channels.mjs`.
Platform hooks injected via `deps`: `pickDirectory`, `revealPath`, `openExternal`, `getProjectRoot`, `setProjectRoot`.

## Tauri routing

- **Bridge (Node HTTP)**: all channels except native shell hooks when Tauri handles them in Rust.
- **Rust native**: `project:pickRoot`, `project:pickInstallDir`, `shell:revealPath`, `auth:openLogin`, `skills:openWebPage` (dialog/opener plugins).

Bridge listens on `127.0.0.1:<random>` — `POST /invoke` body: `{ "channel": "...", "args": [...] }`.
