# Skill Webhook Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收紧 Skill Webhook 的 owner/admin 权限边界，增加最小 SSRF 发送防护，并补聚焦回归测试。

**Architecture:** 继续复用现有 `skills.webhook_url` 字段，不引入新表或新服务。后端把“格式校验”和“发送目标安全校验”分开；前端只收口可见性；测试集中覆盖纯函数和权限显示边界。

**Tech Stack:** Node.js, Fastify, SQLite, Vue 3, Pinia, node:test

---

### Task 1: 补失败测试锁定边界

**Files:**
- Modify: `tests/model-cache.test.js`
- Test: `tests/model-cache.test.js`

- [ ] **Step 1: 写失败测试**

```js
test('skill webhook helpers accept localhost but reject private network targets', () => {
  const webhook = require('../src/utils/skill-webhook');

  assert.equal(webhook.parseWebhookUrlField('http://localhost:8787/hook').ok, true);
  assert.equal(webhook.isSafeWebhookTarget('http://localhost:8787/hook'), true);
  assert.equal(webhook.isSafeWebhookTarget('http://127.0.0.1:8787/hook'), true);
  assert.equal(webhook.isSafeWebhookTarget('http://192.168.1.8/hook'), false);
  assert.equal(webhook.isSafeWebhookTarget('http://10.0.0.8/hook'), false);
  assert.equal(webhook.isSafeWebhookTarget('http://172.16.0.8/hook'), false);
  assert.equal(webhook.isSafeWebhookTarget('http://169.254.169.254/latest/meta-data'), false);
});

test('skill detail exposes webhook_url only to owner or admin', () => {
  const { tempDir, dbPath } = createFixture();

  try {
    const { db, SkillModel } = loadFreshModels(dbPath);
    const { aliceId, bobId } = seedUsers(db);
    const admin = db.prepare(`
      INSERT INTO users (username, password_hash, role, name, status, created_at, updated_at)
      VALUES ('root', 'hash', 'admin', 'Root', 'active', datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO skills (id, name, description, latest_version, owner_id, webhook_url, created_at, updated_at)
      VALUES ('skill-a', 'Skill A', 'First skill', 'v1', ?, 'http://localhost:8787/hook', datetime('now'), datetime('now'))
    `).run(aliceId);
    db.prepare(`
      INSERT INTO skill_collaborators (skill_id, user_id, role, created_by)
      VALUES ('skill-a', ?, 'owner', ?), ('skill-a', ?, 'collaborator', ?)
    `).run(aliceId, aliceId, bobId, aliceId);

    const { formatSkill } = require('../src/routes/skills');
    const skill = SkillModel.findById('skill-a');

    assert.equal(formatSkill(skill, { id: aliceId, role: 'developer' }).webhook_url, 'http://localhost:8787/hook');
    assert.equal(Object.hasOwn(formatSkill(skill, { id: bobId, role: 'developer' }), 'webhook_url'), false);
    assert.equal(formatSkill(skill, { id: admin.lastInsertRowid, role: 'admin' }).webhook_url, 'http://localhost:8787/hook');
  } finally {
    destroyFixture(tempDir);
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/model-cache.test.js`
Expected: FAIL because `isSafeWebhookTarget` and exported `formatSkill` behavior do not exist yet.

- [ ] **Step 3: 写最小实现让测试通过**

```js
// src/utils/skill-webhook.js
function isSafeWebhookTarget(urlString) { /* localhost allowed, private IPs blocked */ }

// src/routes/skills.js
module.exports = skillsRoutes;
module.exports.formatSkill = formatSkill;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/model-cache.test.js`
Expected: PASS

### Task 2: 收紧后端权限和发送拦截

**Files:**
- Modify: `src/routes/skills.js`
- Modify: `src/utils/skill-webhook.js`

- [ ] **Step 1: 写失败测试或在现有失败测试基础上确认权限边界**

Run: `node --test tests/model-cache.test.js`
Expected: FAIL on collaborator visibility / safe target assertions before code fix.

- [ ] **Step 2: 写最小实现**

```js
// src/routes/skills.js
if (currentUser?.role === 'admin') {
  result.permission = 'owner';
}
if (currentUser && (result.permission === 'owner' || currentUser.role === 'admin')) {
  result.webhook_url = skill.webhook_url || null;
}

// src/utils/skill-webhook.js
function notifySkillWebhook(skillRow, event, data, actor) {
  const url = skillRow && skillRow.webhook_url;
  if (!url || !isValidWebhookUrl(url) || !isSafeWebhookTarget(url)) return;
  // existing async POST
}
```

- [ ] **Step 3: 跑聚焦测试**

Run: `node --test tests/model-cache.test.js`
Expected: PASS

### Task 3: 收前端 owner 入口

**Files:**
- Modify: `web/src/views/SkillDetailView.vue`

- [ ] **Step 1: 直接改模板条件**

```vue
<div v-if="skillsStore.isOwner" class="px-5 pb-4 border-t border-base-800 pt-4">
  <!-- existing webhook form -->
</div>
```

- [ ] **Step 2: 清掉明显噪音**

```vue
<div v-for="v in versions" :key="v.id">
```

- [ ] **Step 3: 检查 lint**

Run: `ReadLints` on `web/src/views/SkillDetailView.vue`
Expected: no new diagnostics caused by this edit

### Task 4: 最终验证

**Files:**
- Modify: `docs/api.md`
- Modify: `docs/superpowers/specs/2026-04-14-skill-webhook-hardening-design.md`

- [ ] **Step 1: 同步文档权限描述**

```md
`webhook_url` 仅 owner/admin 可见与可修改。
```

- [ ] **Step 2: 运行聚焦验证**

Run: `node --test tests/model-cache.test.js`
Expected: PASS

- [ ] **Step 3: 检查改动文件 lint**

Run: `ReadLints` on edited frontend files
Expected: no new errors
