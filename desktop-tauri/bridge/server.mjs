import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadDesktopCli } from '../../cli/lib/desktop-cli.mjs';
import {
  registerDesktopHandlers,
  DESKTOP_IPC_CHANNELS
} from '../../cli/lib/desktop-handlers.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_LIB_ROOT =
  process.env.SKB_CLI_LIB_ROOT || path.resolve(__dirname, '../../cli/lib');

let projectRoot = '';

function appendLog(message) {
  const logPath = process.env.SKB_DESKTOP_LOG;
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Logging must never break the bridge.
  }
}

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
  appendLog(`bridge main starting platform=${process.platform} cliLib=${CLI_LIB_ROOT}`);
  const cli = await loadDesktopCli(CLI_LIB_ROOT);
  const { handlers, getSavedProjectRoot } = registerDesktopHandlers(cli, CLI_LIB_ROOT, {
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
  appendLog(`bridge projectRoot=${projectRoot}`);

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
    appendLog(`ipc start channel=${channel}`);
    if (!DESKTOP_IPC_CHANNELS.includes(channel)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: `invalid channel: ${channel}` }));
      appendLog(`ipc invalid channel=${channel}`);
      return;
    }

    const handler = handlers[channel];
    const argList = Array.isArray(args) ? args : [args];

    try {
      const result = await handler(...argList);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, result: result ?? null }));
      const summary = Array.isArray(result) ? `array(${result.length})` : typeof result;
      appendLog(`ipc ok channel=${channel} result=${summary}`);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err?.message || String(err) }));
      appendLog(`ipc error channel=${channel}: ${err?.stack || err}`);
    }
  });

  server.listen(0, '127.0.0.1', () => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    appendLog(`bridge listening port=${port}`);
    process.stdout.write(`BRIDGE_READY port=${port}\n`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  appendLog(`bridge fatal: ${err?.stack || err}`);
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
