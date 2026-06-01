# Skill Webhook 权限与安全修正规格

## 背景

当前 Skill Webhook 功能已经接上了基本数据流，但边界没有收干净：

1. 前后端对谁能配置 `webhook_url` 的理解不一致
2. `webhook_url` 的发送目标缺少最基本的 SSRF 防护
3. 缺少针对这次行为变更的聚焦回归测试

这不是功能缺失，而是边界不严。边界不严，代码迟早出事。

## 目标

本次修正只做三件事：

1. 明确 `webhook_url` 只能由 Skill owner 配置
2. 在不阻断本机开发场景的前提下，增加 Webhook 发送侧 SSRF 防护
3. 增加最小但有效的自动化测试，覆盖权限和安全边界

## 非目标

这次明确不做：

1. 不引入新的 Webhook 事件类型
2. 不做重试队列、签名验签、失败记录面板
3. 不做复杂的域名 allowlist 配置系统
4. 不改现有事件载荷结构
5. 不改变“发送失败不影响主流程”的策略

## 数据与权限

数据结构保持简单，仍然只是在 `skills` 表上使用一个可空字段：

```sql
skills.webhook_url TEXT NULL
```

关系和约束如下：

1. `webhook_url = NULL` 表示该 Skill 未配置 Webhook
2. 只有 `owner` 和 `admin` 可以修改 `webhook_url`
3. 只有 `owner` 和 `admin` 可以在详情接口里看到 `webhook_url`
4. `collaborator` 可以继续发布版本，但不能查看或修改 `webhook_url`
5. 普通用户永远看不到 `webhook_url`

这里不要搞“协作者也许以后也能配”。这就是典型的未来式废话。谁负责这个 Skill，谁配 Webhook。数据责任必须和权限责任对齐。

## SSRF 策略

Webhook 仍然只接受 `http` 或 `https` URL，但发送前增加主机检查。

### 允许

1. `localhost`
2. `127.0.0.1`
3. `::1`
4. 正常公网域名和公网 IP

### 拒绝

1. 私有网段 IPv4：`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`
2. 链路本地 IPv4：`169.254.0.0/16`
3. 未指定地址：`0.0.0.0`
4. 常见云元数据地址：`169.254.169.254`
5. IPv6 链路本地与本地唯一本地地址：`fe80::/10`、`fc00::/7`

### 原则

1. 校验分两层：写入时校验 URL 格式；发送前校验目标主机
2. 不做 DNS 解析，不做外部网络探测
3. 对域名只拦显式危险主机名，比如 `localhost`
4. 对裸 IP 做网段判断

这是最小可维护方案。再复杂就会开始长出一堆配置和例外，最后没人搞得清。

## 行为要求

以下现有行为继续保留：

1. `skill.updated` / `skill.deleted` 事件类型不变
2. 发送仍然是异步 fire-and-forget
3. Webhook 失败不影响更新、发布、删除主流程
4. 仅修改 `webhook_url` 本身时，不触发 Webhook

## 前后端改动范围

### 后端

1. 收紧 `PUT /api/v1/skills/:skill_id` 的 `webhook_url` 权限判定
2. 收紧详情格式化逻辑，只对 `owner/admin` 返回 `webhook_url`
3. 在 `skill-webhook` 工具里增加发送前主机拦截
4. 为安全检查补纯函数级测试，避免把逻辑塞进路由里

### 前端

1. Skill 详情页的 Webhook 配置区只对 owner 显示
2. 协作者不再看到输入框，避免假按钮和 403
3. 不新增额外状态机，不抽新组件

## 测试

新增测试只覆盖真正容易回归的点：

1. `parseWebhookUrlField()` 接受合法 `http/https`，拒绝非法协议
2. 新增的目标主机安全判断：
   - 允许 `localhost`
   - 允许 `127.0.0.1`
   - 拒绝 `192.168.x.x`
   - 拒绝 `10.x.x.x`
   - 拒绝 `172.16.x.x` 到 `172.31.x.x`
   - 拒绝 `169.254.169.254`
3. Skill 格式化/权限相关行为：
   - owner 可见 `webhook_url`
   - collaborator 不可见 `webhook_url`
   - admin 可见 `webhook_url`

不去补一堆 UI 快照测试。那种测试只会制造噪音。

## 验收标准

满足以下条件即视为完成：

1. owner 能配置和清空 `webhook_url`
2. collaborator 看不到 `webhook_url`，也没有可点击的配置入口
3. admin 通过接口可见并可修改 `webhook_url`
4. `localhost` 目标不会被拦
5. 私有网段和元数据地址不会被发送
6. 相关聚焦测试通过
