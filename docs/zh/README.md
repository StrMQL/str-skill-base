# Skill Base

[English](../README.md) | **中文**

[![npm version](https://img.shields.io/npm/v/skill-base.svg)](https://www.npmjs.com/package/skill-base)
[![Node version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)

> 面向团队的 Agent Skill 私有分发平台。一次发布，在 Cursor、Claude Code、Codex、OpenClaw 等助手上安装、更新、回滚 —— 一个小服务端 + `skb` CLI 就够。

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/demo.gif" alt="Skill Base 运行演示" />
</p>

## 为什么需要

团队已经在写 Skill，但常见做法还是丢进 `.cursor/skills`、`.claude/skills` 或各项目仓库，靠 Git 同步。团队一大就出问题：

- **IDE 目录各搞各的** — Cursor、Claude Code、Qoder 等落盘路径不一致。
- **非研发被挡在外面** — PM、QA 不该为了用规范去开仓库权限。
- **更新传不下去** — A 项目改了 Skill，B 项目不会自动跟上。

Skill Base 把 Skill 变成**可发布、可版本化、可安装**的团队资产。工程取舍见 [架构与设计](architecture.md)。

## 能做什么

| 能力 | 方式 |
|------|------|
| **发布** | Web 上传、`skb publish`、公开 GitHub 仓库导入 |
| **安装 / 更新** | `skb install` / `skb update`，记住 IDE 路径与本地安装记录 |
| **浏览** | Web 端搜索、版本、changelog、标签、收藏 |
| **桌面端** | 原生客户端 — [下载](desktop.md) |
| **可见性** | `public` / `private`；owner / collaborator / user 权限 |

<p align="center">
  <img src="https://github.com/ginuim/skill-base/raw/main/docs/images/desktop-market.png" alt="Skill Base 桌面端 — 技能市场" width="720" />
</p>

## 快速开始

**服务端**（Node.js >= 18）：

```bash
npx skill-base -d ./skill-data -p 8000
```

浏览器打开地址，完成初始化并创建管理员。

**CLI：**

```bash
pnpm add -g skill-base-cli
skb init -s http://localhost:8000
skb search vue
skb install some-skill --ide cursor
skb login    # 发布前需要
skb publish ./my-skill --changelog "首次发布"
```

详见 [快速开始](getting-started.md) · CLI 全文：[cli.md](cli.md)

## 设计原则（简）

- **Skill 是分发单元** — 不是通用网盘，也不是 Agent 编排平台。
- **SQLite + ZIP** — `skills.db` 做索引，每个版本一个归档包；备份 = 复制目录。
- **单 Node 进程** — 不为这种规模上 Redis、消息队列或微服务。

展开：[架构与设计](architecture.md)

## 文档

| 文档 | 内容 |
|------|------|
| [快速开始](getting-started.md) | 启服、CLI、首次安装与发布 |
| [使用说明](usage.md) | Web 端、GitHub 导入、OpenClaw、Skill 格式 |
| [部署与备份](deployment.md) | Docker、PM2、参数、Session、备份 |
| [架构与设计](architecture.md) | 数据模型与技术选型 |
| [桌面客户端](desktop.md) | 下载与功能 |
| [CLI](cli.md) | `skb` 命令参考 |
| [API](api.md) | HTTP API |
| [更新日志](../CHANGELOG.md) | 服务端 / npm 版本说明 |
| [作者与维护](author.md) | 维护契约、Author's Lab |

双语索引：[docs/README.md](../README.md)

## Author's Lab

同一维护者的其他项目，只挂稳定链接。

| | |
|--|--|
| [skillbase.reaidea.com](https://skillbase.reaidea.com) | 在线 Skill Base |
| [reaidea.com](https://reaidea.com) | 作者主页与后续工具 |

更多见 [author.md](author.md)。

## 维护说明

本项目由**兼职独立开发者**在工作日晚间和周末维护。

欢迎 Issue 和 PR，没有 on-call SLA；范围清晰的小 PR 比大而全的需求更容易合并。

全文：[author.md](author.md)

## 许可

[MIT](../LICENSE)
