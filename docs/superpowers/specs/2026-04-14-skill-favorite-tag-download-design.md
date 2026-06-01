# Skill 收藏、下载统计、标签与数据库升级设计

## 背景

当前 Skill Base 的 Web 端已经有 Skill 列表和详情页，但缺了几块很实际的能力：

1. 用户不能收藏 Skill，首页也不能筛出已收藏的 Skill
2. 系统没有收藏数量，也没有下载次数统计
3. Skill 没有标签体系，无法按统一标签组织
4. 当前只有 `admin` 角色，没有“初始化时那个管理员”的明确数据标记
5. 详情页预览版本内容时直接调用下载接口，导致“查看”和“下载”混在一起
6. 数据库升级还停留在 `ALTER TABLE ... try/catch` 级别，已经不够支撑新增关系和权限边界

这不是多做几个按钮就能糊过去的功能。问题的核心是数据结构没立住。数据结构不清楚，接口、权限、前端状态都会一起烂。

## 目标

本次设计只做下面几件事：

1. 支持登录用户收藏和取消收藏 Skill
2. 支持首页筛选“仅收藏”的 Skill
3. 记录并展示 Skill 收藏数
4. 记录并展示 Skill 总下载数和每个版本的下载次数
5. 增加全局标签库与 Skill 标签关系
6. 只有超级管理员可以管理全局标签
7. Skill 管理者只能给 Skill 绑定或解绑现有标签
8. 把“初始化创建的管理员”落成明确的超级管理员数据
9. 启动时自动完成旧数据库升级，保持兼容
10. 拆开“查看版本内容”和“下载版本 ZIP”两个行为，查看不计下载

## 非目标

这次明确不做：

1. 不做本地浏览器收藏，收藏必须跟账号绑定
2. 不做下载明细日志、下载历史报表、去重下载统计
3. 不做标签审核流、标签层级、标签别名、标签颜色
4. 不做单文件查看接口
5. 不在服务端解压 ZIP 并维护临时目录
6. 不新增新的用户角色类型
7. 不重做现有用户管理权限模型，只补超级管理员标记

## 数据结构

### 用户

在 `users` 表上新增字段：

```sql
users.is_super_admin INTEGER NOT NULL DEFAULT 0
```

约束：

1. 初始化创建的管理员必须写入 `is_super_admin = 1`
2. 旧库升级时，从现有 `role = 'admin'` 的用户中，按 `created_at ASC, id ASC` 选第一位补成超级管理员
3. 系统中必须始终至少保留一个超级管理员

这里不新建 `super_admin` 角色。角色和权限位是两回事。为了一个边界再造一套 role，只会把代码搞复杂。

### 收藏

新增表：

```sql
CREATE TABLE skill_favorites (
    user_id     INTEGER NOT NULL,
    skill_id    TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, skill_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);
```

在 `skills` 表上新增字段：

```sql
skills.favorite_count INTEGER NOT NULL DEFAULT 0
```

约束：

1. 一个用户对同一个 Skill 最多只有一条收藏记录
2. `skills.favorite_count` 必须等于 `skill_favorites` 中该 Skill 的记录数
3. 收藏和取消收藏必须在事务内同时维护关系表和计数字段

### 下载统计

在 `skills` 表上新增字段：

```sql
skills.download_count INTEGER NOT NULL DEFAULT 0
```

在 `skill_versions` 表上新增字段：

```sql
skill_versions.download_count INTEGER NOT NULL DEFAULT 0
```

约束：

1. 下载统计口径是“每次下载都累加”
2. 只在下载接口累加，不在查看接口累加
3. 每次成功命中下载逻辑后，同时增加 Skill 总下载数和版本下载数

这次不建下载事件表。需求只有计数，没有审计。为了“也许以后要分析”而多加一张日志表，是纯粹的未来式废话。

### 标签

新增全局标签表：

```sql
CREATE TABLE tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by  INTEGER NOT NULL,
    updated_by  INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);
```

新增 Skill 标签关系表：

```sql
CREATE TABLE skill_tags (
    skill_id     TEXT NOT NULL,
    tag_id       INTEGER NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by   INTEGER NOT NULL,
    PRIMARY KEY (skill_id, tag_id),
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
```

约束：

1. 标签名全局唯一
2. 同一个 Skill 不能重复绑定同一个标签
3. 删除标签时自动清理 `skill_tags`
4. 删除 Skill 时自动清理 `skill_tags`

这次不加 `slug`、颜色、描述。现在根本没这个需求，别先把系统做成 CMS。

## 权限模型

### 超级管理员

超级管理员通过 `users.is_super_admin = 1` 判定，不新增新的角色字段。

超级管理员权限：

1. 管理全局标签库
2. 查看标签列表与使用情况
3. 创建、重命名、删除标签
4. 继续拥有现有 `admin` 能做的事

### Skill 管理者

Skill 的 `owner` 和 `collaborator` 继续通过 `skill_collaborators` 关系判定。

Skill 管理者权限：

1. 可给自己可管理的 Skill 绑定或解绑已有标签
2. 不可创建新标签
3. 不可修改标签名称
4. 继续保留现有 Skill 管理能力

### 普通登录用户

普通登录用户权限：

1. 可收藏和取消收藏 Skill
2. 可查看收藏状态、收藏数、下载数、标签

### 未登录用户

未登录用户权限：

1. 可查看公开 Skill 列表、详情、标签、收藏数、下载数
2. 不可收藏

## API 设计

### Skill 列表与详情

扩展现有返回字段：

```json
{
  "id": "skill-id",
  "name": "Skill Name",
  "description": "desc",
  "latest_version": "v20260414.120000",
  "favorite_count": 3,
  "download_count": 21,
  "is_favorited": true,
  "tags": [
    { "id": 1, "name": "frontend" },
    { "id": 2, "name": "vue" }
  ]
}
```

规则：

1. `favorite_count`、`download_count`、`tags` 总是返回
2. `is_favorited` 仅登录用户返回；未登录时可省略或返回 `false`，但前后端要统一
3. `GET /api/v1/skills` 和 `GET /api/v1/skills/:skill_id` 返回结构保持一致

### 收藏接口

新增：

1. `POST /api/v1/skills/:skill_id/favorite`
2. `DELETE /api/v1/skills/:skill_id/favorite`

返回：

```json
{
  "ok": true,
  "skill_id": "skill-id",
  "favorited": true,
  "favorite_count": 4
}
```

规则：

1. 只有登录用户可以调用
2. 重复收藏必须幂等，不能重复插入
3. 重复取消收藏必须幂等，不能把计数减成负数

### 版本列表接口

保留：

1. `GET /api/v1/skills/:skill_id/versions`

扩展每个版本返回字段：

```json
{
  "id": 10,
  "version": "v20260414.120000",
  "description": "desc",
  "changelog": "notes",
  "download_count": 7
}
```

规则：

1. 只返回版本列表元信息
2. 不返回文件树
3. 不读取 ZIP 内容

`/versions` 的职责就是“列版本”。把 ZIP 文件树塞进去，只会把列表接口搞成垃圾桶。

### 查看接口

新增：

1. `GET /api/v1/skills/:skill_id/versions/:version/view`

行为：

1. 返回与下载接口相同的 ZIP 二进制流
2. 不累加 Skill 下载数
3. 不累加版本下载数

目的：

1. 前端继续沿用当前“拉 ZIP 到浏览器后自己解压预览”的方式
2. 把“查看”和“下载计数”彻底拆开

### 下载接口

保留：

1. `GET /api/v1/skills/:skill_id/versions/:version/download`

行为：

1. 返回 ZIP 二进制流
2. 命中该接口时累加：
   - `skills.download_count += 1`
   - `skill_versions.download_count += 1`

### 标签管理接口

新增全局标签接口，仅超级管理员可用：

1. `GET /api/v1/tags`
2. `POST /api/v1/tags`
3. `PATCH /api/v1/tags/:tag_id`
4. `DELETE /api/v1/tags/:tag_id`

返回的标签对象可包含：

```json
{
  "id": 1,
  "name": "frontend",
  "usage_count": 12
}
```

`usage_count` 只用于后台展示，可查询聚合得到，不需要单独存列。

### Skill 标签绑定接口

新增：

1. `PUT /api/v1/skills/:skill_id/tags`

请求体：

```json
{
  "tag_ids": [1, 2, 3]
}
```

行为：

1. 用“整体替换”方式更新该 Skill 的标签关系
2. 请求体中的标签 ID 必须全部存在
3. 只有可管理该 Skill 的用户可调用
4. 超级管理员也可调用

这里不用拆成 attach/detach 两套接口。前端就是一个多选器，后端整体替换最干净。

## 前端设计

### 首页

`HomeView.vue` 增加：

1. “全部 / 仅收藏”筛选开关
2. Skill 卡片显示：
   - 收藏数
   - 下载数
   - 标签
3. 登录用户可直接在卡片上收藏或取消收藏

筛选顺序：

1. 先按搜索词过滤
2. 再按“仅收藏”过滤 `is_favorited`

数据来源保持单一：

1. 列表直接使用 `skillsStore.skills`
2. 不再复制一份 favorites 列表状态

### 详情页

`SkillDetailView.vue` 增加：

1. 收藏按钮
2. 收藏数展示
3. Skill 总下载数展示
4. 标签展示
5. Skill 管理者可见的标签编辑入口

版本预览行为改为：

1. 选择版本或预览内容时调用 `/view`
2. 点击下载时调用 `/download`

这样“看内容”不计下载，“真下载”才计下载。

### 标签后台管理页

新增页面：

1. `TagManagementView.vue`

新增路由：

1. `/admin/tags`

入口：

1. 与现有 `/admin/users` 并列

功能：

1. 查看标签列表
2. 新建标签
3. 重命名标签
4. 删除标签
5. 查看每个标签的使用数

## 数据库升级设计

### 基本原则

当前的 `database.js` 已经开始靠 `ALTER TABLE ... try/catch` 顶着走，但这套东西撑不到这里。

本次升级后，数据库必须支持显式 migration。

新增表：

```sql
CREATE TABLE schema_migrations (
    version     TEXT PRIMARY KEY,
    applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

启动流程：

1. 打开数据库
2. 确保 `schema_migrations` 存在
3. 按版本顺序执行未应用 migration
4. 成功后写入 `schema_migrations`

### 本次 migration

新增 migration，例如：

```text
005-skill-favorites-tags-downloads-super-admin
```

至少包含：

1. 给 `users` 增加 `is_super_admin`
2. 给 `skills` 增加 `favorite_count`
3. 给 `skills` 增加 `download_count`
4. 给 `skill_versions` 增加 `download_count`
5. 创建 `skill_favorites`
6. 创建 `tags`
7. 创建 `skill_tags`
8. 创建相关索引
9. 回填超级管理员
10. 校正计数字段默认值

### 迁移回填规则

1. `favorite_count` 初始按 `skill_favorites` 聚合回填
2. `download_count` 初始全部为 `0`
3. `is_super_admin` 从最早的 admin 回填一个
4. 迁移必须可安全执行一次，不允许半途写脏数据

### 索引

建议新增：

1. `idx_skill_favorites_skill_id`
2. `idx_skill_favorites_user_id`
3. `idx_skill_tags_tag_id`
4. `idx_tags_name`

## 行为约束

必须保证以下边界：

1. 重复收藏不会重复计数
2. 重复取消收藏不会把计数减成负数
3. 查看版本不会增加下载次数
4. 下载版本会同时增加 Skill 和版本下载次数
5. 删除标签会自动清理 Skill 标签关系
6. Skill 管理者只能绑定已有标签，不能创建标签
7. 不能删除最后一个超级管理员
8. 不能禁用最后一个超级管理员

## 测试

新增测试应只覆盖容易回归的边界：

1. 收藏接口：
   - 首次收藏成功
   - 重复收藏幂等
   - 取消收藏成功
   - 重复取消收藏幂等
2. 下载统计：
   - 调用 `/view` 不增加下载数
   - 调用 `/download` 增加 Skill 和版本下载数
3. 标签权限：
   - 超级管理员可创建/删除标签
   - 普通 admin 不可管理全局标签
   - Skill 管理者可绑定已有标签
   - Skill 管理者不可创建标签
4. 数据库迁移：
   - 旧库启动时自动补齐新表和新字段
   - 最早 admin 被回填为超级管理员
5. 超级管理员保护：
   - 最后一个超级管理员不可删除
   - 最后一个超级管理员不可禁用

不补一堆 UI 快照测试。那种测试既不说明边界，也不说明逻辑，只会制造噪音。

## 验收标准

满足以下条件即视为完成：

1. 登录用户可收藏和取消收藏 Skill
2. 首页可筛选出已收藏的 Skill
3. 首页和详情页可展示收藏数、下载数、标签
4. 详情页预览版本时使用 `/view`，不会增加下载次数
5. 用户点击下载时会正确增加 Skill 和版本下载次数
6. 超级管理员可管理全局标签
7. Skill 管理者可为 Skill 绑定已有标签
8. 旧数据库启动后可自动升级，不需要手工执行命令
9. 初始化创建的管理员在数据库里被明确标记为超级管理员
