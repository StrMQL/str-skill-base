import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DESKTOP_IPC_CHANNELS } from './desktop-ipc-channels.mjs';
import { parseSkillMd, displayNameAndDescriptionFromParsed } from './skill-md.js';

export { DESKTOP_IPC_CHANNELS };

/**
 * @param {object} cli merged desktop CLI module exports
 * @param {string} cliLibRoot reserved (esbuild bundle uses static cli imports)
 * @param {{
 *   pickDirectory: (defaultPath?: string) => Promise<string | null>,
 *   revealPath: (resolvedPath: string) => Promise<{ ok: true }>,
 *   openExternal: (url: string) => Promise<void>,
 *   getProjectRoot: () => string,
 *   setProjectRoot: (root: string) => void,
 * }} deps platform-specific shell hooks
 */
export function registerDesktopHandlers(cli, cliLibRoot, deps) {
  function getSavedProjectRoot() {
    const saved = cli.loadSavedConfig();
    if (saved.desktopProjectRoot && fs.existsSync(saved.desktopProjectRoot)) {
      return saved.desktopProjectRoot;
    }
    return os.homedir();
  }

  function saveProjectRoot(root) {
    cli.saveConfig({ desktopProjectRoot: root });
    deps.setProjectRoot(root);
  }

  async function readLocalSkillMeta(installPath) {
    const skillMd = path.join(installPath, 'SKILL.md');
    const fallbackName = path.basename(installPath);
    if (!fs.existsSync(skillMd)) {
      return { name: fallbackName, description: '' };
    }
    const content = fs.readFileSync(skillMd, 'utf-8');
    const parsed = parseSkillMd(content);
    const { name, description } = displayNameAndDescriptionFromParsed(parsed, fallbackName);
    return { name: name || fallbackName, description: description || '' };
  }

  function targetPathExists(targetPath) {
    try {
      return fs.existsSync(targetPath);
    } catch {
      return false;
    }
  }

  function sortTargetsByExists(targets) {
    return [...targets].sort((a, b) => {
      const ae = a.exists ? 1 : 0;
      const be = b.exists ? 1 : 0;
      if (ae !== be) return be - ae;
      return a.name.localeCompare(b.name);
    });
  }

  function buildGlobalTargets() {
    const { IDE_CONFIGS } = cli;
    const targets = [];
    for (const config of Object.values(IDE_CONFIGS)) {
      if (config.supportsGlobal && config.globalPath) {
        const targetPath = path.join(os.homedir(), config.globalPath);
        targets.push({
          id: `${config.id}:global`,
          name: config.name,
          path: targetPath,
          ide: config.id,
          global: true,
          exists: targetPathExists(targetPath)
        });
      }
    }
    return sortTargetsByExists(targets);
  }

  function buildProjectTargetTemplates() {
    const { IDE_CONFIGS } = cli;
    return Object.values(IDE_CONFIGS)
      .map((config) => ({
        id: `${config.id}:project`,
        name: config.name,
        relPath: config.projectPath,
        ide: config.id,
        global: false,
        exists: false
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function buildProjectTargets(cwd) {
    const { IDE_CONFIGS, findProjectRoot } = cli;
    const root = findProjectRoot(cwd || deps.getProjectRoot() || os.homedir());
    const targets = [];
    for (const config of Object.values(IDE_CONFIGS)) {
      const targetPath = path.join(root, config.projectPath);
      targets.push({
        id: `${config.id}:project`,
        name: config.name,
        relPath: config.projectPath,
        path: targetPath,
        ide: config.id,
        global: false,
        projectRoot: root,
        exists: targetPathExists(targetPath)
      });
    }
    return sortTargetsByExists(targets);
  }

  function resolveInstallTarget(entry, installProjectRoot) {
    if (entry.customDir) {
      const dir = path.resolve(entry.customDir);
      return {
        targetDir: dir,
        ide: '',
        global: false,
        nestedCheckDir: dir,
        label: dir,
        kind: 'custom'
      };
    }

    const targetId = entry.targetId;
    if (!targetId) return null;

    if (targetId.endsWith(':global')) {
      const target = buildGlobalTargets().find((t) => t.id === targetId);
      if (!target) return null;
      return {
        targetDir: target.path,
        ide: target.ide,
        global: true,
        nestedCheckDir: deps.getProjectRoot(),
        label: target.path,
        kind: 'global'
      };
    }

    if (targetId.endsWith(':project')) {
      const root = installProjectRoot || deps.getProjectRoot();
      if (!root) return null;
      const target = buildProjectTargets(root).find((t) => t.id === targetId);
      if (!target) return null;
      return {
        targetDir: target.path,
        ide: target.ide,
        global: false,
        nestedCheckDir: root,
        label: `${target.name} · ${target.relPath}`,
        kind: 'project'
      };
    }

    return null;
  }

  const handlers = {
    'config:get': async () => {
      const { baseUrl } = cli.getConfig();
      const cred = cli.loadCredentials();
      return {
        baseUrl,
        username: cred?.username || null,
        hasToken: Boolean(cred?.token),
        projectRoot: deps.getProjectRoot()
      };
    },

    'config:setServer': async (url) => {
      const normalized = String(url || '').replace(/\/+$/, '');
      if (!normalized) throw new Error('Server URL required');
      cli.saveConfig({ baseUrl: normalized });
      return { baseUrl: normalized };
    },

    'config:getGlobalTargets': async () => buildGlobalTargets(),

    'config:getProjectTargets': async (cwd) => {
      const dir = typeof cwd === 'string' && cwd.trim() ? cwd.trim() : deps.getProjectRoot();
      return buildProjectTargets(dir);
    },

    'config:getProjectTargetTemplates': async () => buildProjectTargetTemplates(),

    'project:getRoot': async () => deps.getProjectRoot(),

    'project:setRoot': async (root) => {
      const normalized = typeof root === 'string' ? root.trim() : '';
      if (!normalized) throw new Error('项目目录不能为空');
      if (!fs.existsSync(normalized)) throw new Error('项目目录不存在');
      saveProjectRoot(normalized);
      return deps.getProjectRoot();
    },

    'project:pickRoot': async () => {
      const picked = await deps.pickDirectory(deps.getProjectRoot());
      if (!picked) return null;
      saveProjectRoot(picked);
      return deps.getProjectRoot();
    },

    'project:pickInstallDir': async (defaultPath) => {
      const picked = await deps.pickDirectory(
        defaultPath || deps.getProjectRoot() || os.homedir()
      );
      return picked;
    },

    'shell:revealPath': async (rawPath) => {
      const trimmed = String(rawPath || '').trim();
      if (!trimmed) throw new Error('路径不能为空');

      const expanded = trimmed.startsWith('~')
        ? path.join(os.homedir(), trimmed.slice(1).replace(/^[/\\]/, ''))
        : trimmed;
      const resolved = path.resolve(expanded);

      if (!fs.existsSync(resolved)) throw new Error('路径不存在');

      return deps.revealPath(resolved);
    },

    'auth:openLogin': async () => {
      const { baseUrl } = cli.getConfig();
      await deps.openExternal(`${baseUrl}/login?from=cli`);
    },

    'skills:openWebPage': async (payload) => {
      const { baseUrl } = cli.getConfig();
      const base = String(baseUrl || '').replace(/\/+$/, '');
      if (!base) throw new Error('未配置服务器地址');

      const skillId = String(payload?.skillId || '').trim();
      if (!skillId) throw new Error('skillId required');

      let url;
      if (payload?.page === 'diff') {
        const versionA = String(payload.version_a || '').trim();
        const versionB = String(payload.version_b || '').trim();
        if (!versionA || !versionB) throw new Error('缺少对比版本');
        const q = new URLSearchParams({
          id: skillId,
          version_a: versionA,
          version_b: versionB
        });
        url = `${base}/diff?${q.toString()}`;
      } else {
        const version = String(payload?.version || '').trim();
        url = version
          ? `${base}/skills/${encodeURIComponent(skillId)}?version=${encodeURIComponent(version)}`
          : `${base}/skills/${encodeURIComponent(skillId)}`;
      }

      await deps.openExternal(url);
      return { url };
    },

    'auth:exchangePat': async (code) => {
      const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
      const normalized = String(code || '').trim().toUpperCase();
      if (!pattern.test(normalized)) {
        throw new Error('验证码格式无效，请输入 8 位字符（例如 8A2B-9C4F）');
      }
      const client = cli.createClient();
      const result = await client.post('/auth/cli-code/verify', { code: normalized });
      if (!result.ok || !result.token || !result.user) {
        throw new Error('验证失败，请检查验证码');
      }
      cli.saveCredentials({ token: result.token, username: result.user.username });
      return { username: result.user.username };
    },

    'auth:whoami': async () => {
      const { baseUrl } = cli.getConfig();
      const cred = cli.loadCredentials();
      if (!cred?.token) {
        return { ok: false, reason: 'no_token', baseUrl };
      }
      try {
        const client = cli.createClient();
        const me = await client.get('/auth/me');
        return { ok: true, baseUrl, user: me };
      } catch (err) {
        return { ok: false, reason: 'invalid_token', baseUrl, detail: err.message };
      }
    },

    'auth:logout': async () => {
      cli.removeCredentials();
      return { ok: true };
    },

    'skills:search': async (q) => {
      const client = cli.createClient();
      const query = String(q || '').trim();
      const result = await client.get(`/skills?q=${encodeURIComponent(query)}`);
      return result.skills || [];
    },

    'skills:getVersions': async (skillId) => {
      const client = cli.createClient();
      const result = await client.get(`/skills/${encodeURIComponent(skillId)}/versions`);
      return result.versions || [];
    },

    'skills:getRemote': async (skillId) => {
      const client = cli.createClient();
      return client.get(`/skills/${encodeURIComponent(skillId)}`);
    },

    'skills:getInstalled': async () => {
      cli.pruneAllMissingInstalls();
      const rows = cli.listInstalledSkills();
      const client = cli.createClient();
      const enriched = [];

      for (const row of rows) {
        let remote = null;
        try {
          remote = await client.get(`/skills/${encodeURIComponent(row.skillId)}`);
        } catch {
          // offline or skill removed from server
        }
        const firstPath = row.installs[0]?.installPath;
        const meta = firstPath
          ? await readLocalSkillMeta(firstPath)
          : { name: row.skillId, description: '' };
        enriched.push({
          skillId: row.skillId,
          name: meta.name,
          description: meta.description,
          version: row.installs[0]?.version || '',
          latest: remote?.latest_version || row.installs[0]?.version || '',
          author: remote?.owner_username || '',
          installs: row.installs
        });
      }
      return enriched;
    },

    'skills:install': async (payload) => {
      const skillId = String(payload?.skillId || '').trim();
      const version = payload?.version || 'latest';
      const installProjectRoot =
        typeof payload?.projectRoot === 'string' ? payload.projectRoot.trim() : '';
      const overwrite = Boolean(payload?.overwrite);
      const acceptNested = Boolean(payload?.acceptNested);
      const rawTargets = Array.isArray(payload?.targets) ? payload.targets : [];

      if (!skillId) {
        throw new Error('skillId required');
      }
      if (rawTargets.length === 0) {
        throw new Error('请至少选择一个安装目录');
      }

      const resolved = [];
      for (const entry of rawTargets) {
        const spec = resolveInstallTarget(entry, installProjectRoot);
        if (!spec) {
          throw new Error('无效的安装目标');
        }
        resolved.push(spec);
      }

      for (const spec of resolved) {
        const insideIde = cli.detectInsideIdeDir(spec.nestedCheckDir);
        if (insideIde && !acceptNested) {
          return {
            ok: false,
            code: 'NESTED_IDE_PATH',
            detail:
              spec.kind === 'custom'
                ? `所选目录已在 ${insideIde.name} 的 skill 路径内，若仍要安装请勾选确认嵌套。`
                : spec.kind === 'project'
                  ? `项目目录已在 ${insideIde.name} 的 skill 路径内，若仍要安装请勾选确认嵌套。`
                  : `当前目录已在 ${insideIde.name} 的 skill 路径内，若仍要安装请勾选确认嵌套。`,
            ideId: insideIde.id
          };
        }
      }

      for (const spec of resolved) {
        const installPathCandidate = path.join(path.resolve(spec.targetDir), skillId);
        if (fs.existsSync(installPathCandidate) && !overwrite) {
          return {
            ok: false,
            code: 'EXISTS',
            detail: '目标目录已存在同名 Skill，请勾选覆盖后重试。',
            path: installPathCandidate
          };
        }
      }

      const installed = [];
      let actualVersion = version;

      for (const spec of resolved) {
        fs.mkdirSync(spec.targetDir, { recursive: true });
        const installPathCandidate = path.join(path.resolve(spec.targetDir), skillId);
        if (fs.existsSync(installPathCandidate)) {
          fs.rmSync(installPathCandidate, { recursive: true, force: true });
        }

        const result = await cli.downloadAndExtract(skillId, version, spec.targetDir);
        actualVersion = result.version;
        const installPath = path.join(result.targetDir, skillId);
        cli.rememberSkillInstall({
          skillId: result.skillId,
          installPath,
          version: result.version,
          ide: spec.ide,
          isGlobal: spec.global
        });
        installed.push({ installPath, version: result.version, label: spec.label });
      }

      return {
        ok: true,
        skillId,
        version: actualVersion,
        installed
      };
    },

    'skills:update': async (payload) => {
      const skillId = String(payload?.skillId || '').trim();
      const version = String(payload?.version || '').trim();
      let installPaths = Array.isArray(payload?.installPaths)
        ? payload.installPaths.filter((p) => typeof p === 'string')
        : null;

      if (!skillId || !version) throw new Error('skillId and version required');

      const options = {};
      const installs = cli.buildTargetInstalls(skillId, options);
      if (installs.length === 0) {
        throw new Error(`本地没有记录到 ${skillId} 的安装目录`);
      }

      if (!installPaths || installPaths.length === 0) {
        const implicit = cli.resolveImplicitSelectedInstalls(installs, options);
        if (!implicit) {
          return {
            ok: false,
            code: 'PICK_PATHS',
            detail: '存在多个安装目录，请选择要更新的路径。',
            installs
          };
        }
        installPaths = implicit.map((i) => i.installPath);
      }

      const selected = installs.filter((i) => installPaths.includes(i.installPath));
      if (selected.length === 0) throw new Error('no matching install paths');

      const updated = [];
      for (const install of selected) {
        const result = await cli.downloadAndExtract(
          skillId,
          version,
          path.dirname(install.installPath)
        );
        cli.rememberSkillInstall({
          skillId: result.skillId,
          installPath: install.installPath,
          version: result.version,
          ide: install.ide,
          isGlobal: install.isGlobal
        });
        updated.push({ installPath: install.installPath, version: result.version });
      }
      return { ok: true, updated };
    }
  };

  return { handlers, getSavedProjectRoot };
}
