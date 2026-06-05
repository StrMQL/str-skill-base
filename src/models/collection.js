const db = require('../database');
const modelCache = require('../utils/model-cache');

const MAX_COLLECTION_SKILLS = 10;

function normalizeName(name) {
  return String(name || '').trim();
}

function normalizeDescription(description) {
  if (description === undefined || description === null) return '';
  return String(description).trim();
}

function normalizeSortOrder(sortOrder) {
  const n = Number(sortOrder);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function getCollectionById(id) {
  return db.prepare(`
    SELECT
      c.id,
      c.name,
      c.description,
      c.sort_order,
      c.created_at,
      c.updated_at,
      c.created_by,
      c.updated_by,
      u.username AS creator_username,
      u.name AS creator_name,
      COUNT(cs.skill_id) AS skill_count
    FROM collections c
    LEFT JOIN collection_skills cs ON cs.collection_id = c.id
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id);
}

function invalidateSkillRefs(skillIds) {
  for (const skillId of skillIds || []) {
    modelCache.invalidateSkill(skillId);
  }
}

function visibilityPredicate(viewer) {
  if (viewer?.role === 'admin') {
    return { join: '', where: '', params: [] };
  }
  if (viewer) {
    return {
      join: 'LEFT JOIN skill_collaborators sc_view ON s.id = sc_view.skill_id AND sc_view.user_id = ?',
      where: "AND (s.visibility = 'public' OR sc_view.user_id IS NOT NULL)",
      params: [viewer.id]
    };
  }
  return { join: '', where: "AND s.visibility = 'public'", params: [] };
}

const CollectionModel = {
  create({ name, description, sortOrder, actorId }) {
    const result = db.prepare(`
      INSERT INTO collections (name, description, sort_order, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      normalizeName(name),
      normalizeDescription(description),
      normalizeSortOrder(sortOrder),
      actorId,
      actorId
    );
    return getCollectionById(result.lastInsertRowid);
  },

  update(id, { name, description, sortOrder, actorId }) {
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(normalizeName(name));
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(normalizeDescription(description));
    }
    if (sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(normalizeSortOrder(sortOrder));
    }
    if (fields.length === 0) return getCollectionById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    fields.push('updated_by = ?');
    values.push(actorId, id);

    db.prepare(`UPDATE collections SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return getCollectionById(id);
  },

  delete(id) {
    const affectedSkills = db.prepare(`
      SELECT skill_id
      FROM collection_skills
      WHERE collection_id = ?
    `).all(id).map((row) => row.skill_id);

    const result = db.prepare('DELETE FROM collections WHERE id = ?').run(id);
    invalidateSkillRefs(affectedSkills);
    return result.changes > 0;
  },

  exists(id) {
    const row = db.prepare('SELECT 1 FROM collections WHERE id = ?').get(id);
    return !!row;
  },

  findById(id) {
    return getCollectionById(id);
  },

  listAllWithUsage() {
    return db.prepare(`
      SELECT
        c.id,
        c.name,
        c.description,
        c.sort_order,
        c.created_at,
        c.updated_at,
        COUNT(cs.skill_id) AS skill_count
      FROM collections c
      LEFT JOIN collection_skills cs ON cs.collection_id = c.id
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `).all();
  },

  listSkillCollections(skillId) {
    return db.prepare(`
      SELECT c.id, c.name
      FROM collection_skills cs
      JOIN collections c ON c.id = cs.collection_id
      WHERE cs.skill_id = ?
      ORDER BY c.sort_order ASC, c.name ASC
    `).all(skillId);
  },

  listCollectionSkills(collectionId, viewer) {
    const visibility = visibilityPredicate(viewer);
    return db.prepare(`
      SELECT s.*, u.username as owner_username, u.name as owner_name
      FROM collection_skills cs
      JOIN skills s ON s.id = cs.skill_id
      LEFT JOIN users u ON s.owner_id = u.id
      ${visibility.join}
      WHERE cs.collection_id = ?
        ${visibility.where}
      ORDER BY cs.sort_order ASC, s.updated_at DESC
    `).all(...visibility.params, collectionId);
  },

  replaceCollectionSkills(collectionId, skillIds, actorId) {
    const uniqueSkillIds = [...new Set((skillIds || []).map((id) => String(id).trim()).filter(Boolean))];

    if (uniqueSkillIds.length > MAX_COLLECTION_SKILLS) {
      throw new Error(`A collection can contain at most ${MAX_COLLECTION_SKILLS} skills`);
    }

    return db.transaction(() => {
      if (!this.exists(collectionId)) {
        throw new Error('Collection not found');
      }

      if (uniqueSkillIds.length > 0) {
        const placeholders = uniqueSkillIds.map(() => '?').join(', ');
        const rows = db.prepare(`SELECT id FROM skills WHERE id IN (${placeholders})`).all(...uniqueSkillIds);
        if (rows.length !== uniqueSkillIds.length) {
          throw new Error('One or more skills do not exist');
        }
      }

      const previousSkillIds = db.prepare(`
        SELECT skill_id
        FROM collection_skills
        WHERE collection_id = ?
      `).all(collectionId).map((row) => row.skill_id);

      db.prepare('DELETE FROM collection_skills WHERE collection_id = ?').run(collectionId);
      const insert = db.prepare(`
        INSERT INTO collection_skills (collection_id, skill_id, sort_order, created_by)
        VALUES (?, ?, ?, ?)
      `);

      uniqueSkillIds.forEach((skillId, index) => {
        insert.run(collectionId, skillId, index, actorId);
      });

      invalidateSkillRefs([...new Set([...previousSkillIds, ...uniqueSkillIds])]);
      return this.listCollectionSkills(collectionId, { id: actorId, role: 'admin' });
    })();
  }
};

module.exports = CollectionModel;
module.exports.MAX_COLLECTION_SKILLS = MAX_COLLECTION_SKILLS;
