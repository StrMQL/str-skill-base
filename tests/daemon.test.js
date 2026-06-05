const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  getDaemonStatus,
  startDaemon,
  stopDaemon,
  getPidPath,
  getLogPath
} = require('../src/utils/daemon');

const BIN = path.join(__dirname, '..', 'bin', 'skill-base.js');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skill-base-daemon-'));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('getDaemonStatus reports stale pid files', () => {
  const dir = makeTempDir();
  fs.writeFileSync(getPidPath(dir), '999999');
  const status = getDaemonStatus(dir);
  assert.equal(status.running, false);
  assert.equal(status.stale, true);
  assert.equal(fs.existsSync(getPidPath(dir)), false);
});

test('startDaemon and stopDaemon manage a background process', async () => {
  const dir = makeTempDir();
  const port = 18000 + Math.floor(Math.random() * 1000);

  const { pid, logFile } = startDaemon({
    entryScript: BIN,
    args: ['-d', dir, '-p', String(port), '--no-cappy', '--host', '127.0.0.1'],
    dataDir: dir,
    env: { ...process.env, ENABLE_CAPPY: 'false', DEBUG: 'false' }
  });

  assert.ok(pid > 0);
  assert.equal(fs.existsSync(getPidPath(dir)), true);
  assert.equal(fs.existsSync(logFile), true);

  let ready = false;
  for (let i = 0; i < 30; i++) {
    const status = getDaemonStatus(dir);
    if (!status.running) break;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      // server still starting
    }
    await sleep(200);
  }

  assert.equal(ready, true, 'daemon server should respond to health check');

  const stopped = stopDaemon(dir);
  assert.equal(stopped.wasRunning, true);
  assert.equal(stopped.stopped, true);
  assert.equal(fs.existsSync(getPidPath(dir)), false);
});

test('bin --daemon refuses duplicate start', async () => {
  const dir = makeTempDir();
  const port = 19000 + Math.floor(Math.random() * 1000);

  const run = (extraArgs) =>
    new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [BIN, '-d', dir, '-p', String(port), '--host', '127.0.0.1', '--no-cappy', ...extraArgs],
        { env: { ...process.env, LANG: 'en_US.UTF-8' } }
      );
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    });

  const first = await run(['--daemon']);
  assert.equal(first.code, 0);
  assert.match(first.stdout, /started in background/i);

  const second = await run(['--daemon']);
  assert.equal(second.code, 1);
  assert.match(second.stderr, /already running/i);

  const stopped = stopDaemon(dir);
  assert.equal(stopped.stopped, true);
});

test('multiple daemons are isolated by data directory', async () => {
  const dirA = makeTempDir();
  const dirB = makeTempDir();
  const portA = 20000 + Math.floor(Math.random() * 500);
  const portB = portA + 1;
  const commonArgs = ['--no-cappy', '--host', '127.0.0.1'];

  const daemonA = startDaemon({
    entryScript: BIN,
    args: ['-d', dirA, '-p', String(portA), ...commonArgs],
    dataDir: dirA,
    env: { ...process.env, ENABLE_CAPPY: 'false', DEBUG: 'false' }
  });
  const daemonB = startDaemon({
    entryScript: BIN,
    args: ['-d', dirB, '-p', String(portB), ...commonArgs],
    dataDir: dirB,
    env: { ...process.env, ENABLE_CAPPY: 'false', DEBUG: 'false' }
  });

  assert.notEqual(daemonA.pid, daemonB.pid);
  assert.equal(getDaemonStatus(dirA).running, true);
  assert.equal(getDaemonStatus(dirB).running, true);

  let readyA = false;
  let readyB = false;
  for (let i = 0; i < 30; i++) {
    if (!readyA) {
      try {
        const res = await fetch(`http://127.0.0.1:${portA}/api/v1/health`);
        readyA = res.ok;
      } catch {
        // still starting
      }
    }
    if (!readyB) {
      try {
        const res = await fetch(`http://127.0.0.1:${portB}/api/v1/health`);
        readyB = res.ok;
      } catch {
        // still starting
      }
    }
    if (readyA && readyB) break;
    await sleep(200);
  }

  assert.equal(readyA, true);
  assert.equal(readyB, true);

  const stoppedA = stopDaemon(dirA);
  assert.equal(stoppedA.stopped, true);
  assert.equal(getDaemonStatus(dirA).running, false);
  assert.equal(getDaemonStatus(dirB).running, true);

  const stoppedB = stopDaemon(dirB);
  assert.equal(stoppedB.stopped, true);
});

test('bin --daemon disables cappy by default', async () => {
  const dir = makeTempDir();
  const port = 21000 + Math.floor(Math.random() * 500);

  const result = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [BIN, '-d', dir, '-p', String(port), '--host', '127.0.0.1', '-v', '--daemon'],
      { env: { ...process.env, LANG: 'en_US.UTF-8' } }
    );
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('close', (code) => resolve({ code, stdout }));
  });

  assert.equal(result.code, 0);

  let log = '';
  for (let i = 0; i < 30; i++) {
    if (fs.existsSync(getLogPath(dir))) {
      log = fs.readFileSync(getLogPath(dir), 'utf8');
      if (/CappyMascot is disabled/i.test(log)) break;
    }
    await sleep(200);
  }

  assert.match(log, /CappyMascot is disabled/i);
  assert.doesNotMatch(log, /CappyMascot is enabled/i);

  stopDaemon(dir);
});
