# Skill 多人维护：发布审核与「合并」界面设计

**日期**: 2026-04-19  
**状态**: 设计稿（未实现）  
**范围**: Web 管理端信息架构、审核/合并一屏、与现有 API/页面关系、后端要点与分期。

---

## 1. 背景与目标

Skill 被多人维护时，需要：**publish 后先进入待审状态，经 review 再合并为「最终对外发布」**。

本设计中的「合并」**不是** Git 三路合并，而是 **整包 zip 版本** 的发布决策：把 **`skills.latest_version`（Head）** 从当前线上版本推进到已通过审核的版本。

### 数据不变量（建议写死）

1. **`latest_version`（Head）= 对外「安装 latest」的版本**（与 CLI `skb install` 使用详情里的 `latest_version` 再下载一致）。
2. **待审版本**是 `skill_versions` 中的一条记录，带有明确状态（如 `pending` / `approved` / `rejected`，具体枚举实现时定）。

「合并 / 发布」= 审核通过 = 后端原子地：**将 Head 指向该版本**，并更新该版本（或队列）状态；**不是**在 UI 里合文件。

---

## 2. 与现有代码的关系

| 能力 | 位置 | 说明 |
|------|------|------|
| 发布后立刻改 Head | `src/utils/publish-skill.js` 中 `SkillModel.updateLatestVersion` | 引入审核后需拆分：**写版本** ≠ **推进 Head** |
| 手动改 Head | `PUT /skills/:skill_id/head`（`src/routes/skills.js`） | 语义可复用为「审核通过」；需防止绕过策略时滥用 |
| 版本时间线 + Set Head | `web/src/views/SkillDetailView.vue` | 审核入口与 Head 文案与此统一 |
| 两版本 zip diff | `web/src/views/DiffView.vue`，路由 `/diff` | 审核屏对比区应复用或内嵌相同逻辑 |

**已知一致性问题（实现审核时应顺带统一）**  

`GET .../versions/latest/download` 使用按时间排序的 `VersionModel.getLatest`，与 `skills.latest_version` 可能不一致。审核上线后，应对外统一「latest」语义：**以 Head 为准**（与 CLI 一致）。

---

## 3. 信息架构（入口）

以 **Skill 详情** 为枢纽，少建新岛。

| 入口 | 受众 | 说明 |
|------|------|------|
| 详情顶栏或版本区 **「待发布 (n)」徽章** | 协作者 + owner | 有队列时可见 |
| 详情内 **「审核」Tab 或折叠面板** | 同上 | MVP 可不做新路由 |
| 可选：`/skills/:id/review` | 同上 | 需要深链接、分享审核链接时增加 |

匿名用户 **不进入**审核台；是否展示「存在待审」由 §5 策略决定。

---

## 4. 核心界面：「审核发布」单页（推荐）

### 4.1 布局：单页三段式

**上：上下文条**

- Skill 名称、`skill_id`
- **当前 Head**（线上）：版本号、（可选）上传者与时间
- **待审候选**：版本号、提交者、提交时间
- 若无待审（或 head 已等于候选）：文案「无待审核版本」，主按钮禁用

**中：对比区**

- 默认 **Base = 当前 Head**，**New = 待审版本**
- 复用现有 diff：从 `DiffView` 抽**可复用对比组件**，或通过 query 跳转 `/diff`（与详情已有 `version_a` / `version_b` 模式对齐）
- 简短说明：**Head 与「按上传时间最新」不一定相同**（避免用户误解）

**下：决策区**

- 主按钮：**「发布为最新（移动 Head）」** → 二次确认 Modal：明确「安装 `latest` 的用户将收到该版本」
- 次按钮：**「拒绝」** → 建议**必填**短原因（一行），状态为 `rejected`，**不**修改 Head
- 可选：单条 **审核备注**（无通知系统时不要做线程回复）

### 4.2 权限（最小模型）

- **发布 / 拒绝**：与现有 **`canManageSkill`**（owner / admin）一致。
- 协作者：**查看** diff 与队列（若产品需要），**不可**改 Head（除非后续引入「approver」角色）。

---

## 5. 可见性策略（三选一，实现时不要混用）

**A. 严格模式（推荐默认）**

- pending **不参与**对外「可安装 latest」；匿名不展示待审细节。
- 协作者可见队列与审核入口。

**B. 透明模式**

- 匿名可感知「有待发布更新」，但 **install latest 仍只认 Head**；文案成本更高。

**C. 极简模式（最快 MVP）**

- 不单独做队列表：publish 只追加版本、**不自动更新 Head**；「合并界面」= Head 选择器 + Diff + 确认。
- 多笔 pending 时需业务规则（例如「永远只认最新一条 pending」），否则必须上队列 UI。

---

## 6. 待审队列：单条 vs 多条

| 模式 | UI | 复杂度 |
|------|-----|--------|
| **同一 skill 同时仅允许一条 pending** | 永远是 Head vs「那一条」待审 | 低，**推荐默认** |
| 多条 pending | 列表 → 选一条 → 再进对比与决策 | 高 |

**建议**：首版采用 **单 pending**；新 publish 策略二选一写进 spec：**顶掉旧 pending** 或 **拒绝旧的后才能提交新的**（实现前产品拍板）。

---

## 7. 与 Skill 详情时间线的统一

详情页已有 **Head** 标记与 **「设为 Head」**（`setHeadVersion`）。

- **「设为 Head」**：应急或「无审核」skill 的手动指针；有审核策略时建议 **仅 owner 或 admin** 可见，避免绕过队列。
- **「发布待审版本」**：有审核时的主路径；通过后与 `PUT head` 后端语义一致。

时间线每条版本建议展示 **状态 chip**：Head / 待审 / 已拒绝 / 历史；待审行可提供 **「去审核」** 跳转或锚点到审核面板。

---

## 8. 后端 / API 规划（支撑 UI 的最小集）

1. **`GET /skills/:id/review`**（或合并进详情 DTO）  
   - 返回：`head_version`、`pending_version | null`、`pending` 元数据（提交者、changelog、时间等）。
2. **`POST /skills/:id/review/approve`**，`body: { version }`  
   - 校验 `version` 为当前 pending；**原子**更新 Head 与状态。
3. **`POST /skills/:id/review/reject`**，`body: { version, reason }`  
4. **Publish 路径**：在启用审核的 skill 上，**插入版本后默认不更新 Head**（或插入 `pending` 行后再由 approve 推进）。

**Webhook**：建议区分 **提交待审** 与 **已上线**（例如 `version.submitted` / `version.published`），避免订阅方把「上传」误当「对外发布」。

---

## 9. 实施切片（里程碑）

| 阶段 | 内容 |
|------|------|
| **M1** | 后端 pending + publish 不自动 Head；审核 UI **仅「通过 = 移动 Head」**（拒绝可后置） |
| **M2** | 拒绝 + 原因 + 时间线状态 chip |
| **M3** | Diff 组件化/内嵌，默认 Base=Head、New=候选 |
| **M4** | 路由 `/skills/:id/review`、外部通知（邮件/飞书等，按需） |

---

## 10. 开放决策（实现前需产品确认）

1. **单 pending vs 多 pending**（§6）。  
2. **可见性**选 A / B / C（§5）。  
3. 新 publish 与已有 pending **冲突时**的处理：顶掉、拒绝、还是允许多条队列。

---

## 修订记录

- 2026-04-19：初稿，合并对话中的可行性结论与 UI/API/分期规划。
