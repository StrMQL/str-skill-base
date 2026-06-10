const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const VersionModel = require('../models/version');
const SkillModel = require('../models/skill');
const { resolveZipPath } = require('./zip');
const { isJunkZipPath } = require('./zip-sanitize');

function buildCollectionFileName(collection) {
  const slug = String(collection?.slug || '').trim().toLowerCase();
  if (slug) {
    return `${slug}.zip`;
  }
  return `collection-${collection.id}.zip`;
}

function resolveExistingZipPath(skillId, versionRecord) {
  const zipPath = resolveZipPath(versionRecord.zip_path, skillId, versionRecord.version);
  if (fs.existsSync(zipPath)) {
    return zipPath;
  }
  return null;
}

function normalizeEntryPath(entryName) {
  return String(entryName || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function stripSkillRootPrefix(entryPath, skillId) {
  const normalized = normalizeEntryPath(entryPath);
  if (normalized === skillId || normalized.startsWith(`${skillId}/`)) {
    return normalized.slice(skillId.length).replace(/^\/+/, '');
  }
  return normalized;
}

function addSkillZipToBundle(outZip, skillId, zipFilePath) {
  const skillZip = new AdmZip(zipFilePath);
  for (const entry of skillZip.getEntries()) {
    if (entry.isDirectory) continue;
    if (isJunkZipPath(entry.entryName)) continue;

    const relative = stripSkillRootPrefix(entry.entryName, skillId);
    if (!relative) continue;

    outZip.addFile(`${skillId}/${relative}`, entry.getData());
  }
}

/**
 * Build a collection zip buffer from visible skills (must have latest_version + zip on disk).
 * Zip root contains one folder per skill: skill-id/SKILL.md ...
 * @param {{ id: number, name: string }} collection
 * @param {Array<{ id: string, latest_version?: string }>} skills
 * @returns {{ buffer: Buffer, fileName: string, packagedSkills: Array<{ skillId: string, version: string }> }}
 */
function buildCollectionZipBuffer(collection, skills) {
  const outZip = new AdmZip();
  const packagedSkills = [];

  for (const skill of skills) {
    const skillId = skill.id;
    const version = skill.latest_version;
    if (!version) continue;

    const versionRecord = VersionModel.getLatest(skillId);
    if (!versionRecord || versionRecord.version !== version) {
      const exact = VersionModel.findByVersion(skillId, version);
      if (!exact) continue;
      const zipPath = resolveExistingZipPath(skillId, exact);
      if (!zipPath) continue;
      addSkillZipToBundle(outZip, skillId, zipPath);
      packagedSkills.push({ skillId, version });
      continue;
    }

    const zipPath = resolveExistingZipPath(skillId, versionRecord);
    if (!zipPath) continue;

    addSkillZipToBundle(outZip, skillId, zipPath);
    packagedSkills.push({ skillId, version });
  }

  const fileName = buildCollectionFileName(collection);
  return { buffer: outZip.toBuffer(), fileName, packagedSkills };
}

function incrementDownloadCounts(packagedSkills) {
  for (const { skillId, version } of packagedSkills) {
    SkillModel.incrementDownloadCount(skillId);
    VersionModel.incrementDownloadCount(skillId, version);
  }
}

module.exports = {
  buildCollectionZipBuffer,
  buildCollectionFileName,
  incrementDownloadCounts
};
