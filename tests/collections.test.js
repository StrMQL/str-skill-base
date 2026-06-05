const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');

const { buildTestApp } = require('./helpers/build-app');

function sessionCookie(app, userId) {
  return `session_id=${app.createSession(userId)}`;
}

function createSkillZip(targetPath, skillId) {
  const zip = new AdmZip();
  zip.addFile(`${skillId}/SKILL.md`, Buffer.from(`# ${skillId}\n`, 'utf8'));
  zip.writeZip(targetPath);
}

function seedSkillWithVersion(app, { skillId, visibility = 'public', ownerId = 2, version = 'v20260414.120000' }) {
  const zipDir = path.join(app.fixture.dataDir, 'skills', skillId);
  fs.mkdirSync(zipDir, { recursive: true });
  const zipPath = path.join(zipDir, `${version}.zip`);
  createSkillZip(zipPath, skillId);

  app.db.prepare(`
    INSERT INTO skills (id, name, description, visibility, owner_id, latest_version, favorite_count, download_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, datetime('now'), datetime('now'))
  `).run(skillId, skillId, `${skillId} desc`, visibility, ownerId, version);

  app.db.prepare(`
    INSERT INTO skill_collaborators (skill_id, user_id, role, created_by)
    VALUES (?, ?, 'owner', ?)
  `).run(skillId, ownerId, ownerId);

  app.db.prepare(`
    INSERT INTO skill_versions (skill_id, version, changelog, zip_path, uploader_id, description, download_count, created_at)
    VALUES (?, ?, 'init', ?, ?, 'Version desc', 0, datetime('now'))
  `).run(skillId, version, `skills/${skillId}/${version}.zip`, ownerId);

  return { version };
}

function seedUsers(app) {
  app.db.prepare(`
    INSERT INTO users (id, username, password_hash, role, status, is_super_admin, created_at, updated_at)
    VALUES
      (1, 'admin', 'hash', 'admin', 'active', 1, datetime('now'), datetime('now')),
      (2, 'owner', 'hash', 'developer', 'active', 0, datetime('now'), datetime('now')),
      (3, 'outsider', 'hash', 'developer', 'active', 0, datetime('now'), datetime('now'))
  `).run();
}

function seedSkills(app) {
  app.db.prepare(`
    INSERT INTO skills (id, name, description, visibility, owner_id, created_at, updated_at)
    VALUES
      ('public-skill', 'Public Skill', 'visible to everyone', 'public', 2, datetime('now'), datetime('now')),
      ('private-skill', 'Private Skill', 'visible only to owner', 'private', 2, datetime('now'), datetime('now'))
  `).run();

  app.db.prepare(`
    INSERT INTO skill_collaborators (skill_id, user_id, role, created_by)
    VALUES
      ('public-skill', 2, 'owner', 2),
      ('private-skill', 2, 'owner', 2)
  `).run();
}

test('unauthenticated users can list collections', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);

    const create = await app.inject({
      method: 'POST',
      url: `${app.apiPrefix}/collections`,
      headers: { cookie: sessionCookie(app, 1) },
      payload: { name: 'Public Pack', slug: 'public-pack', description: 'visible in list', sort_order: 0 }
    });
    assert.equal(create.statusCode, 201);

    const list = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections`
    });

    assert.equal(list.statusCode, 200);
    assert.equal(list.json().collections.length, 1);
    assert.equal(list.json().collections[0].slug, 'public-pack');
  } finally {
    await app.cleanup();
  }
});

test('admin cannot create a collection with an overlong description', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);

    const create = await app.inject({
      method: 'POST',
      url: `${app.apiPrefix}/collections`,
      headers: { cookie: sessionCookie(app, 1) },
      payload: { name: 'Too Long', slug: 'too-long', description: 'x'.repeat(121), sort_order: 0 }
    });

    assert.equal(create.statusCode, 400);
    assert.match(create.json().detail, /too long/i);
  } finally {
    await app.cleanup();
  }
});

test('admin can create a collection and replace its skill members', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    seedSkills(app);

    const create = await app.inject({
      method: 'POST',
      url: `${app.apiPrefix}/collections`,
      headers: { cookie: sessionCookie(app, 1) },
      payload: { name: 'Frontend Essentials', slug: 'frontend-essentials', description: 'Install these first', sort_order: 10 }
    });

    assert.equal(create.statusCode, 201);
    const collection = create.json().collection;
    assert.equal(collection.name, 'Frontend Essentials');
    assert.equal(collection.slug, 'frontend-essentials');
    assert.equal(collection.skill_count, 0);

    const replace = await app.inject({
      method: 'PUT',
      url: `${app.apiPrefix}/collections/${collection.id}/skills`,
      headers: { cookie: sessionCookie(app, 1) },
      payload: { skill_ids: ['public-skill', 'private-skill'] }
    });

    assert.equal(replace.statusCode, 200);
    assert.deepEqual(replace.json().skills.map((skill) => skill.id), ['public-skill', 'private-skill']);

    const outsiderList = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections`,
      headers: { cookie: sessionCookie(app, 3) }
    });

    assert.equal(outsiderList.statusCode, 200);
    assert.deepEqual(outsiderList.json().collections.map((item) => item.skill_count), [1]);

    const ownerList = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections`,
      headers: { cookie: sessionCookie(app, 2) }
    });

    assert.equal(ownerList.statusCode, 200);
    assert.deepEqual(ownerList.json().collections.map((item) => item.skill_count), [2]);
  } finally {
    await app.cleanup();
  }
});

test('admin collection browse excludes private skills unless include_private=1', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    seedSkillWithVersion(app, { skillId: 'public-skill' });
    seedSkillWithVersion(app, { skillId: 'private-skill', visibility: 'private' });

    app.db.prepare(`
      INSERT INTO collections (id, name, slug, description, sort_order, created_by, updated_by)
      VALUES (1, 'Mixed Pack', 'mixed-pack', 'admin browse test', 0, 1, 1)
    `).run();
    app.db.prepare(`
      INSERT INTO collection_skills (collection_id, skill_id, sort_order, created_by)
      VALUES
        (1, 'public-skill', 0, 1),
        (1, 'private-skill', 1, 1)
    `).run();

    const browse = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/mixed-pack`,
      headers: { cookie: sessionCookie(app, 1) }
    });

    assert.equal(browse.statusCode, 200);
    assert.deepEqual(browse.json().skills.map((skill) => skill.id), ['public-skill']);

    const manage = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/mixed-pack?include_private=1`,
      headers: { cookie: sessionCookie(app, 1) }
    });

    assert.equal(manage.statusCode, 200);
    assert.deepEqual(manage.json().skills.map((skill) => skill.id), ['public-skill', 'private-skill']);
  } finally {
    await app.cleanup();
  }
});

test('unauthenticated collection detail excludes private skills', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    seedSkills(app);

    app.db.prepare(`
      INSERT INTO collections (id, name, slug, description, sort_order, created_by, updated_by)
      VALUES (1, 'All Hands', 'all-hands', 'mixed visibility', 0, 1, 1)
    `).run();
    app.db.prepare(`
      INSERT INTO collection_skills (collection_id, skill_id, sort_order, created_by)
      VALUES
        (1, 'public-skill', 0, 1),
        (1, 'private-skill', 1, 1)
    `).run();

    const detail = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/all-hands`
    });

    assert.equal(detail.statusCode, 200);
    assert.deepEqual(detail.json().skills.map((skill) => skill.id), ['public-skill']);
    assert.equal(detail.json().collection.skill_count, 1);

    const list = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections`
    });

    assert.equal(list.statusCode, 200);
    assert.equal(list.json().collections[0].skill_count, 1);
  } finally {
    await app.cleanup();
  }
});

test('collection detail filters member skills by viewer visibility', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    seedSkills(app);

    app.db.prepare(`
      INSERT INTO collections (id, name, slug, description, sort_order, created_by, updated_by)
      VALUES (1, 'All Hands', 'all-hands', 'mixed visibility', 0, 1, 1)
    `).run();
    app.db.prepare(`
      INSERT INTO collection_skills (collection_id, skill_id, sort_order, created_by)
      VALUES
        (1, 'public-skill', 0, 1),
        (1, 'private-skill', 1, 1)
    `).run();

    const outsider = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/1`,
      headers: { cookie: sessionCookie(app, 3) }
    });

    assert.equal(outsider.statusCode, 200);
    assert.deepEqual(outsider.json().skills.map((skill) => skill.id), ['public-skill']);

    const owner = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/1`,
      headers: { cookie: sessionCookie(app, 2) }
    });

    assert.equal(owner.statusCode, 200);
    assert.deepEqual(owner.json().skills.map((skill) => skill.id), ['public-skill', 'private-skill']);
  } finally {
    await app.cleanup();
  }
});

test('non-admin users cannot mutate collections', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);

    const create = await app.inject({
      method: 'POST',
      url: `${app.apiPrefix}/collections`,
      headers: { cookie: sessionCookie(app, 2) },
      payload: { name: 'Should Fail' }
    });

    assert.equal(create.statusCode, 403);
  } finally {
    await app.cleanup();
  }
});

test('collection members cannot exceed 10 skills', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    for (let i = 1; i <= 11; i += 1) {
      seedSkillWithVersion(app, { skillId: `skill-${i}` });
    }

    app.db.prepare(`
      INSERT INTO collections (id, name, slug, description, sort_order, created_by, updated_by)
      VALUES (1, 'Too Many', 'too-many', 'limit test', 0, 1, 1)
    `).run();

    const replace = await app.inject({
      method: 'PUT',
      url: `${app.apiPrefix}/collections/1/skills`,
      headers: { cookie: sessionCookie(app, 1) },
      payload: {
        skill_ids: Array.from({ length: 11 }, (_, index) => `skill-${index + 1}`)
      }
    });

    assert.equal(replace.statusCode, 400);
    assert.match(replace.json().detail, /at most 10 skills/);
  } finally {
    await app.cleanup();
  }
});

test('collection download returns one zip with skill directories at root', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    seedSkillWithVersion(app, { skillId: 'public-skill' });
    seedSkillWithVersion(app, { skillId: 'private-skill', visibility: 'private' });

    app.db.prepare(`
      INSERT INTO collections (id, name, slug, description, sort_order, created_by, updated_by)
      VALUES (1, 'Frontend Essentials', 'frontend-essentials', 'bundle test', 0, 1, 1)
    `).run();
    app.db.prepare(`
      INSERT INTO collection_skills (collection_id, skill_id, sort_order, created_by)
      VALUES
        (1, 'public-skill', 0, 1),
        (1, 'private-skill', 1, 1)
    `).run();

    const res = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/1/download`,
      headers: { cookie: sessionCookie(app, 2) }
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /application\/zip/);
    assert.match(res.headers['content-disposition'], /frontend-essentials\.zip/);

    const zip = new AdmZip(res.rawPayload);
    const names = zip.getEntries().map((entry) => entry.entryName.replace(/\\/g, '/'));
    assert.ok(names.some((name) => name === 'public-skill/SKILL.md'));
    assert.ok(names.some((name) => name === 'private-skill/SKILL.md'));
  } finally {
    await app.cleanup();
  }
});

test('collection download can be resolved by slug and uses slug filename', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    seedSkillWithVersion(app, { skillId: 'public-skill' });

    app.db.prepare(`
      INSERT INTO collections (id, name, slug, description, sort_order, created_by, updated_by)
      VALUES (3, 'Collection 3', 'pm-essentials', 'slug download test', 0, 1, 1)
    `).run();
    app.db.prepare(`
      INSERT INTO collection_skills (collection_id, skill_id, sort_order, created_by)
      VALUES (3, 'public-skill', 0, 1)
    `).run();

    const res = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/pm-essentials/download`,
      headers: { cookie: sessionCookie(app, 2) }
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-disposition'], /pm-essentials\.zip/);
  } finally {
    await app.cleanup();
  }
});

test('collection slug must be unique', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);

    const first = await app.inject({
      method: 'POST',
      url: `${app.apiPrefix}/collections`,
      headers: { cookie: sessionCookie(app, 1) },
      payload: { name: 'Pack A', slug: 'shared-slug', description: 'first', sort_order: 0 }
    });
    assert.equal(first.statusCode, 201);

    const second = await app.inject({
      method: 'POST',
      url: `${app.apiPrefix}/collections`,
      headers: { cookie: sessionCookie(app, 1) },
      payload: { name: 'Pack B', slug: 'shared-slug', description: 'second', sort_order: 1 }
    });

    assert.equal(second.statusCode, 409);
    assert.match(second.json().detail, /slug already exists/i);
  } finally {
    await app.cleanup();
  }
});

test('collection download increments collection download_count', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    seedSkillWithVersion(app, { skillId: 'public-skill' });

    app.db.prepare(`
      INSERT INTO collections (id, name, slug, description, sort_order, created_by, updated_by)
      VALUES (1, 'Download Counter', 'download-counter', 'count test', 0, 1, 1)
    `).run();
    app.db.prepare(`
      INSERT INTO collection_skills (collection_id, skill_id, sort_order, created_by)
      VALUES (1, 'public-skill', 0, 1)
    `).run();

    const before = app.db.prepare('SELECT download_count FROM collections WHERE id = 1').get();
    assert.equal(before.download_count, 0);

    const res = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/1/download`,
      headers: { cookie: sessionCookie(app, 2) }
    });

    assert.equal(res.statusCode, 200);

    const after = app.db.prepare('SELECT download_count FROM collections WHERE id = 1').get();
    assert.equal(after.download_count, 1);

    const detail = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/1`,
      headers: { cookie: sessionCookie(app, 2) }
    });

    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().collection.download_count, 1);
  } finally {
    await app.cleanup();
  }
});

test('unauthenticated collection download excludes private skills', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    seedSkillWithVersion(app, { skillId: 'public-skill' });
    seedSkillWithVersion(app, { skillId: 'private-skill', visibility: 'private' });

    app.db.prepare(`
      INSERT INTO collections (id, name, slug, description, sort_order, created_by, updated_by)
      VALUES (1, 'Mixed Pack', 'mixed-pack', 'visibility test', 0, 1, 1)
    `).run();
    app.db.prepare(`
      INSERT INTO collection_skills (collection_id, skill_id, sort_order, created_by)
      VALUES
        (1, 'public-skill', 0, 1),
        (1, 'private-skill', 1, 1)
    `).run();

    const res = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/mixed-pack/download`
    });

    assert.equal(res.statusCode, 200);
    const zip = new AdmZip(res.rawPayload);
    const names = zip.getEntries().map((entry) => entry.entryName.replace(/\\/g, '/'));
    assert.ok(names.some((name) => name === 'public-skill/SKILL.md'));
    assert.ok(!names.some((name) => name.startsWith('private-skill/')));
  } finally {
    await app.cleanup();
  }
});

test('collection download excludes private skills for users without access', async () => {
  const app = await buildTestApp();
  try {
    seedUsers(app);
    seedSkillWithVersion(app, { skillId: 'public-skill' });
    seedSkillWithVersion(app, { skillId: 'private-skill', visibility: 'private' });

    app.db.prepare(`
      INSERT INTO collections (id, name, slug, description, sort_order, created_by, updated_by)
      VALUES (1, 'Mixed Pack', 'mixed-pack', 'visibility test', 0, 1, 1)
    `).run();
    app.db.prepare(`
      INSERT INTO collection_skills (collection_id, skill_id, sort_order, created_by)
      VALUES
        (1, 'public-skill', 0, 1),
        (1, 'private-skill', 1, 1)
    `).run();

    const res = await app.inject({
      method: 'GET',
      url: `${app.apiPrefix}/collections/1/download`,
      headers: { cookie: sessionCookie(app, 3) }
    });

    assert.equal(res.statusCode, 200);
    const zip = new AdmZip(res.rawPayload);
    const names = zip.getEntries().map((entry) => entry.entryName.replace(/\\/g, '/'));
    assert.ok(names.some((name) => name === 'public-skill/SKILL.md'));
    assert.ok(!names.some((name) => name.startsWith('private-skill/')));
  } finally {
    await app.cleanup();
  }
});
