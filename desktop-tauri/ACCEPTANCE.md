# Desktop Tauri — Acceptance Checklist

Tauri 桌面客户端 UI 在 `src/`，业务逻辑在 `cli/lib/desktop-handlers.mjs`。共 **22** 个 IPC channel（见 [IPC.md](./IPC.md)）。

## 自动化

在 `desktop-tauri/` 目录：

```bash
pnpm install
pnpm smoke:bridge              # 快速：bridge 启动 + config:get
pnpm smoke:bridge -- --bundled # 同上，测 esbuild 产物
pnpm smoke:channels            # bridge 通道（含校验/网络容错）
pnpm verify:ipc                # channel 声明 / Rust 路由 / App.vue 引用
cd src-tauri && cargo check    # Rust 编译检查
```

## Bridge 通道（自动化已覆盖）

| Channel | 自动化 | 说明 |
|---------|--------|------|
| `config:get` | yes | 返回 baseUrl、登录态、projectRoot |
| `config:setServer` | yes | 写入并返回 baseUrl |
| `config:getGlobalTargets` | yes | 全局 Agent 目录列表 |
| `config:getProjectTargets` | yes | 给定 cwd 的项目级目录 |
| `config:getProjectTargetTemplates` | yes | 项目模板（无 exists） |
| `project:getRoot` | yes | 当前项目根 |
| `project:setRoot` | yes | 持久化项目根 |
| `auth:whoami` | yes | 有/无 token 均返回结构化结果 |
| `auth:logout` | yes | 清除凭证 |
| `auth:exchangePat` | yes | 非法验证码格式报错 |
| `skills:getInstalled` | yes | 本地安装列表（可空数组） |
| `skills:search` | yes* | 需 Skill Base 可达；离线时允许连接错误 |
| `skills:getVersions` | yes* | 同上 |
| `skills:getRemote` | yes* | 同上 |
| `skills:install` | yes | 仅测参数校验；完整安装见手动 |
| `skills:update` | yes | 仅测参数校验；`PICK_PATHS` 见手动 |
| `skills:delete` | yes | 仅测参数校验；完整删除见手动 |
| `skills:openWebPage` | yes | bridge 侧 URL 构建校验；打开浏览器见 Rust 手动 |

## Rust 原生通道（需手动 UI 点击）

在 `pnpm dev` 或 release 包中逐项验证。

| Channel | 手动步骤 | 预期 |
|---------|----------|------|
| `project:pickRoot` | 工具栏点击项目路径 → 选文件夹 | 路径更新，`config:get.projectRoot` 同步 |
| `project:pickInstallDir` | 安装弹窗 → 自定义目录 / 项目根 | 返回所选路径或 cancel → `null` |
| `shell:revealPath` | 已安装 Skill → 在 Finder/资源管理器中显示 | 系统文件管理器定位到目录 |
| `auth:openLogin` | 连接设置 → 浏览器登录 | 系统浏览器打开 `{baseUrl}/login?from=cli` |
| `skills:openWebPage` | 市场/详情 → 在浏览器中打开 | 系统浏览器打开 skill 页或 diff 页 |

## 端到端场景（手动）

需本地或远程 Skill Base 实例（默认 `http://localhost:8000`）及有效登录（发布/私有 skill 时）。

### 1. 连接与登录

- [ ] 设置 Server URL → 保存成功
- [ ] 「浏览器登录」打开登录页
- [ ] 输入 CLI 验证码 → `auth:exchangePat` 成功，显示用户名
- [ ] `whoami` 显示已登录；登出后 token 清除

### 2. 技能市场

- [ ] 搜索关键词返回列表
- [ ] 打开 Skill 网页（浏览器）

### 3. 安装

- [ ] **全局** Agent 目录安装
- [ ] **项目** Agent 目录安装（切换项目根后路径正确）
- [ ] **自定义**目录安装
- [ ] **NESTED_IDE_PATH**：在 IDE skills 目录内安装时提示嵌套确认
- [ ] **EXISTS**：目标已有同名目录时提示覆盖

### 4. 本地资产 / 更新 / 删除

- [ ] 已安装列表展示版本与远端 latest
- [ ] 单路径 Skill 一键更新
- [ ] 多路径 Skill → **PICK_PATHS** 选择后更新
- [ ] 多路径 Skill → 删除弹窗勾选多个目录后删除
- [ ] 多路径 Skill → 删除弹窗选择全部目录后删除全部记录
- [ ] 在 Finder/资源管理器中显示安装路径

### 5. Release 包

- [ ] `pnpm build` 产物可启动（不依赖系统 PATH 中的 node）
- [ ] Bridge 使用 bundled Node + `resources/bridge/server.mjs`
- [ ] macOS / Windows / Linux 各平台至少 smoke 一次（CI 矩阵或本地）

## 运行时对照

| 项 | 实现 |
|----|------|
| 业务逻辑 | `cli/lib/desktop-handlers.mjs`（Node bridge） |
| 原生对话框 | Tauri dialog plugin |
| 打开浏览器 | opener plugin |
| Reveal 路径 | `reveal_item_in_dir` |
| Node 运行时 | Release 打包 portable Node 20 |

## 已知限制

- CI 未配置代码签名（Apple / Windows）
- macOS CI 仅 `arm64`；Intel 需 `SKB_NODE_TARGET=darwin-x64 pnpm build`
- 完整 UI E2E（Playwright 打 Tauri 窗口）未纳入 CI；可选后续对 bridge HTTP 做 Playwright
