import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  deleteSkillInstallDirs,
  listSkillInstalls,
  rememberSkillInstall
} from '../../cli/lib/installs.js';
import { resolveDeleteTargets } from '../../cli/lib/commands/delete.js';

function withTempHome(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'skb-delete-home-'));
  const oldHome = process.env.HOME;
  const oldUserProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    return fn(home);
  } finally {
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = oldUserProfile;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

function makeInstall(parent, skillId) {
  const dir = path.join(parent, skillId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `# ${skillId}\n`, 'utf8');
  return dir;
}

test('deleteSkillInstallDirs deletes multiple recorded install directories', () => {
  withTempHome(() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skb-delete-target-'));
    const a = makeInstall(path.join(root, 'one'), 'demo-skill');
    const b = makeInstall(path.join(root, 'two'), 'demo-skill');

    rememberSkillInstall({ skillId: 'demo-skill', installPath: a, version: 'v1' });
    rememberSkillInstall({ skillId: 'demo-skill', installPath: b, version: 'v1' });

    const result = deleteSkillInstallDirs('demo-skill', [a, b]);

    assert.equal(result.deleted.length, 2);
    assert.equal(result.skipped.length, 0);
    assert.equal(fs.existsSync(a), false);
    assert.equal(fs.existsSync(b), false);
    assert.deepEqual(listSkillInstalls('demo-skill'), []);

    fs.rmSync(root, { recursive: true, force: true });
  });
});

test('deleteSkillInstallDirs skips recorded paths whose basename does not match skill id', () => {
  withTempHome(() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skb-delete-unsafe-'));
    const bad = path.join(root, 'not-demo-skill');
    fs.mkdirSync(bad, { recursive: true });

    rememberSkillInstall({ skillId: 'demo-skill', installPath: bad, version: 'v1' });
    const result = deleteSkillInstallDirs('demo-skill', [bad]);

    assert.equal(result.deleted.length, 0);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.skipped[0].reason, 'unsafe_path');
    assert.equal(fs.existsSync(bad), true);
    assert.equal(listSkillInstalls('demo-skill').length, 1);

    fs.rmSync(root, { recursive: true, force: true });
  });
});

test('resolveDeleteTargets accepts install paths and parent directories', () => {
  const root = path.join(os.tmpdir(), 'skb-delete-resolve');
  const installs = [
    { installPath: path.join(root, 'a', 'demo-skill') },
    { installPath: path.join(root, 'b', 'demo-skill') },
    { installPath: path.join(root, 'c', 'demo-skill') }
  ];

  assert.deepEqual(resolveDeleteTargets(installs, { all: true }), installs);
  assert.deepEqual(
    resolveDeleteTargets(installs, { dir: [path.join(root, 'a', 'demo-skill'), path.join(root, 'b')] }),
    [installs[0], installs[1]]
  );
  assert.equal(resolveDeleteTargets(installs, {}), null);
});
