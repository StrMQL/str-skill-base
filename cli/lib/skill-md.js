/**
 * SKILL.md parsing and skill id rules — keep in sync with ../../src/utils/skill-md.js (server).
 */
import { parse as parseYaml } from 'yaml';

export const SKILL_ID_RE = /^[\w-]+$/;

export function slugRepoNameForSkillId(repoName) {
  const s = String(repoName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s && SKILL_ID_RE.test(s) ? s : 'skill';
}

/** @see ../../src/utils/skill-md.js */
export function folderBasenameHintForGithubImport(repoName, subpathNormalized) {
  const sp = String(subpathNormalized || '').trim();
  if (sp) {
    const parts = sp.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return slugRepoNameForSkillId(last);
  }
  return slugRepoNameForSkillId(repoName);
}

export function resolveSkillIdCore(folderBasename, frontmatterName) {
  const f = String(folderBasename ?? '').trim();
  const m =
    frontmatterName === undefined || frontmatterName === null
      ? ''
      : String(frontmatterName).trim();

  const fOk = SKILL_ID_RE.test(f);
  const mOk = m.length > 0 && SKILL_ID_RE.test(m);

  if (fOk && mOk) {
    if (f === m) return { ok: true, id: f };
    return { ok: false, reason: 'mismatch', folder: f, fm: m };
  }
  if (fOk) return { ok: true, id: f };
  if (mOk) return { ok: true, id: m };
  return { ok: false, reason: 'invalid', folder: f, fm: m || '' };
}

function splitFrontmatter(content) {
  const s = content.replace(/^\uFEFF/, '');
  if (!s.startsWith('---')) return { fmYaml: null, body: s };
  const lines = s.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { fmYaml: null, body: s };
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) return { fmYaml: null, body: s };
  const fmYaml = lines.slice(1, end).join('\n');
  const body = lines.slice(end + 1).join('\n');
  return { fmYaml, body };
}

const YAML_BLOCK_STARTERS = new Set(['>', '|', '>-', '>+', '|-', '|+']);
const YAML_FOLDED_BLOCK_STARTERS = new Set(['>', '>-', '>+']);

/** @see ../../src/utils/skill-md.js */
function parseYamlFrontmatterBlock(yaml) {
  const out = {};
  const lines = yaml.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m || !m[1]) {
      i += 1;
      continue;
    }
    const key = m[1];
    const rest = (m[2] ?? '').trimEnd();
    if (YAML_BLOCK_STARTERS.has(rest)) {
      i += 1;
      const buf = [];
      while (i < lines.length) {
        const L = lines[i];
        const nextKey = L.match(/^([\w-]+):\s/);
        if (nextKey && !L.startsWith('  ') && buf.length) break;
        if (L.startsWith('  ') || (L === '' && buf.length)) {
          buf.push(L.startsWith('  ') ? L.slice(2) : '');
        } else if (buf.length) {
          break;
        } else if (L === '') {
          i += 1;
          continue;
        } else {
          break;
        }
        i += 1;
      }
      out[key] = YAML_FOLDED_BLOCK_STARTERS.has(rest)
        ? buf.join(' ').replace(/\s+/g, ' ').trim()
        : buf.join('\n').trim();
      continue;
    }
    out[key] = rest.replace(/^["'](.+)["']$/, '$1').trim();
    i += 1;
  }
  return out;
}

function parseBodyHeading(body) {
  const lines = body.split(/\r?\n/);
  let name = null;
  let description = null;
  let foundTitle = false;
  const blockquoteLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!foundTitle && trimmed.startsWith('# ')) {
      name = trimmed.slice(2).trim();
      foundTitle = true;
      continue;
    }

    if (!foundTitle) continue;

    if (blockquoteLines.length > 0) {
      if (trimmed.startsWith('>')) {
        blockquoteLines.push(trimmed.replace(/^>\s?/, ''));
        continue;
      }
      description = blockquoteLines.join(' ').trim().slice(0, 500);
      break;
    }

    if (trimmed && !trimmed.startsWith('#')) {
      if (trimmed.startsWith('>')) {
        blockquoteLines.push(trimmed.replace(/^>\s?/, ''));
      } else {
        description = trimmed.slice(0, 500);
        break;
      }
    }
  }

  if (!description && blockquoteLines.length) {
    description = blockquoteLines.join(' ').trim().slice(0, 500);
  }

  return { name, description };
}

export function parseSkillMd(content) {
  const { fmYaml, body } = splitFrontmatter(content);
  let fm = null;
  if (fmYaml !== null && fmYaml.trim() !== '') {
    try {
      fm = parseYaml(fmYaml);
      if (fm === null || typeof fm !== 'object') fm = {};
    } catch {
      fm = parseYamlFrontmatterBlock(fmYaml);
    }
  }

  const heading = parseBodyHeading(body);
  let descriptionFromFm = '';
  if (fm && fm.description !== undefined && fm.description !== null) {
    descriptionFromFm = String(fm.description).trim();
  }

  return {
    fm,
    headingTitle: heading.name,
    headingDescription: heading.description,
    descriptionFromFm
  };
}

export function displayNameAndDescriptionFromParsed(parsed, fallbackId) {
  const name = parsed.headingTitle || fallbackId;
  const description =
    (parsed.descriptionFromFm ? parsed.descriptionFromFm : '') ||
    parsed.headingDescription ||
    '';
  return { name, description };
}
