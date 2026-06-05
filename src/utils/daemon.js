const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PID_FILE = 'skill-base.pid';
const LOG_FILE = 'skill-base.log';

function getDefaultDataDir() {
  return path.join(__dirname, '../../data');
}

function resolveDataDir(explicitDataDir) {
  return explicitDataDir ? path.resolve(explicitDataDir) : getDefaultDataDir();
}

function getPidPath(dataDir) {
  return path.join(dataDir, PID_FILE);
}

function getLogPath(dataDir) {
  return path.join(dataDir, LOG_FILE);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function readPid(dataDir) {
  const file = getPidPath(dataDir);
  if (!fs.existsSync(file)) return null;
  const pid = parseInt(fs.readFileSync(file, 'utf8').trim(), 10);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function removePidFile(dataDir) {
  const file = getPidPath(dataDir);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

function getDaemonStatus(dataDir) {
  const pid = readPid(dataDir);
  if (!pid) {
    return { running: false, pid: null, stale: false };
  }
  if (isProcessAlive(pid)) {
    return { running: true, pid, stale: false };
  }
  removePidFile(dataDir);
  return { running: false, pid, stale: true };
}

function sleepMs(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait — CLI stop/status only
  }
}

function stopDaemon(dataDir) {
  const status = getDaemonStatus(dataDir);
  if (!status.running) {
    return { stopped: false, wasRunning: false, pid: status.pid, stale: status.stale };
  }

  try {
    process.kill(status.pid, 'SIGTERM');
  } catch (err) {
    removePidFile(dataDir);
    throw err;
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!isProcessAlive(status.pid)) {
      removePidFile(dataDir);
      return { stopped: true, wasRunning: true, pid: status.pid, force: false };
    }
    sleepMs(200);
  }

  try {
    process.kill(status.pid, 'SIGKILL');
  } catch {
    // already gone
  }
  removePidFile(dataDir);
  return { stopped: true, wasRunning: true, pid: status.pid, force: true };
}

function startDaemon({ entryScript, args, dataDir, env }) {
  const status = getDaemonStatus(dataDir);
  if (status.running) {
    const err = new Error('ALREADY_RUNNING');
    err.pid = status.pid;
    throw err;
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const logFile = getLogPath(dataDir);
  const logFd = fs.openSync(logFile, 'a');
  const child = spawn(process.execPath, [entryScript, ...args], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env
  });
  fs.closeSync(logFd);
  child.unref();

  fs.writeFileSync(getPidPath(dataDir), String(child.pid));
  return { pid: child.pid, logFile };
}

module.exports = {
  PID_FILE,
  LOG_FILE,
  getDefaultDataDir,
  resolveDataDir,
  getPidPath,
  getLogPath,
  getDaemonStatus,
  startDaemon,
  stopDaemon
};
