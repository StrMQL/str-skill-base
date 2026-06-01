# Skill 收藏、下载统计、标签与版本查看 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Skill Base 增加账号级收藏、下载统计、标签管理、超级管理员标记和不计下载的版本查看接口，并保证旧 SQLite 数据库启动时自动升级。

**Architecture:** 后端以“事实表 + 计数字段”建模：收藏用 `skill_favorites`，标签用 `tags` / `skill_tags`，下载次数直接保存在 `skills` 与 `skill_versions` 上。版本预览继续返回 ZIP 二进制流，但新增 `/view` 接口与 `/download` 分责。前端沿用现有 Pinia + Vue SFC 结构，只扩展 API 类型、store 和页面，不引入额外抽象层。

**Tech Stack:** Node.js, Fastify, node-sqlite3-wasm, Vue 3, Pinia, TypeScript, node:test, vue-tsc

---

## File Map

### Backend

- Modify: `src/database.js`
- Create: `src/migrations/005-skill-favorites-tags-downloads-super-admin.js`
- Create: `src/models/favorite.js`
- Create: `src/models/tag.js`
- Modify: `src/models/skill.js`
- Modify: `src/models/version.js`
- Modify: `src/models/user.js`
- Modify: `src/routes/init.js`
- Modify: `src/routes/skills.js`
- Create: `src/routes/tags.js`
- Modify: `src/routes/users.js`
- Modify: `src/utils/permission.js`
- Modify: `src/index.js`

### Frontend

- Modify: `web/src/services/api.ts`
- Modify: `web/src/stores/auth.ts`
- Modify: `web/src/stores/skills.ts`
- Modify: `web/src/views/HomeView.vue`
- Modify: `web/src/views/SkillDetailView.vue`
- Create: `web/src/views/TagManagementView.vue`
- Modify: `web/src/router/index.ts`
- Modify: `web/src/components/AppNavbar.vue`
- Modify: `web/src/composables/useI18n.ts`

### Tests

- Create: `tests/skill-favorites-tags.test.js`
- Create: `tests/skill-view-download.test.js`
- Create: `tests/super-admin-guard.test.js`
- Modify: `tests/database-adapter.test.js`

### Docs

- Modify: `README.md`
- Modify: `docs/README.zh.md`
- Modify: `docs/api.md`

## Task 1: 建立数据库迁移与新表结构

**Files:**
- Create: `src/migrations/005-skill-favorites-tags-downloads-super-admin.js`
- Modify: `src/database.js`
- Modify: `tests/database-adapter.test.js`
- Test: `tests/database-adapter.test.js`

- [ ] **Step 1: 写失败的数据库迁移测试**

```js
test('database migration adds super admin, favorites, downloads, and tags schema', () => {
  const { tempDir, dbPath } = createFixture();

  try {
    const db = loadFreshDatabase(dbPath);

    const usersColumns = db.prepare("PRAGMA table_info(users)").all();
    const skillsColumns = db.prepare("PRAGMA table_info(skills)").all();
    const versionsColumns = db.prepare("PRAGMA table_info(skill_versions)").all();
    const tables = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('schema_migrations', 'skill_favorites', 'tags', 'skill_tags')
      ORDER BY name
    `).all();

    assert.ok(usersColumns.some((col) => col.name === 'is_super_admin'));
    assert.ok(skillsColumns.some((col) => col.name === 'favorite_count'));
    assert.ok(skillsColumns.some((col) => col.name === 'download_count'));
    assert.ok(versionsColumns.some((col) => col.name === 'download_count'));
    assert.deepEqual(tables, [
      { name: 'schema_migrations' },
      { name: 'skill_favorites' },
      { name: 'skill_tags' },
      { name: 'tags' }
    ]);
  } finally {
    destroyFixture(tempDir);
  }
});

test('database migration backfills the earliest admin as super admin', () => {
  const { tempDir, dbPath } = createFixture();

  try {
    const sqlite = execFileSync('which', ['sqlite3'], { encoding: 'utf8' }).trim();
    execFileSync(sqlite, [
      dbPath,
      `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          role TEXT DEFAULT 'developer',
          name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users (username, password_hash, role, created_at)
        VALUES
          ('first-admin', 'hash', 'admin', '2026-04-01 00:00:00'),
          ('later-admin', 'hash', 'admin', '2026-04-02 00:00:00');
      `
    ]);

    const db = loadFreshDatabase(dbPath);
    const admins = db.prepare(`
      SELECT username, is_super_admin
      FROM users
      WHERE role = 'admin'
      ORDER BY created_at ASC, id ASC
    `).all();

    assert.deepEqual(admins, [
      { username: 'first-admin', is_super_admin: 1 },
      { username: 'later-admin', is_super_admin: 0 }
    ]);
  } finally {
    destroyFixture(tempDir);
  }
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test -- tests/database-adapter.test.js`

Expected: FAIL，报错缺少 `is_super_admin`、`skill_favorites` 或 `schema_migrations`

- [ ] **Step 3: 以最小实现增加 migration 入口和 005 migration**

```js
// src/migrations/005-skill-favorites-tags-downloads-super-admin.js
function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0;
  `);

  db.exec(`
    ALTER TABLE skills ADD COLUMN favorite_count INTEGER NOT NULL DEFAULT 0;
  `);

  db.exec(`
    ALTER TABLE skills ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0;
  `);

  db.exec(`
    ALTER TABLE skill_versions ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_favorites (
      user_id INTEGER NOT NULL,
      skill_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, skill_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER NOT NULL,
      updated_by INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_tags (
      skill_id TEXT NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER NOT NULL,
      PRIMARY KEY (skill_id, tag_id),
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_skill_favorites_skill_id ON skill_favorites(skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_favorites_user_id ON skill_favorites(user_id);
    CREATE INDEX IF NOT EXISTS idx_skill_tags_tag_id ON skill_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
  `);

  db.exec(`
    UPDATE users
    SET is_super_admin = 1
    WHERE id = (
      SELECT id
      FROM users
      WHERE role = 'admin'
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM users WHERE is_super_admin = 1
    );
  `);
}

module.exports = { version: '005-skill-favorites-tags-downloads-super-admin', up };
```

```js
// src/database.js
const migrations = [
  require('./migrations/005-skill-favorites-tags-downloads-super-admin')
];

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

for (const migration of migrations) {
  const row = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(migration.version);
  if (row) continue;

  db.transaction(() => {
    migration.up(db);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
  })();
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `pnpm test -- tests/database-adapter.test.js`

Expected: PASS，新增 schema 和回填超级管理员断言通过

- [ ] **Step 5: 提交**

```bash
git add src/database.js src/migrations/005-skill-favorites-tags-downloads-super-admin.js tests/database-adapter.test.js
git commit -m "feat: add schema migration for favorites tags and download stats"
```

## Task 2: 增加后端模型与权限守卫

**Files:**
- Create: `src/models/favorite.js`
- Create: `src/models/tag.js`
- Modify: `src/models/skill.js`
- Modify: `src/models/version.js`
- Modify: `src/models/user.js`
- Modify: `src/utils/permission.js`
- Create: `tests/skill-favorites-tags.test.js`
- Create: `tests/super-admin-guard.test.js`
- Test: `tests/skill-favorites-tags.test.js`
- Test: `tests/super-admin-guard.test.js`

- [ ] **Step 1: 写 favorites / tags / super admin 失败测试**

```js
test('favorite model toggles rows and keeps counts in sync', () => {
  const db = loadFreshDatabase(dbPath);
  seedUserAndSkill(db);

  const FavoriteModel = require('../src/models/favorite');

  assert.equal(FavoriteModel.isFavorited(1, 'skill-a'), false);
  FavoriteModel.add(1, 'skill-a');
  assert.equal(FavoriteModel.isFavorited(1, 'skill-a'), true);
  assert.equal(db.prepare('SELECT favorite_count FROM skills WHERE id = ?').get('skill-a').favorite_count, 1);
  FavoriteModel.remove(1, 'skill-a');
  assert.equal(db.prepare('SELECT favorite_count FROM skills WHERE id = ?').get('skill-a').favorite_count, 0);
});

test('tag model replaces skill tags with validated global tag ids', () => {
  const db = loadFreshDatabase(dbPath);
  seedUserAndSkill(db);
  const TagModel = require('../src/models/tag');

  const frontend = TagModel.create({ name: 'frontend', actorId: 1 });
  const vue = TagModel.create({ name: 'vue', actorId: 1 });

  TagModel.replaceSkillTags('skill-a', [frontend.id, vue.id], 1);

  const tags = TagModel.listSkillTags('skill-a');
  assert.deepEqual(tags.map((tag) => tag.name), ['frontend', 'vue']);
});

test('user model refuses to disable or delete the last super admin', () => {
  const db = loadFreshDatabase(dbPath);
  seedAdmins(db);
  const UserModel = require('../src/models/user');

  assert.equal(UserModel.canDemoteOrDisableSuperAdmin(1), false);
  assert.equal(UserModel.canDeleteSuperAdmin(1), false);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test -- tests/skill-favorites-tags.test.js tests/super-admin-guard.test.js`

Expected: FAIL，报错 `Cannot find module '../src/models/favorite'` 或缺少超级管理员保护方法

- [ ] **Step 3: 最小实现 FavoriteModel、TagModel 和超级管理员保护**

```js
// src/models/favorite.js
const db = require('../database');

const FavoriteModel = {
  isFavorited(userId, skillId) {
    return !!db.prepare('SELECT 1 FROM skill_favorites WHERE user_id = ? AND skill_id = ?').get(userId, skillId);
  },

  add(userId, skillId) {
    return db.transaction(() => {
      db.prepare(`
        INSERT OR IGNORE INTO skill_favorites (user_id, skill_id)
        VALUES (?, ?)
      `).run(userId, skillId);
      db.prepare(`
        UPDATE skills
        SET favorite_count = (
          SELECT COUNT(*) FROM skill_favorites WHERE skill_id = ?
        )
        WHERE id = ?
      `).run(skillId, skillId);
      return this.isFavorited(userId, skillId);
    })();
  },

  remove(userId, skillId) {
    return db.transaction(() => {
      db.prepare('DELETE FROM skill_favorites WHERE user_id = ? AND skill_id = ?').run(userId, skillId);
      db.prepare(`
        UPDATE skills
        SET favorite_count = (
          SELECT COUNT(*) FROM skill_favorites WHERE skill_id = ?
        )
        WHERE id = ?
      `).run(skillId, skillId);
      return false;
    })();
  }
};

module.exports = FavoriteModel;
```

```js
// src/models/tag.js
const db = require('../database');

const TagModel = {
  create({ name, actorId }) {
    const result = db.prepare(`
      INSERT INTO tags (name, created_by, updated_by)
      VALUES (?, ?, ?)
    `).run(name.trim(), actorId, actorId);
    return db.prepare('SELECT id, name FROM tags WHERE id = ?').get(result.lastInsertRowid);
  },

  replaceSkillTags(skillId, tagIds, actorId) {
    return db.transaction(() => {
      const uniqueTagIds = [...new Set(tagIds)];
      const rows = uniqueTagIds.length
        ? db.prepare(`SELECT id FROM tags WHERE id IN (${uniqueTagIds.map(() => '?').join(',')})`).all(...uniqueTagIds)
        : [];
      if (rows.length !== uniqueTagIds.length) {
        throw new Error('One or more tags do not exist');
      }

      db.prepare('DELETE FROM skill_tags WHERE skill_id = ?').run(skillId);
      const insert = db.prepare(`
        INSERT INTO skill_tags (skill_id, tag_id, created_by)
        VALUES (?, ?, ?)
      `);
      for (const tagId of uniqueTagIds) {
        insert.run(skillId, tagId, actorId);
      }
      return this.listSkillTags(skillId);
    })();
  },

  listSkillTags(skillId) {
    return db.prepare(`
      SELECT t.id, t.name
      FROM skill_tags st
      JOIN tags t ON t.id = st.tag_id
      WHERE st.skill_id = ?
      ORDER BY t.name ASC
    `).all(skillId);
  }
};

module.exports = TagModel;
```

```js
// src/models/user.js
countSuperAdmins() {
  return db.prepare('SELECT COUNT(*) AS count FROM users WHERE is_super_admin = 1').get().count;
},

canDemoteOrDisableSuperAdmin(id) {
  const user = db.prepare('SELECT is_super_admin FROM users WHERE id = ?').get(id);
  if (!user?.is_super_admin) return true;
  return this.countSuperAdmins() > 1;
},

canDeleteSuperAdmin(id) {
  return this.canDemoteOrDisableSuperAdmin(id);
}
```

```js
// src/utils/permission.js
function isSuperAdmin(user) {
  return !!user && user.role === 'admin' && user.is_super_admin === 1;
}

module.exports = {
  hasSkillPermission,
  canPublishSkill,
  canManageSkill,
  isSuperAdmin
};
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `pnpm test -- tests/skill-favorites-tags.test.js tests/super-admin-guard.test.js`

Expected: PASS，收藏、标签和最后一个超级管理员保护断言通过

- [ ] **Step 5: 提交**

```bash
git add src/models/favorite.js src/models/tag.js src/models/skill.js src/models/version.js src/models/user.js src/utils/permission.js tests/skill-favorites-tags.test.js tests/super-admin-guard.test.js
git commit -m "feat: add favorite tag and super admin models"
```

## Task 3: 打通后端路由与下载/查看行为

**Files:**
- Modify: `src/routes/init.js`
- Modify: `src/routes/skills.js`
- Create: `src/routes/tags.js`
- Modify: `src/routes/users.js`
- Modify: `src/index.js`
- Create: `tests/skill-view-download.test.js`
- Modify: `tests/skill-favorites-tags.test.js`
- Test: `tests/skill-view-download.test.js`
- Test: `tests/skill-favorites-tags.test.js`

- [ ] **Step 1: 写失败的路由测试**

```js
test('GET /skills/:id/versions/:version/view returns zip without incrementing download counts', async () => {
  const app = await buildTestApp();
  await seedSkillWithVersion(app);

  const before = app.db.prepare(`
    SELECT s.download_count AS skill_download_count, sv.download_count AS version_download_count
    FROM skills s
    JOIN skill_versions sv ON sv.skill_id = s.id
    WHERE s.id = ? AND sv.version = ?
  `).get('skill-a', 'v20260414.120000');

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/skills/skill-a/versions/v20260414.120000/view'
  });

  const after = app.db.prepare(`
    SELECT s.download_count AS skill_download_count, sv.download_count AS version_download_count
    FROM skills s
    JOIN skill_versions sv ON sv.skill_id = s.id
    WHERE s.id = ? AND sv.version = ?
  `).get('skill-a', 'v20260414.120000');

  assert.equal(response.statusCode, 200);
  assert.equal(after.skill_download_count, before.skill_download_count);
  assert.equal(after.version_download_count, before.version_download_count);
});

test('GET /skills/:id/versions/:version/download increments both download counters', async () => {
  const app = await buildTestApp();
  await seedSkillWithVersion(app);

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/skills/skill-a/versions/v20260414.120000/download'
  });

  const row = app.db.prepare(`
    SELECT s.download_count AS skill_download_count, sv.download_count AS version_download_count
    FROM skills s
    JOIN skill_versions sv ON sv.skill_id = s.id
    WHERE s.id = ? AND sv.version = ?
  `).get('skill-a', 'v20260414.120000');

  assert.equal(response.statusCode, 200);
  assert.equal(row.skill_download_count, 1);
  assert.equal(row.version_download_count, 1);
});

test('super admin can manage tags but normal admin cannot', async () => {
  const app = await buildTestApp();
  const superAdminCookie = await loginAs(app, 'root');
  const adminCookie = await loginAs(app, 'ops-admin');

  const ok = await app.inject({
    method: 'POST',
    url: '/api/v1/tags',
    headers: { cookie: superAdminCookie },
    payload: { name: 'frontend' }
  });

  const forbidden = await app.inject({
    method: 'POST',
    url: '/api/v1/tags',
    headers: { cookie: adminCookie },
    payload: { name: 'backend' }
  });

  assert.equal(ok.statusCode, 201);
  assert.equal(forbidden.statusCode, 403);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test -- tests/skill-view-download.test.js tests/skill-favorites-tags.test.js`

Expected: FAIL，缺少 `/view`、`/tags` 或下载计数断言不成立

- [ ] **Step 3: 最小实现后端接口**

```js
// src/routes/init.js
const result = db.prepare(
  'INSERT INTO users (username, password_hash, role, is_super_admin) VALUES (?, ?, ?, 1)'
).run(username, passwordHash, 'admin');
```

```js
// src/routes/skills.js
const FavoriteModel = require('../models/favorite');
const TagModel = require('../models/tag');

function formatSkill(skill, currentUser) {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    latest_version: skill.latest_version,
    favorite_count: skill.favorite_count || 0,
    download_count: skill.download_count || 0,
    is_favorited: currentUser ? FavoriteModel.isFavorited(currentUser.id, skill.id) : false,
    tags: TagModel.listSkillTags(skill.id),
    owner: { id: skill.owner_id, username: skill.owner_username, name: skill.owner_name },
    created_at: skill.created_at,
    updated_at: skill.updated_at
  };
}

fastify.get('/:skill_id/versions/:version/view', async (request, reply) => {
  const versionRecord = VersionModel.findByVersion(request.params.skill_id, request.params.version);
  if (!versionRecord) return reply.code(404).send({ detail: 'Version not found' });

  const finalZipPath = resolveZipPath(versionRecord.zip_path, request.params.skill_id, versionRecord.version);
  reply.header('Content-Type', 'application/zip');
  reply.header('Content-Disposition', `inline; filename="${request.params.skill_id}-${versionRecord.version}.zip"`);
  return fs.createReadStream(finalZipPath);
});

fastify.post('/:skill_id/favorite', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  FavoriteModel.add(request.user.id, request.params.skill_id);
  const skill = SkillModel.findById(request.params.skill_id);
  return { ok: true, skill_id: skill.id, favorited: true, favorite_count: skill.favorite_count };
});

fastify.delete('/:skill_id/favorite', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  FavoriteModel.remove(request.user.id, request.params.skill_id);
  const skill = SkillModel.findById(request.params.skill_id);
  return { ok: true, skill_id: skill.id, favorited: false, favorite_count: skill.favorite_count };
});

fastify.put('/:skill_id/tags', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  if (!canManageSkill(request.user, request.params.skill_id)) {
    return reply.code(403).send({ detail: 'Owner or admin permission required' });
  }
  const tags = TagModel.replaceSkillTags(request.params.skill_id, request.body.tag_ids || [], request.user.id);
  return { ok: true, skill_id: request.params.skill_id, tags };
});
```

```js
// src/routes/tags.js
const { isSuperAdmin } = require('../utils/permission');
const TagModel = require('../models/tag');

fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  if (!isSuperAdmin(request.user)) return reply.code(403).send({ detail: 'Super admin required' });
  return { tags: TagModel.listAllWithUsage() };
});

fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  if (!isSuperAdmin(request.user)) return reply.code(403).send({ detail: 'Super admin required' });
  const tag = TagModel.create({ name: request.body.name, actorId: request.user.id });
  return reply.code(201).send({ ok: true, tag });
});
```

```js
// src/routes/users.js
if (status === 'disabled' && user.is_super_admin && !UserModel.canDemoteOrDisableSuperAdmin(userId)) {
  return reply.code(400).send({ ok: false, error: 'last_super_admin', detail: 'Cannot disable the last super admin' });
}
```

```js
// src/index.js
await fastify.register(require('./routes/tags'), { prefix: `${API_PREFIX}/tags` });
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `pnpm test -- tests/skill-view-download.test.js tests/skill-favorites-tags.test.js`

Expected: PASS，`/view` 不计下载，`/download` 计数，标签权限断言通过

- [ ] **Step 5: 提交**

```bash
git add src/routes/init.js src/routes/skills.js src/routes/tags.js src/routes/users.js src/index.js tests/skill-view-download.test.js tests/skill-favorites-tags.test.js
git commit -m "feat: add favorite tag and non-counting skill view routes"
```

## Task 4: 扩展前端 API、store 和列表页

**Files:**
- Modify: `web/src/services/api.ts`
- Modify: `web/src/stores/auth.ts`
- Modify: `web/src/stores/skills.ts`
- Modify: `web/src/views/HomeView.vue`
- Modify: `web/src/composables/useI18n.ts`
- Test: `web/package.json`

- [ ] **Step 1: 先写类型约束，再让 type-check 失败**

```ts
// web/src/services/api.ts
export interface Tag {
  id: number
  name: string
  usage_count?: number
}

export interface Skill {
  id: string
  name: string
  description: string
  owner_id: number
  owner: User
  created_at: string
  updated_at: string
  latest_version?: string
  permission?: 'owner' | 'collaborator' | 'user'
  webhook_url?: string | null
  favorite_count: number
  download_count: number
  is_favorited?: boolean
  tags: Tag[]
}

export interface SkillVersion {
  id: number
  skill_id: number
  version: string
  changelog: string
  description?: string
  file_count: number
  total_size: number
  created_by: number
  uploader?: User
  created_at: string
  download_count: number
}
```

Run: `pnpm --dir web type-check`

Expected: FAIL，`HomeView.vue`、`SkillDetailView.vue` 或 `auth.ts` 对新增字段尚未处理

- [ ] **Step 2: 增加 API 和 store 方法**

```ts
// web/src/services/api.ts
export const skillsApi = {
  list: (query?: string) => apiGet<{ skills: Skill[] }>(`/skills${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  get: (id: string) => apiGet<SkillDetail>(`/skills/${id}`),
  favorite: (id: string) => apiPost<{ ok: boolean; skill_id: string; favorited: boolean; favorite_count: number }>(`/skills/${id}/favorite`),
  unfavorite: (id: string) => apiDelete<{ ok: boolean; skill_id: string; favorited: boolean; favorite_count: number }>(`/skills/${id}/favorite`),
  updateTags: (id: string, tag_ids: number[]) => apiPut<{ ok: boolean; skill_id: string; tags: Tag[] }>(`/skills/${id}/tags`, { tag_ids })
}

export const tagsApi = {
  list: () => apiGet<{ tags: Tag[] }>('/tags'),
  create: (name: string) => apiPost<{ ok: boolean; tag: Tag }>('/tags', { name }),
  update: (id: number, name: string) => apiPatch<{ ok: boolean; tag: Tag }>(`/tags/${id}`, { name }),
  delete: (id: number) => apiDelete<{ ok: boolean }>(`/tags/${id}`)
}
```

```ts
// web/src/stores/auth.ts
const isSuperAdmin = computed(() => user.value?.is_super_admin === 1)
```

```ts
// web/src/stores/skills.ts
async function toggleFavorite(skillId: string, shouldFavorite: boolean) {
  const response = shouldFavorite ? await skillsApi.favorite(skillId) : await skillsApi.unfavorite(skillId)
  const apply = (skill: Skill | SkillDetail | null) => {
    if (!skill || skill.id !== skillId) return
    skill.favorite_count = response.favorite_count
    skill.is_favorited = response.favorited
  }

  skills.value.forEach(apply)
  apply(currentSkill.value)
  return response
}
```

- [ ] **Step 3: 改首页筛选和卡片展示**

```vue
<script setup lang="ts">
const showFavoritesOnly = ref(false)

const filteredSkills = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return skillsStore.skills.filter((skill) => {
    const matchesQuery = !query || skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query)
    const matchesFavorite = !showFavoritesOnly.value || skill.is_favorited === true
    return matchesQuery && matchesFavorite
  })
})

async function toggleFavorite(skillId: string, currentValue: boolean | undefined, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  await skillsStore.toggleFavorite(skillId, !currentValue)
}
</script>
```

```vue
<template>
  <button class="favorite-filter-btn" :class="{ active: showFavoritesOnly }" @click="showFavoritesOnly = !showFavoritesOnly">
    {{ t('index.favoriteOnly') }}
  </button>

  <span class="skill-meta-chip">{{ skill.favorite_count }} {{ t('index.favoriteCount') }}</span>
  <span class="skill-meta-chip">{{ skill.download_count }} {{ t('index.downloadCount') }}</span>
  <span v-for="tag in skill.tags" :key="tag.id" class="skill-tag-chip">{{ tag.name }}</span>
</template>
```

- [ ] **Step 4: 跑 type-check 确认通过**

Run: `pnpm --dir web type-check`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add web/src/services/api.ts web/src/stores/auth.ts web/src/stores/skills.ts web/src/views/HomeView.vue web/src/composables/useI18n.ts
git commit -m "feat: add favorite filter and stats to skill list"
```

## Task 5: 改详情页预览、收藏与标签编辑

**Files:**
- Modify: `web/src/views/SkillDetailView.vue`
- Modify: `web/src/services/api.ts`
- Modify: `web/src/stores/skills.ts`
- Modify: `web/src/composables/useI18n.ts`
- Test: `web/package.json`

- [ ] **Step 1: 先把预览接口替换成 `/view`，让 type-check 失败暴露缺口**

```ts
// web/src/services/api.ts
export const versionsApi = {
  list: (skillId: string) => apiGet<{ versions: SkillVersion[] }>(`/skills/${skillId}/versions`),
  viewUrl: (skillId: string, version: string) => `${API_BASE}/skills/${skillId}/versions/${version}/view`,
  downloadUrl: (skillId: string, version: string) => `${API_BASE}/skills/${skillId}/versions/${version}/download`,
  update: (skillId: string, version: string, data: { description?: string; changelog?: string }) =>
    apiPatch<SkillVersion>(`/skills/${skillId}/versions/${version}`, data),
}
```

Run: `pnpm --dir web type-check`

Expected: FAIL，`SkillDetailView.vue` 还在直接使用 `downloadUrl` 作为预览源

- [ ] **Step 2: 最小改动详情页**

```ts
// web/src/views/SkillDetailView.vue
const allTags = ref<Tag[]>([])
const showEditTagsModal = ref(false)
const selectedTagIds = ref<number[]>([])

const canEditTags = computed(() => {
  if (!skill.value) return false
  return skill.value.permission === 'owner' || skill.value.permission === 'collaborator'
})

async function loadVersionZip(version: string) {
  isLoadingZip.value = true
  selectedFilePath.value = ''
  selectedFileContent.value = ''

  try {
    const response = await fetch(versionsApi.viewUrl(skillId.value, version), {
      credentials: 'include'
    })
    if (!response.ok) throw new Error('Failed to view version')
    const zipData = await response.arrayBuffer()
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(zipData)
    currentZip.value = zip
    fileTree.value = generateFileTree(zip)
    await selectDefaultSkillMdIfPresent(zip)
  } finally {
    isLoadingZip.value = false
  }
}

async function toggleFavorite() {
  if (!skill.value) return
  await skillsStore.toggleFavorite(skill.value.id, !skill.value.is_favorited)
}

async function saveSkillTags() {
  if (!skill.value) return
  const response = await skillsApi.updateTags(skill.value.id, selectedTagIds.value)
  skill.value.tags = response.tags
  showEditTagsModal.value = false
}
```

```vue
<template>
  <div class="flex flex-wrap items-center gap-2 mb-4">
    <button class="skill-action-chip" @click="toggleFavorite">
      {{ skill?.is_favorited ? t('skill.unfavorite') : t('skill.favorite') }}
    </button>
    <span class="skill-stat-chip">{{ skill?.favorite_count }} {{ t('skill.favoriteCount') }}</span>
    <span class="skill-stat-chip">{{ skill?.download_count }} {{ t('skill.downloadCount') }}</span>
    <span v-for="tag in skill?.tags || []" :key="tag.id" class="skill-tag-chip">{{ tag.name }}</span>
    <button v-if="canEditTags" class="skill-action-chip" @click="showEditTagsModal = true">{{ t('skill.editTags') }}</button>
  </div>
</template>
```

- [ ] **Step 3: 跑 type-check 确认通过**

Run: `pnpm --dir web type-check`

Expected: PASS，详情页不再把预览走 `/download`

- [ ] **Step 4: 提交**

```bash
git add web/src/views/SkillDetailView.vue web/src/services/api.ts web/src/stores/skills.ts web/src/composables/useI18n.ts
git commit -m "feat: add skill favorite stats and view endpoint usage"
```

## Task 6: 增加标签后台页并同步文档

**Files:**
- Create: `web/src/views/TagManagementView.vue`
- Modify: `web/src/router/index.ts`
- Modify: `web/src/components/AppNavbar.vue`
- Modify: `web/src/composables/useI18n.ts`
- Modify: `README.md`
- Modify: `docs/README.zh.md`
- Modify: `docs/api.md`
- Test: `web/package.json`

- [ ] **Step 1: 先让路由和导航引用一个不存在的标签页，验证 type-check 会报错**

```ts
// web/src/router/index.ts
import TagManagementView from '@/views/TagManagementView.vue'

{
  path: '/admin/tags',
  name: 'tag-management',
  component: TagManagementView,
  meta: { requiresAuth: true, requiresAdmin: true },
}
```

Run: `pnpm --dir web type-check`

Expected: FAIL，报错找不到 `TagManagementView.vue`

- [ ] **Step 2: 最小实现标签后台页和导航入口**

```vue
<!-- web/src/views/TagManagementView.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { tagsApi, type Tag } from '@/services/api'
import { useI18n } from '@/composables/useI18n'

const { t } = useI18n()
const tags = ref<Tag[]>([])
const newTagName = ref('')

async function loadTags() {
  tags.value = (await tagsApi.list()).tags
}

async function createTag() {
  if (!newTagName.value.trim()) return
  await tagsApi.create(newTagName.value.trim())
  newTagName.value = ''
  await loadTags()
}

onMounted(loadTags)
</script>
```

```vue
<!-- web/src/components/AppNavbar.vue -->
<router-link
  v-if="authStore.isSuperAdmin"
  to="/admin/tags"
  class="block px-4 py-2 text-sm text-base-200 hover:text-white hover:bg-white/5"
  @click="showUserMenu = false"
>
  标签管理
</router-link>
```

```md
<!-- docs/api.md -->
## 收藏

- `POST /api/v1/skills/:skill_id/favorite`
- `DELETE /api/v1/skills/:skill_id/favorite`

## 版本查看

- `GET /api/v1/skills/:skill_id/versions/:version/view`：返回 ZIP，但不累计下载次数
- `GET /api/v1/skills/:skill_id/versions/:version/download`：返回 ZIP，并累计 Skill 与版本下载次数

## 标签管理

- `GET /api/v1/tags`
- `POST /api/v1/tags`
- `PATCH /api/v1/tags/:tag_id`
- `DELETE /api/v1/tags/:tag_id`
- `PUT /api/v1/skills/:skill_id/tags`
```

- [ ] **Step 3: 跑 type-check 与聚焦后端测试**

Run: `pnpm --dir web type-check && pnpm test -- tests/skill-favorites-tags.test.js tests/skill-view-download.test.js tests/super-admin-guard.test.js tests/database-adapter.test.js`

Expected: PASS

- [ ] **Step 4: 手工验证**

Run:

```bash
pnpm web:dev
```

Manual checklist:

1. 用普通登录用户打开首页，能切“仅收藏”
2. 收藏一个 Skill 后，首页卡片和详情页计数同步更新
3. 进入详情页预览版本，不增加下载次数
4. 点击下载后，刷新详情页可看到下载数增长
5. 以超级管理员登录，能打开 `/admin/tags`
6. 以普通 admin 登录，不能创建全局标签
7. 以 Skill owner 登录，可给 Skill 绑定已有标签

- [ ] **Step 5: 提交**

```bash
git add web/src/views/TagManagementView.vue web/src/router/index.ts web/src/components/AppNavbar.vue web/src/composables/useI18n.ts README.md docs/README.zh.md docs/api.md
git commit -m "feat: add tag admin page and document favorite tag APIs"
```

## Self-Review

### Spec coverage

1. 收藏功能：Task 2 和 Task 3 建表、模型、接口，Task 4 和 Task 5 接首页和详情页
2. 首页收藏筛选：Task 4
3. 收藏数与下载数展示：Task 3、Task 4、Task 5
4. 标签体系与权限：Task 2、Task 3、Task 6
5. 超级管理员标记与保护：Task 1、Task 2、Task 3
6. `/view` 与 `/download` 分离：Task 3、Task 5
7. 旧库自动升级：Task 1
8. 文档同步：Task 6

没有遗漏的 spec 大项。

### Placeholder scan

1. 没有 `TBD`、`TODO`、`implement later`
2. 每个任务都给了具体文件、命令和代码片段
3. 没有“参考前一个任务”这种懒写法

### Type consistency

1. 统一使用 `is_super_admin`
2. 统一使用 `favorite_count`、`download_count`
3. 统一使用 `/view` 作为不计下载的版本查看接口
4. 标签更新统一使用 `PUT /skills/:skill_id/tags`

