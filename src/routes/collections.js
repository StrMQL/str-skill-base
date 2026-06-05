const CollectionModel = require('../models/collection');
const TagModel = require('../models/tag');
const { buildCollectionZipBuffer, incrementDownloadCounts } = require('../utils/collection-bundle');

function parsePositiveId(raw) {
  const id = parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function formatSkill(skill) {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    latest_version: skill.latest_version,
    favorite_count: skill.favorite_count || 0,
    download_count: skill.download_count || 0,
    visibility: skill.visibility || 'public',
    tags: TagModel.listSkillTags(skill.id),
    collections: CollectionModel.listSkillCollections(skill.id),
    owner: {
      id: skill.owner_id,
      username: skill.owner_username,
      name: skill.owner_name
    },
    created_at: skill.created_at,
    updated_at: skill.updated_at
  };
}

function formatCollection(collection) {
  if (!collection) return collection;
  const { creator_username, creator_name, created_by, ...rest } = collection;
  const formatted = { ...rest };
  if (created_by) {
    formatted.created_by = {
      id: created_by,
      username: creator_username || null,
      name: creator_name || null
    };
  }
  return formatted;
}

function assertMutableFields(reply, body, requireName) {
  const name = body?.name;
  if (requireName && !String(name || '').trim()) {
    reply.code(400).send({ detail: 'Collection name is required' });
    return false;
  }
  if (name !== undefined && !String(name || '').trim()) {
    reply.code(400).send({ detail: 'Collection name is required' });
    return false;
  }
  if (body?.sort_order !== undefined && !Number.isFinite(Number(body.sort_order))) {
    reply.code(400).send({ detail: 'sort_order must be a number' });
    return false;
  }
  return true;
}

async function collectionsRoutes(fastify) {
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async () => {
    return { collections: CollectionModel.listAllWithUsage().map(formatCollection) };
  });

  fastify.get('/:collection_id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const collectionId = parsePositiveId(request.params.collection_id);
    if (!collectionId) {
      return reply.code(400).send({ detail: 'Invalid collection id' });
    }

    const collection = CollectionModel.findById(collectionId);
    if (!collection) {
      return reply.code(404).send({ detail: 'Collection not found' });
    }

    const skills = CollectionModel.listCollectionSkills(collectionId, request.user).map(formatSkill);
    return { collection: formatCollection(collection), skills, total: skills.length };
  });

  fastify.get('/:collection_id/download', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const collectionId = parsePositiveId(request.params.collection_id);
    if (!collectionId) {
      return reply.code(400).send({ detail: 'Invalid collection id' });
    }

    const collection = CollectionModel.findById(collectionId);
    if (!collection) {
      return reply.code(404).send({ detail: 'Collection not found' });
    }

    const skills = CollectionModel.listCollectionSkills(collectionId, request.user);
    const { buffer, fileName, packagedSkills } = buildCollectionZipBuffer(collection, skills);

    if (packagedSkills.length === 0) {
      return reply.code(404).send({ detail: 'No downloadable skills in this collection' });
    }

    incrementDownloadCounts(packagedSkills);

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(buffer);
  });

  fastify.post('/', {
    preHandler: [fastify.requireAdmin]
  }, async (request, reply) => {
    if (!assertMutableFields(reply, request.body, true)) return reply;

    const collection = CollectionModel.create({
      name: request.body.name,
      description: request.body.description,
      sortOrder: request.body.sort_order,
      actorId: request.user.id
    });
    return reply.code(201).send({ ok: true, collection: formatCollection(collection) });
  });

  fastify.patch('/:collection_id', {
    preHandler: [fastify.requireAdmin]
  }, async (request, reply) => {
    const collectionId = parsePositiveId(request.params.collection_id);
    if (!collectionId) {
      return reply.code(400).send({ detail: 'Invalid collection id' });
    }
    if (!assertMutableFields(reply, request.body, false)) return reply;

    const collection = CollectionModel.update(collectionId, {
      name: request.body?.name,
      description: request.body?.description,
      sortOrder: request.body?.sort_order,
      actorId: request.user.id
    });
    if (!collection) {
      return reply.code(404).send({ detail: 'Collection not found' });
    }
    return { ok: true, collection: formatCollection(collection) };
  });

  fastify.delete('/:collection_id', {
    preHandler: [fastify.requireAdmin]
  }, async (request, reply) => {
    const collectionId = parsePositiveId(request.params.collection_id);
    if (!collectionId) {
      return reply.code(400).send({ detail: 'Invalid collection id' });
    }

    const deleted = CollectionModel.delete(collectionId);
    if (!deleted) {
      return reply.code(404).send({ detail: 'Collection not found' });
    }
    return { ok: true };
  });

  fastify.put('/:collection_id/skills', {
    preHandler: [fastify.requireAdmin]
  }, async (request, reply) => {
    const collectionId = parsePositiveId(request.params.collection_id);
    const { skill_ids: skillIds } = request.body || {};

    if (!collectionId) {
      return reply.code(400).send({ detail: 'Invalid collection id' });
    }
    if (skillIds !== undefined && !Array.isArray(skillIds)) {
      return reply.code(400).send({ detail: 'skill_ids must be an array' });
    }

    try {
      const skills = CollectionModel.replaceCollectionSkills(collectionId, skillIds || [], request.user.id).map(formatSkill);
      return { ok: true, collection_id: collectionId, skills };
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      if (message.includes('Collection not found')) {
        return reply.code(404).send({ detail: 'Collection not found' });
      }
      if (message.includes('skills do not exist')) {
        return reply.code(400).send({ detail: 'One or more skills do not exist' });
      }
      if (message.includes('can contain at most')) {
        return reply.code(400).send({ detail: message });
      }
      throw error;
    }
  });
}

module.exports = collectionsRoutes;
