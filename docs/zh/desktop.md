# 桌面客户端

[English](../desktop.md) | **中文**

不想只用浏览器或命令行？桌面端连接 Skill Base 服务，浏览团队目录，把 Skill 安装、更新到 Cursor、Claude Code、Codex、Qoder 等目录，不用手抄路径。

## 下载

**`main` 分支 CI 构建：** [GitHub Releases → desktop-latest](https://github.com/ginuim/skill-base/releases/tag/desktop-latest)

- macOS `.dmg`
- Windows `.exe`（NSIS）
- Linux `.AppImage` / `.deb`

终端用户无需单独安装 Node.js。

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/desktop-market.png" alt="Skill Base 桌面端 — 技能市场" width="720" />
</p>

## 功能

**技能市场** — 与 Web 同一套目录：搜索、收藏、从卡片安装。

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/desktop-local.png" alt="Skill Base 桌面端 — 本地资产" width="720" />
</p>

**本地资产** — 汇总各 Agent 目录下的同名 Skill，默认最近安装/更新在前，显示是否已是最新；快捷“更新/同步更新所有”会更新该 Skill 的所有已记录安装目录，也可以进入目录选择弹窗只更新部分目录。

**安装** — 选全局 Agent、项目 Agent 或自定义目录；可覆盖同名文件夹。桌面端会标记不可写的安装目标，例如 `Universal (.agents)` 的全局目录对应 `~/.config/agents/skills`，若该目录或上级目录权限异常，请先修复权限，或改用“自定义目录”选择已授权的位置。

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/desktop-install.png" alt="Skill Base 桌面端 — 安装到 Agent" width="720" />
</p>

## 从源码构建

| 目录 | 技术栈 | 构建 |
|------|--------|------|
| `desktop-tauri/` | Tauri 2 + 内置 Node 20 bridge | `pnpm install && pnpm build` |

CI：[`.github/workflows/desktop-release.yml`](../../.github/workflows/desktop-release.yml) 在推送到 `main` 时更新 `desktop-latest`。

开发文档：

- [desktop-tauri/README.md](../../desktop-tauri/README.md) — 开发、构建、排障
- [desktop-tauri/ACCEPTANCE.md](../../desktop-tauri/ACCEPTANCE.md) — 25 通道 IPC 验收
