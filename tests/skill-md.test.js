const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  parseSkillMd,
  displayNameAndDescriptionFromParsed
} = require('../src/utils/skill-md');

test('parseSkillMd reads description from YAML folded block (>-)', () => {
  const md = `---
name: demo-skill
description: >-
  First line
  Second line
---
# Demo
`;
  const parsed = parseSkillMd(md);
  const { description } = displayNameAndDescriptionFromParsed(parsed, 'demo-skill');
  assert.equal(description, 'First line Second line');
});

test('parseSkillMd reads real skill-base-cli SKILL.md with >- description', () => {
  const md = fs.readFileSync(
    path.join(__dirname, '../skills/skill-base-cli/SKILL.md'),
    'utf8'
  );
  const parsed = parseSkillMd(md);
  const { description } = displayNameAndDescriptionFromParsed(parsed, 'skill-base-cli');
  assert.ok(description.includes('Skill Base CLI'));
  assert.ok(description.length > 100);
});

test('displayNameAndDescriptionFromParsed prefers YAML name over heading', () => {
  const md = `---
name: yaml-name
---
# Heading Title
`;
  const parsed = parseSkillMd(md);
  const { name } = displayNameAndDescriptionFromParsed(parsed, 'fallback-id');
  assert.equal(name, 'yaml-name');
});

test('parseBodyHeading joins markdown blockquote lines', () => {
  const md = `---
name: ignored
---
# Blockquote Title

> Trigger when user asks for foo.
> Also when they mention bar.

## Next
`;
  const parsed = parseSkillMd(md);
  const { name, description } = displayNameAndDescriptionFromParsed(parsed, 'fallback');
  assert.equal(name, 'ignored');
  assert.equal(
    description,
    'Trigger when user asks for foo. Also when they mention bar.'
  );
});

test('parseSkillMd falls back to block parser when YAML is invalid', () => {
  const md = `---
name: broken-yaml
description: >-
  Folded line one
  Folded line two
invalid: [unclosed
---
# Title
`;
  const parsed = parseSkillMd(md);
  const { description } = displayNameAndDescriptionFromParsed(parsed, 'broken-yaml');
  assert.equal(description, 'Folded line one Folded line two');
});
