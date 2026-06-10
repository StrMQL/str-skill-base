/**
 * Bridge smoke tests: start bridge, exercise IPC channels over HTTP /invoke.
 *
 * Usage:
 *   node scripts/smoke-bridge.mjs              # quick: config:get
 *   node scripts/smoke-bridge.mjs --bundled    # use esbuild bundle
 *   node scripts/smoke-bridge.mjs --all        # all bridge-routable channels
 */
import http from 'node:http';
import os from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DESKTOP_IPC_CHANNELS } from '../../cli/lib/desktop-ipc-channels.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const bundled = path.join(root, 'src-tauri/resources/bridge/server.mjs');
const devScript = path.join(root, 'bridge/server.mjs');
const script = process.argv.includes('--bundled') ? bundled : devScript;
const allChannels = process.argv.includes('--all');
const cliLib = path.join(root, '..', 'cli', 'lib');

const RUST_NATIVE_CHANNELS = new Set([
  'project:pickRoot',
  'project:pickInstallDir',
  'shell:revealPath',
  'auth:openLogin',
  'skills:openWebPage'
]);

const child = spawn(process.execPath, [script], {
  env: {
    ...process.env,
    SKB_BRIDGE_NO_OPEN: '1',
    SKB_CLI_LIB_ROOT: cliLib
  },
  stdio: ['ignore', 'pipe', 'inherit']
});

const port = await new Promise((resolve, reject) => {
  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const match = buf.match(/BRIDGE_READY port=(\d+)/);
    if (match) resolve(Number(match[1]));
  });
  child.on('error', reject);
  child.on('exit', (code) => {
    if (!buf.includes('BRIDGE_READY')) {
      reject(new Error(`bridge exited ${code} before ready`));
    }
  });
});

async function bridgeInvoke(channel, args = []) {
  const body = JSON.stringify({ channel, args });
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/invoke',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function assertOk(label, resp, validate) {
  if (!resp.ok) {
    throw new Error(`${label}: ${resp.error || 'not ok'}`);
  }
  if (validate && !validate(resp.result)) {
    throw new Error(`${label}: unexpected result ${JSON.stringify(resp.result)}`);
  }
}

function assertError(label, resp, includes) {
  if (resp.ok) {
    throw new Error(`${label}: expected error but got ok`);
  }
  const msg = resp.error || '';
  if (includes && !msg.includes(includes)) {
    throw new Error(`${label}: expected "${includes}" in "${msg}"`);
  }
}

async function runQuick() {
  const result = await bridgeInvoke('config:get', []);
  assertOk('config:get', result, (r) => r && typeof r.baseUrl === 'string');
  console.log('bridge smoke ok:', result.result.baseUrl);
}

async function runAllChannels() {
  const home = os.homedir();
  let savedBaseUrl = '';

  const cases = [
    {
      name: 'config:get',
      run: async () => {
        const r = await bridgeInvoke('config:get');
        assertOk('config:get', r, (v) => typeof v.baseUrl === 'string');
        savedBaseUrl = r.result.baseUrl;
      }
    },
    {
      name: 'config:setServer',
      run: async () => {
        const r = await bridgeInvoke('config:setServer', ['http://localhost:8000']);
        assertOk('config:setServer', r, (v) => v.baseUrl === 'http://localhost:8000');
      }
    },
    {
      name: 'config:getGlobalTargets',
      run: async () => {
        const r = await bridgeInvoke('config:getGlobalTargets');
        assertOk('config:getGlobalTargets', r, (v) => Array.isArray(v) && v.length > 0);
      }
    },
    {
      name: 'config:getProjectTargetTemplates',
      run: async () => {
        const r = await bridgeInvoke('config:getProjectTargetTemplates');
        assertOk('config:getProjectTargetTemplates', r, (v) => Array.isArray(v) && v.length > 0);
      }
    },
    {
      name: 'config:getProjectTargets',
      run: async () => {
        const r = await bridgeInvoke('config:getProjectTargets', [home]);
        assertOk('config:getProjectTargets', r, (v) => Array.isArray(v));
      }
    },
    {
      name: 'project:getRoot',
      run: async () => {
        const r = await bridgeInvoke('project:getRoot');
        assertOk('project:getRoot', r, (v) => typeof v === 'string');
      }
    },
    {
      name: 'project:setRoot',
      run: async () => {
        const r = await bridgeInvoke('project:setRoot', [home]);
        assertOk('project:setRoot', r, (v) => v === home);
      }
    },
    {
      name: 'auth:whoami',
      run: async () => {
        const r = await bridgeInvoke('auth:whoami');
        assertOk('auth:whoami', r, (v) => typeof v.ok === 'boolean');
      }
    },
    {
      name: 'auth:logout',
      run: async () => {
        const r = await bridgeInvoke('auth:logout');
        assertOk('auth:logout', r, (v) => v.ok === true);
      }
    },
    {
      name: 'auth:exchangePat (invalid format)',
      run: async () => {
        const r = await bridgeInvoke('auth:exchangePat', ['bad']);
        assertError('auth:exchangePat', r, '验证码格式无效');
      }
    },
    {
      name: 'skills:getInstalled',
      run: async () => {
        const r = await bridgeInvoke('skills:getInstalled');
        assertOk('skills:getInstalled', r, (v) => Array.isArray(v));
      }
    },
    {
      name: 'skills:install (validation)',
      run: async () => {
        const r = await bridgeInvoke('skills:install', [{}]);
        assertError('skills:install', r, 'skillId required');
      }
    },
    {
      name: 'skills:update (validation)',
      run: async () => {
        const r = await bridgeInvoke('skills:update', [{}]);
        assertError('skills:update', r, 'skillId and version required');
      }
    },
    {
      name: 'skills:delete (validation)',
      run: async () => {
        const r = await bridgeInvoke('skills:delete', [{}]);
        assertError('skills:delete', r, 'skillId required');
      }
    },
    {
      name: 'skills:openWebPage (validation)',
      run: async () => {
        const r = await bridgeInvoke('skills:openWebPage', [{}]);
        assertError('skills:openWebPage', r, 'skillId required');
      }
    },
    {
      name: 'collections:get (validation)',
      run: async () => {
        const r = await bridgeInvoke('collections:get', ['']);
        assertError('collections:get', r, 'collection ref required');
      }
    },
    {
      name: 'collections:install (validation)',
      run: async () => {
        const r = await bridgeInvoke('collections:install', [{}]);
        assertError('collections:install', r, 'collection ref required');
      }
    },
    {
      name: 'skills:search (network)',
      run: async () => {
        const r = await bridgeInvoke('skills:search', ['']);
        if (r.ok) {
          if (!Array.isArray(r.result)) throw new Error('skills:search: expected array');
        } else if (!/fetch|ECONNREFUSED|network|连接|超时/i.test(r.error || '')) {
          throw new Error(`skills:search: unexpected error: ${r.error}`);
        }
      }
    },
    {
      name: 'collections:list (network)',
      run: async () => {
        const r = await bridgeInvoke('collections:list', []);
        if (r.ok) {
          if (!Array.isArray(r.result)) throw new Error('collections:list: expected array');
        } else if (!/fetch|ECONNREFUSED|network|连接|超时/i.test(r.error || '')) {
          throw new Error(`collections:list: unexpected error: ${r.error}`);
        }
      }
    },
    {
      name: 'skills:getVersions (network)',
      run: async () => {
        const r = await bridgeInvoke('skills:getVersions', ['__smoke_nonexistent__']);
        if (!r.ok && !/404|not found|不存在|fetch|ECONNREFUSED/i.test(r.error || '')) {
          throw new Error(`skills:getVersions: unexpected error: ${r.error}`);
        }
      }
    },
    {
      name: 'skills:getRemote (network)',
      run: async () => {
        const r = await bridgeInvoke('skills:getRemote', ['__smoke_nonexistent__']);
        if (!r.ok && !/404|not found|不存在|fetch|ECONNREFUSED/i.test(r.error || '')) {
          throw new Error(`skills:getRemote: unexpected error: ${r.error}`);
        }
      }
    }
  ];

  const skipped = DESKTOP_IPC_CHANNELS.filter((c) => RUST_NATIVE_CHANNELS.has(c));
  console.log(`bridge channel smoke (${cases.length} automated, ${skipped.length} native/Tauri manual)`);

  for (const tc of cases) {
    await tc.run();
    console.log(`  ok  ${tc.name}`);
  }

  if (savedBaseUrl) {
    await bridgeInvoke('config:setServer', [savedBaseUrl]);
  }

  console.log('skipped (Rust native — see ACCEPTANCE.md):');
  for (const ch of skipped) {
    console.log(`  —   ${ch}`);
  }
  console.log('all bridge channel smoke passed');
}

try {
  if (allChannels) {
    await runAllChannels();
  } else {
    await runQuick();
  }
} catch (err) {
  console.error('smoke failed:', err.message || err);
  process.exitCode = 1;
} finally {
  child.kill();
}
