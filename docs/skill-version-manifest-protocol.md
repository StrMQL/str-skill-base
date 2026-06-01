# Skill 版本：从「ZIP 包」到「结构化 Manifest」

本文记录对 Skill Base 演进方向的设计讨论：**版本不应等价于一个 ZIP 文件**，而应等价于一份可校验的 **Manifest**；ZIP 仅作为传输用的 **Artifact**；本地目录是 Manifest 的 **物化视图（materialized view）**，可用链接或内容寻址避免重复与冲突。

---

## 1. 背景与问题

### 1.1 当前模型（简化）

- 服务端以 `skill_id` + `version` 为主键，版本实体上绑定 **一个 ZIP 路径**（及 changelog 等元数据）。
- 客户端典型流程：**下载 ZIP → 解压到安装目录**。

### 1.2 局限

- **语义混叠**：`version` 同时承担了「发布编号」「传输载体」「本地目录含义」，扩展（去重、依赖、增量、多镜像）时负担集中在一层。
- **本地目录即真相**：不同 Agent / 工具若共享同一套「按目录名」的规则，易出现 **重名覆盖**；若完全各自为政，则 **生态碎片化**。
- **可验证性弱**：ZIP 是黑盒；没有稳定的「版本 = 内容摘要 + 文件清单」这一层。

### 1.3 目标（非破坏式演进）

- 旧数据与旧 API 可继续工作；新能力通过 **增量字段与新端点** 引入。
- 先解决 **「版本的语义」**，再谈更重的依赖图、全局注册表等。

---

## 2. 核心数据模型

建议把概念拆成四层，边界清晰：

| 概念 | 含义 |
|------|------|
| **SkillVersion** | 逻辑版本：`skill_id` + `version`，指向某次发布的 **Manifest**。 |
| **Manifest** | 机器可读清单：`schema_version`、身份、元数据、**文件列表 + digest**、入口（如 `SKILL.md`）、可选依赖占位。 |
| **Artifact** | 传输载体：例如 `application/zip` + digest +（可选）`fetch_url`。ZIP 只是其中一种 Artifact。 |
| **MaterializedDir** | 客户端或服务端根据 Manifest **展开出的目录树**；可 symlink / hardlink / copy 到内容寻址存储。 |

### 2.1 建议的不变量

1. **身份与定位解耦**：`skill_id` + `version` 是站点内逻辑身份；**URL 是 locator，不是唯一身份**（除非规范化为带命名空间与校验和的引用）。
2. **Manifest 为版本真相**：同一 Manifest digest 即同一内容版本；目录树应能由 Manifest 完整重现。
3. **ZIP 非版本本体**：ZIP 是 Artifact；**版本 = Manifest（+ 其引用的 blob digest）**。
4. **本地目录是缓存视图**：`installed/<skill_id>/current` 或 `materialized/<skill_id>/<version>/` 指向 **物化结果**，不应再承担「唯一存储真相」。

---

## 3. 最小 Manifest 草案（示例）

以下为 **最小可用** JSON 形状，便于与现有 `SKILL.md` + ZIP 发布流程并存；字段名可在落地时微调。

```json
{
  "schema_version": 1,
  "skill_id": "example-skill",
  "version": "v20260415.120000",
  "entrypoints": {
    "skill_md": "SKILL.md"
  },
  "files": [
    {
      "path": "SKILL.md",
      "digest": "sha256:…",
      "size": 1234,
      "media_type": "text/markdown"
    }
  ],
  "artifacts": [
    {
      "kind": "zip",
      "digest": "sha256:…",
      "size": 456789,
      "relative_path": "v20260415.120000.zip"
    }
  ]
}
```

说明：

- `files`：逻辑文件系统，用于校验与增量/去重。
- `artifacts`：保留现有「整包 ZIP」路径时的兼容描述；客户端可仍从 ZIP 拉取，但 **以 Manifest 为权威** 决定解压布局与校验。

---

## 4. 服务端演进方向（与 Skill Base 对齐）

### 4.1 存储与数据库

在现有 `versions` 记录上 **增量** 扩展，例如：

- `manifest_json` 或 `manifest_path`（指向 `data/` 下单独 JSON 文件）
- `manifest_digest`
- `storage_kind`：`zip_only` | `manifest+zip`（命名可再议）

旧版本仅有 ZIP：可在 **读路径** 按需生成 Manifest（首次访问时计算并缓存），或离线批处理回填。

### 4.2 API

- 在 **GET 某 skill 的某 version** 的响应中增加：`manifest` 或 `manifest_url`（大 manifest 时分文件）。
- 保留 **GET download** 返回 ZIP；可增加 **GET manifest** 专用端点（若与列表响应分离更清晰）。

具体路径与字段以最终实现和 `docs/api.md` 为准；本文只固定 **语义层**。

---

## 5. 客户端与本地布局（CLI / Agent）

### 5.1 推荐目录结构（概念）

```text
~/.skill-base/   （或项目约定的 cache 根）
  objects/sha256/…/          # 按 digest 存放 blob（可选）
  manifests/<digest>.json  # 缓存的 manifest
  materialized/<skill_id>/<version>/   # 物化目录树（或链接到 objects）
  installed/<skill_id>/current -> …     # 当前选用版本
```

### 5.2 「目录链接化」

- **Unix**：优先 symlink 到内容寻址对象，避免重复解压。
- **Windows**：无权限时降级为复制；协议层不变。

### 5.3 安装流程（目标状态）

1. 解析 `skill_id` + `version`，拉取 **Manifest**。
2. 校验 `files[].digest`（从 ZIP 或逐文件 URL 获取时均校验）。
3. 写入 `objects/`（若采用内容寻址），生成 `materialized/...`。
4. 更新 `current` 指针。

---

## 6. 迁移路径（务实顺序）

1. **发布时生成 Manifest**：上传 ZIP 成功后，服务端扫描 ZIP 内文件，计算 digest，写入 DB 或旁路 JSON。
2. **API 暴露 Manifest**：列表/详情接口带上 `manifest_digest` 或内联小 Manifest。
3. **CLI 优先消费 Manifest**：仍可用 ZIP 作为唯一下载源，但安装逻辑以 Manifest 为准。
4. **客户端对象存储与物化**：去重与链接化。
5. 再考虑 **多 Artifact、依赖、镜像** 等（YAGNI：无真实需求前不扩张 schema）。

---

## 7. 与「仅 URL / Wiki 化」的关系

- **URL** 适合作为 **发现与分发入口**，解决多 Agent 目录冲突的一种引用方式。
- **单靠 URL** 不足以表达：版本钉扎、内容完整性、离线缓存、迁移与镜像。
- 推荐组合：**命名空间 + Manifest + digest** 作为身份与完整性层，**URL** 作为可选 locator；本地目录仅为物化视图。

---

## 8. 文档维护

- 若本设计进入实现阶段，应同步更新：`docs/api.md`、CLI 文档 `docs/cli.md`、`README.md` / `docs/README.zh.md` 中与「版本与下载」相关的章节。

---

我觉得现在的agent skills的形式并不完美，claude code之前应该也没有想到skills会这么火，导致这么多agent 工具都支持，引起了极其严重的碎片化问题。但如果所有agent都统一目录则更难办，每个agent都会自带自己的agent，说不定有的agent重名，A Agent的skill覆盖掉B agen 的skill，导致出现skill丢失问题，我觉得最好的方式还是url化，wiki化，只给LLM一个url，这样就能保证互不影响，解决碎片化问题。你认为呢？

---

我可能没说完让你误会了，我的意思是把现在的应用改造一下，现在用版本号拿的是zip包，然后放到本地。理想情况应该是给版本号，拿到你所说的那些东西，更结构化的协议，把版本对应目录链接化。

*记录日期：2026-04-15*
