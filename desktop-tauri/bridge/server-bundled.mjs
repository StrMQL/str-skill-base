/**
 * Production bridge entry — all cli/lib code is inlined by esbuild via desktop-cli-static.
 */
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadDesktopCliStatic } from '../../cli/lib/desktop-cli-static.mjs';
import {
  registerDesktopHandlers,
  DESKTOP_IPC_CHANNELS
} from '../../cli/lib/desktop-handlers.mjs';

const execFileAsync = promisify(execFile);

let projectRoot = '';

async function openExternal(url) {
  if (process.env.SKB_BRIDGE_NO_OPEN === '1') return;
  if (process.platform === 'darwin') {
    await execFileAsync('open', [url]);
  } else if (process.platform === 'win32') {
    await execFileAsync('cmd', ['/c', 'start', '', url], { shell: true });
  } else {
    await execFileAsync('xdg-open', [url]);
  }
}

async function revealPath(resolved) {
  if (process.platform === 'darwin') {
    await execFileAsync('open', ['-R', resolved]);
  } else if (process.platform === 'win32') {
    await execFileAsync('explorer', [`/select,${resolved}`], { shell: true });
  } else {
    await execFileAsync('xdg-open', [path.dirname(resolved)]);
  }
  return { ok: true };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function main() {
  const cli = loadDesktopCliStatic();
  const { handlers, getSavedProjectRoot } = registerDesktopHandlers(cli, '', {
    pickDirectory: async () => {
      throw new Error('pickDirectory must be handled by the desktop shell (Tauri/Electron)');
    },
    revealPath,
    openExternal,
    getProjectRoot: () => projectRoot,
    setProjectRoot: (root) => {
      projectRoot = root;
    }
  });
  projectRoot = getSavedProjectRoot();

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/invoke') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not found' }));
      return;
    }

    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
      return;
    }

    const { channel, args = [] } = payload;
    if (!DESKTOP_IPC_CHANNELS.includes(channel)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: `invalid channel: ${channel}` }));
      return;
    }

    const handler = handlers[channel];
    const argList = Array.isArray(args) ? args : [args];

    try {
      const result = await handler(...argList);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, result: result ?? null }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err?.message || String(err) }));
    }
  });

  server.listen(0, '127.0.0.1', () => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    process.stdout.write(`BRIDGE_READY port=${port}\n`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
