const test = require('node:test');
const assert = require('node:assert/strict');
const AdmZip = require('adm-zip');
const { isJunkZipPath, sanitizeZipBuffer } = require('../src/utils/zip-sanitize');

test('isJunkZipPath detects __MACOSX at any depth', () => {
  assert.equal(isJunkZipPath('__MACOSX/foo'), true);
  assert.equal(isJunkZipPath('my-skill/__MACOSX/._SKILL.md'), true);
  assert.equal(isJunkZipPath('my-skill/SKILL.md'), false);
});

test('sanitizeZipBuffer removes __MACOSX entries', () => {
  const z = new AdmZip();
  z.addFile('demo-skill/SKILL.md', Buffer.from('# Demo\n\nok'));
  z.addFile('__MACOSX/demo-skill/._SKILL.md', Buffer.from('junk'));
  z.addFile('demo-skill/scripts/run.sh', Buffer.from('#!/bin/sh'));

  const out = sanitizeZipBuffer(z.toBuffer());
  const names = new AdmZip(out).getEntries().map((e) => e.entryName.replace(/\\/g, '/'));

  assert.deepEqual(names.sort(), ['demo-skill/SKILL.md', 'demo-skill/scripts/run.sh']);
});

test('sanitizeZipBuffer returns same buffer for non-zip data', () => {
  const buf = Buffer.from('not-a-zip');
  assert.equal(sanitizeZipBuffer(buf), buf);
});

test('sanitizeZipBuffer returns same buffer when no junk', () => {
  const z = new AdmZip();
  z.addFile('skill/SKILL.md', Buffer.from('# X'));
  const buf = z.toBuffer();
  assert.equal(sanitizeZipBuffer(buf), buf);
});
