# 架构与设计

[English](../architecture.md) | **中文**

Skill Base 是 **Agent Skill 分发中心**，不是通用文件存储，也不是 Agent 编排平台。服务端只做鉴权、存储、版本、分发。

## 问题从哪来

Skill 常落在 `.cursor/skills`、`.claude/skills`、`.github/instructions`，靠 Git 同步。规模上来后：

- **IDE 路径分裂** — Cursor、Claude Code、Qoder、Windsurf、OpenCode 各有一套目录。
- **非研发进不来** — PM、QA 不该为规范去开仓库、学 `git pull`。
- **跨项目漂移** — A 项目更新了共享 Skill，B 项目不会自动跟上。

Skill Base 把 Skill 变成可发布、可安装、可版本化、可回滚的团队资产。

## 数据模型

三层，没有黑盒：

| 层 | 作用 |
|----|------|
| `skills.db` | 索引：Skill、版本、用户、权限、可选 Session |
| `skills/<skill-id>/<version>.zip` | 不可变发布产物 |
| Node.js 服务 | HTTP API + 静态 Web UI |

`skills.db` 是索引，不是 blob 库。每个版本的 ZIP 才是该版本的真相；用普通工具就能看、拷、备份整个数据目录。

权限三档：**owner**、**collaborator**、**user**。Skill 默认 `public`；`private` 仅 owner、协作者、管理员可见。无权限向已有 `skill_id` 发布会被拒绝。

## 为什么是 Node.js + SQLite，而不是微服务

刻意不做的：

- 不为这种体量上 MySQL/Postgres 集群
- 不为 Session/缓存上 Redis（进程内存或 SQLite 一张表够用）
- 不为版本包上对象存储（磁盘 ZIP 足够）
- 不为上传上消息队列（同步 HTTP + 写盘更可预期）

**Node.js + Fastify** 部署单元就是一个进程。**SQLite**（`node-sqlite3-wasm`）免 native 编译，备份 = 复制文件夹。**每版本一个 ZIP**，回滚就是选旧文件。

进程内 LRU 缓存（默认 50 MB，`CACHE_MAX_MB` / `--cache-max-mb`）加速读路径；写路径显式失效相关缓存，没有分布式缓存要对账。

## 没做什么

- 多租户计费、组织层级、复杂 RBAC
- 在服务端跑 Agent 或路由工具
- Skill  markdown 实时协同
- 强制云依赖

需要这些请换产品。Skill Base 面向**私有化、自托管、零件少**的 Skill 分发。

## GitOps 友好

状态 = 文件 + 一个库：

- 快照数据目录即备份
- 可把数据目录纳入内部 Git 仓库
- 多实例仅在共享 `skills.db` 且 `SESSION_STORE=sqlite` 时才有意义

## 边界

- **范围内：** 发布、版本、安装、更新、可见性、元数据 webhook、公开 GitHub 导入、CLI 与桌面端共用 API。
- **范围外：** 跑 Agent、调度任务、存任意非 Skill 资产、替代 IDE 自带 skill 发现。

目标是让团队规范**流动起来**，不是为了 PPT 好看。
