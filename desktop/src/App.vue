<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const currentTab = ref('installed');
const searchQuery = ref('');
const marketQuery = ref('');
const marketOnlyFavorites = ref(false);
const marketSelectedTagIds = ref([]);
const showMarketTagDropdown = ref(false);
const marketTagDropdownRef = ref(null);

const config = ref({ baseUrl: '', username: null, hasToken: false, projectRoot: '' });
const installedSkills = ref([]);
const marketSkills = ref([]);
const globalTargets = ref([]);
const projectTargets = ref([]);

const toastMessage = ref('');
const loading = ref(false);

// Settings modal
const settingsModalOpen = ref(false);
const registryUrl = ref('');
const verificationCode = ref('');
const patReady = ref(false);
const isExchangingPat = ref(false);
const isTestingConnection = ref(false);

// Install modal
const installModalOpen = ref(false);
const installSkill = ref(null);
const installVersion = ref('latest');
const installTargetTab = ref('global');
const selectedGlobalTargetIds = ref([]);
const selectedProjectTargetIds = ref([]);
const customDirOptions = ref([]);
const selectedCustomDirs = ref([]);
const installProjectRoot = ref('');
const installProjectRootPicked = ref(false);
const installOverwrite = ref(false);
const installAcceptNested = ref(false);
const installNestedWarn = ref(false);
const installing = ref(false);
const agentTargetFilter = ref('');

// Update modal
const updateModalOpen = ref(false);
const updateSkill = ref(null);
const updateVersions = ref([]);
const updateSelectedVersion = ref('');
const updateInstallPaths = ref([]);
const updateSelectedPaths = ref([]);
const updating = ref(false);

// Paths modal
const pathsModalOpen = ref(false);
const pathsModalSkill = ref(null);

const DIR_PREVIEW_COUNT = 2;
const PATH_DISPLAY_MAX = 52;

const updatesAvailable = computed(() =>
  installedSkills.value.filter((s) => s.version && s.latest && s.version !== s.latest).length
);

const currentTabLabel = computed(() => {
  if (currentTab.value === 'installed') return '本地资产';
  if (currentTab.value === 'market') return '技能市场';
  return currentTab.value;
});

const updateSelectedVersionDetail = computed(() =>
  updateVersions.value.find((v) => v.version === updateSelectedVersion.value) || null
);

const canOpenUpdateVersionDiff = computed(() => {
  const installed = updateSkill.value?.version;
  const selected = updateSelectedVersion.value;
  return Boolean(
    installed && selected && installed !== selected && updateVersions.value.length >= 2
  );
});

const canConfirmInstall = computed(() => {
  if (installTargetTab.value === 'custom') return selectedCustomDirs.value.length > 0;
  if (installTargetTab.value === 'global') return selectedGlobalTargetIds.value.length > 0;
  if (installTargetTab.value === 'project') {
    return Boolean(installProjectRootPicked.value && selectedProjectTargetIds.value.length > 0);
  }
  return false;
});

const projectAgentStepDisabled = computed(() => !installProjectRootPicked.value);

function toggleSelection(list, id) {
  const idx = list.indexOf(id);
  if (idx === -1) list.push(id);
  else list.splice(idx, 1);
}

function toggleGlobalTarget(id) {
  toggleSelection(selectedGlobalTargetIds.value, id);
}

function toggleProjectTarget(id) {
  if (projectAgentStepDisabled.value) return;
  toggleSelection(selectedProjectTargetIds.value, id);
}

function toggleCustomDir(dir) {
  toggleSelection(selectedCustomDirs.value, dir);
}

function buildInstallTargetsPayload() {
  if (installTargetTab.value === 'custom') {
    return selectedCustomDirs.value.map((customDir) => ({ customDir }));
  }
  if (installTargetTab.value === 'global') {
    return selectedGlobalTargetIds.value.map((targetId) => ({ targetId }));
  }
  return selectedProjectTargetIds.value.map((targetId) => ({ targetId }));
}

function showToast(msg) {
  toastMessage.value = msg;
  setTimeout(() => {
    toastMessage.value = '';
  }, 3500);
}

function normalizePath(p) {
  if (!p) return '';
  return p.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~');
}

/** 卡片内展示：保留 ~ 前缀，路径尽量完整，过长则中间省略 */
function formatPath(p, maxLen = PATH_DISPLAY_MAX) {
  const display = normalizePath(p);
  if (display.length <= maxLen) return display;
  const edge = Math.floor((maxLen - 1) / 2);
  return `${display.slice(0, edge)}…${display.slice(-edge)}`;
}

function versionUploaderLabel(version) {
  const u = version?.uploader;
  if (!u) return '未知';
  return u.name || u.username || '未知';
}

/** versions 按 created_at 降序；返回 diff 页所需的 version_a（旧）/ version_b（新） */
function diffVersionPair(installedVer, selectedVer, versionsList) {
  const idxInstalled = versionsList.findIndex((v) => v.version === installedVer);
  const idxSelected = versionsList.findIndex((v) => v.version === selectedVer);
  if (idxInstalled === -1 || idxSelected === -1) {
    return { version_a: installedVer, version_b: selectedVer };
  }
  return idxInstalled > idxSelected
    ? { version_a: installedVer, version_b: selectedVer }
    : { version_a: selectedVer, version_b: installedVer };
}

async function openUpdateVersionOnline(page = 'detail') {
  const skill = updateSkill.value;
  if (!skill?.skillId || !updateSelectedVersion.value) return;
  if (!config.value.baseUrl) {
    promptConfigureServer();
    return;
  }
  try {
    const payload = { skillId: skill.skillId };
    if (page === 'diff' && canOpenUpdateVersionDiff.value) {
      const pair = diffVersionPair(
        skill.version,
        updateSelectedVersion.value,
        updateVersions.value
      );
      payload.page = 'diff';
      payload.version_a = pair.version_a;
      payload.version_b = pair.version_b;
    } else {
      payload.version = updateSelectedVersion.value;
    }
    await window.skb.invoke('skills:openWebPage', payload);
  } catch (e) {
    showToast(`打开失败: ${e.message}`);
  }
}

function openPathsModal(skill) {
  pathsModalSkill.value = skill;
  pathsModalOpen.value = true;
}

const revealPathHint = '在 Finder / 资源管理器中打开';

async function revealInstallPath(installPath) {
  try {
    await window.skb.invoke('shell:revealPath', installPath);
  } catch (e) {
    showToast(`无法打开: ${e.message}`);
  }
}

function isInstalled(skillId) {
  return installedSkills.value.some((s) => s.skillId === skillId);
}

async function loadGlobalTargets() {
  globalTargets.value = await window.skb.invoke('config:getGlobalTargets');
}

async function loadProjectTargetTemplates() {
  projectTargets.value = await window.skb.invoke('config:getProjectTargetTemplates');
}

async function loadProjectTargets() {
  if (!installProjectRoot.value) {
    await loadProjectTargetTemplates();
    return;
  }
  projectTargets.value = await window.skb.invoke(
    'config:getProjectTargets',
    installProjectRoot.value
  );
}

async function loadConfig() {
  config.value = await window.skb.invoke('config:get');
  registryUrl.value = config.value.baseUrl || '';
  patReady.value = config.value.hasToken;
  installProjectRoot.value = config.value.projectRoot || '';
  await loadGlobalTargets();
}

async function loadInstalled() {
  loading.value = true;
  try {
    installedSkills.value = await window.skb.invoke('skills:getInstalled');
  } catch (e) {
    showToast(`加载失败: ${e.message}`);
  } finally {
    loading.value = false;
  }
}

async function loadMarket() {
  loading.value = true;
  try {
    marketSkills.value = await window.skb.invoke('skills:search', '');
  } catch (e) {
    showToast(`加载失败: ${e.message}`);
  } finally {
    loading.value = false;
  }
}

const marketAvailableTags = computed(() => {
  const map = new Map();
  for (const skill of marketSkills.value) {
    for (const tag of skill.tags || []) {
      if (!map.has(tag.id)) map.set(tag.id, tag);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
});

const filteredMarketSkills = computed(() => {
  let result = marketSkills.value;

  if (marketOnlyFavorites.value) {
    result = result.filter((skill) => skill.is_favorited);
  }

  const tagIds = marketSelectedTagIds.value;
  if (tagIds.length > 0) {
    const need = new Set(tagIds);
    result = result.filter((skill) => {
      const have = (skill.tags || []).map((t) => t.id);
      return have.some((id) => need.has(id));
    });
  }

  const q = marketQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (skill) =>
        skill.name?.toLowerCase().includes(q) ||
        skill.description?.toLowerCase().includes(q) ||
        skill.id?.toLowerCase().includes(q)
    );
  }

  return result;
});

function isMarketTagSelected(id) {
  return marketSelectedTagIds.value.includes(id);
}

function toggleMarketTag(id) {
  const cur = marketSelectedTagIds.value;
  const i = cur.indexOf(id);
  if (i === -1) marketSelectedTagIds.value = [...cur, id];
  else marketSelectedTagIds.value = cur.filter((x) => x !== id);
}

function clearMarketTagFilter() {
  marketSelectedTagIds.value = [];
}

function toggleMarketTagDropdown() {
  showMarketTagDropdown.value = !showMarketTagDropdown.value;
}

function closeMarketTagDropdown() {
  showMarketTagDropdown.value = false;
}

function onDocumentPointerDown(e) {
  if (!showMarketTagDropdown.value) return;
  const root = marketTagDropdownRef.value;
  if (root?.contains(e.target)) return;
  closeMarketTagDropdown();
}

function marketOwnerLabel(skill) {
  return skill.owner?.name || skill.owner?.username || skill.id;
}

async function openMarketSkillDetail(skill) {
  if (!skill?.id) return;
  if (!config.value.baseUrl) {
    promptConfigureServer();
    return;
  }
  try {
    await window.skb.invoke('skills:openWebPage', { skillId: skill.id });
  } catch (e) {
    showToast(`打开失败: ${e.message}`);
  }
}

async function pickProjectRoot() {
  const root = await window.skb.invoke('project:pickRoot');
  if (root) {
    config.value.projectRoot = root;
    showToast(`项目目录: ${root}`);
  }
}

async function openInstallModal(skill) {
  installSkill.value = skill;
  installVersion.value = skill.latest_version || skill.latest || 'latest';
  installOverwrite.value = false;
  installAcceptNested.value = false;
  installNestedWarn.value = false;
  customDirOptions.value = [];
  selectedCustomDirs.value = [];
  installProjectRoot.value = '';
  installProjectRootPicked.value = false;
  installTargetTab.value = 'global';
  agentTargetFilter.value = '';
  selectedGlobalTargetIds.value = [];
  selectedProjectTargetIds.value = [];
  await loadGlobalTargets();
  await loadProjectTargetTemplates();
  installModalOpen.value = true;
}

async function pickCustomInstallDir() {
  const dir = await window.skb.invoke(
    'project:pickInstallDir',
    customDirOptions.value[0] || installProjectRoot.value || config.value.projectRoot
  );
  if (!dir) return;
  if (!customDirOptions.value.includes(dir)) {
    customDirOptions.value.push(dir);
  }
  if (!selectedCustomDirs.value.includes(dir)) {
    selectedCustomDirs.value.push(dir);
  }
  installTargetTab.value = 'custom';
}

async function pickInstallProjectRoot() {
  const dir = await window.skb.invoke(
    'project:pickInstallDir',
    installProjectRoot.value || config.value.projectRoot
  );
  if (!dir) return;
  installProjectRoot.value = dir;
  installProjectRootPicked.value = true;
  config.value.projectRoot = dir;
  selectedProjectTargetIds.value = [];
  await window.skb.invoke('project:setRoot', dir);
  await loadProjectTargets();
  installTargetTab.value = 'project';
}

watch(installTargetTab, async (tab) => {
  if (tab === 'project' && projectTargets.value.length === 0) {
    await loadProjectTargetTemplates();
  }
});

async function confirmInstall() {
  if (!installSkill.value || !canConfirmInstall.value) return;
  installing.value = true;
  try {
    const skillId = installSkill.value.id || installSkill.value.skillId;
    const result = await window.skb.invoke('skills:install', {
      skillId,
      version: installVersion.value,
      targets: buildInstallTargetsPayload(),
      projectRoot: installTargetTab.value === 'project' ? installProjectRoot.value : undefined,
      overwrite: installOverwrite.value,
      acceptNested: installAcceptNested.value
    });

    if (!result.ok) {
      if (result.code === 'NESTED_IDE_PATH') {
        installNestedWarn.value = true;
        showToast(result.detail);
        return;
      }
      if (result.code === 'EXISTS') {
        showToast(result.detail);
        return;
      }
      throw new Error(result.detail || '安装失败');
    }

    installModalOpen.value = false;
    const count = result.installed?.length || 0;
    showToast(`已安装 ${skillId} 到 ${count} 个目录`);
    await loadInstalled();
  } catch (e) {
    showToast(`安装失败: ${e.message}`);
  } finally {
    installing.value = false;
  }
}

async function openUpdateModal(skill) {
  updateSkill.value = skill;
  updateSelectedPaths.value = skill.installs.map((i) => i.installPath);
  updateModalOpen.value = true;
  try {
    updateVersions.value = await window.skb.invoke('skills:getVersions', skill.skillId);
    updateSelectedVersion.value = updateVersions.value[0]?.version || skill.latest;
    updateInstallPaths.value = skill.installs;
  } catch (e) {
    showToast(`加载版本失败: ${e.message}`);
    updateModalOpen.value = false;
  }
}

async function confirmUpdate() {
  if (!updateSkill.value) return;
  updating.value = true;
  try {
    const paths = updateInstallPaths.value.length > 1 ? updateSelectedPaths.value : null;
    const result = await window.skb.invoke('skills:update', {
      skillId: updateSkill.value.skillId,
      version: updateSelectedVersion.value,
      installPaths: paths
    });

    if (!result.ok && result.code === 'PICK_PATHS') {
      updateInstallPaths.value = result.installs;
      showToast(result.detail);
      return;
    }

    updateModalOpen.value = false;
    showToast(`已更新 ${updateSkill.value.skillId}`);
    await loadInstalled();
  } catch (e) {
    showToast(`更新失败: ${e.message}`);
  } finally {
    updating.value = false;
  }
}

async function updateOne(skill) {
  skill._updating = true;
  try {
    const result = await window.skb.invoke('skills:update', {
      skillId: skill.skillId,
      version: skill.latest
    });
    if (!result.ok) throw new Error(result.detail || '更新失败');
    showToast(`已更新 ${skill.skillId} → v${skill.latest}`);
    await loadInstalled();
  } catch (e) {
    showToast(`更新失败: ${e.message}`);
  } finally {
    skill._updating = false;
  }
}

async function updateAll() {
  const pending = installedSkills.value.filter((s) => s.version !== s.latest);
  for (const skill of pending) {
    await updateOne(skill);
  }
}

async function saveServer() {
  try {
    await window.skb.invoke('config:setServer', registryUrl.value);
    await loadConfig();
    showToast('服务器地址已保存');
  } catch (e) {
    showToast(`保存失败: ${e.message}`);
  }
}

async function exchangePat() {
  if (!verificationCode.value) {
    showToast('请输入验证码');
    return;
  }
  isExchangingPat.value = true;
  try {
    const result = await window.skb.invoke('auth:exchangePat', verificationCode.value);
    patReady.value = true;
    verificationCode.value = '';
    await loadConfig();
    showToast(`登录成功: ${result.username}`);
  } catch (e) {
    showToast(`验证失败: ${e.message}`);
  } finally {
    isExchangingPat.value = false;
  }
}

async function testConnection() {
  isTestingConnection.value = true;
  try {
    const result = await window.skb.invoke('auth:whoami');
    if (result.ok) {
      showToast(`连接正常 · ${result.user.username}`);
    } else if (result.reason === 'no_token') {
      showToast('未登录，但服务器地址可访问（部分功能无需登录）');
      await window.skb.invoke('skills:search', 'a').catch(() => {
        throw new Error('无法连接服务器');
      });
      showToast('服务器连接正常（未登录）');
    } else {
      throw new Error(result.detail || '认证失败');
    }
  } catch (e) {
    showToast(`连接失败: ${e.message}`);
  } finally {
    isTestingConnection.value = false;
  }
}

async function openLoginPage() {
  await window.skb.invoke('auth:openLogin');
}

async function logout() {
  try {
    await window.skb.invoke('auth:logout');
    patReady.value = false;
    await loadConfig();
    showToast('已退出登录');
  } catch (e) {
    showToast(`退出失败: ${e.message}`);
  }
}

function openSettingsModal() {
  settingsModalOpen.value = true;
}

function promptConfigureServer() {
  showToast('请先在设置中配置服务器地址');
  openSettingsModal();
}

function toggleUpdatePath(p) {
  const idx = updateSelectedPaths.value.indexOf(p);
  if (idx === -1) updateSelectedPaths.value.push(p);
  else updateSelectedPaths.value.splice(idx, 1);
}

function filteredInstalled() {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return installedSkills.value;
  return installedSkills.value.filter(
    (s) =>
      s.skillId.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
  );
}

function matchAgentTarget(target, q) {
  const haystack = [target.name, target.id, target.ide, target.path, target.relPath]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

const filteredGlobalTargets = computed(() => {
  const q = agentTargetFilter.value.trim().toLowerCase();
  if (!q) return globalTargets.value;
  return globalTargets.value.filter((t) => matchAgentTarget(t, q));
});

const filteredProjectTargets = computed(() => {
  const q = agentTargetFilter.value.trim().toLowerCase();
  if (!q) return projectTargets.value;
  return projectTargets.value.filter((t) => matchAgentTarget(t, q));
});

watch(currentTab, (tab) => {
  if (tab === 'installed') loadInstalled();
  if (tab === 'market' && marketSkills.value.length === 0) loadMarket();
});

onMounted(async () => {
  document.addEventListener('mousedown', onDocumentPointerDown, true);
  await loadConfig();
  await loadInstalled();
});

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentPointerDown, true);
});
</script>

<template>
  <div v-cloak class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar glass-panel">
      <div class="sidebar-header">
        <div class="logo-icon">
          <i class="fa-solid fa-bolt"></i>
        </div>
        <h1>SkillBase</h1>
      </div>

      <nav class="sidebar-nav">
        <button
          :class="['nav-btn', { active: currentTab === 'installed' }]"
          @click="currentTab = 'installed'"
        >
          <i class="fa-solid fa-box-archive"></i>
          本地资产管理
        </button>
        <button
          :class="['nav-btn', { active: currentTab === 'market' }]"
          @click="currentTab = 'market'"
        >
          <i class="fa-solid fa-globe"></i>
          技能市场
        </button>
      </nav>

      <div class="sidebar-bottom">
        <button class="nav-btn" @click="openSettingsModal">
          <i class="fa-solid fa-sliders"></i>
          连接设置
        </button>
      </div>

      <div class="sidebar-status">
        <span class="status-dot"></span>
        <span class="status-text">{{ config.baseUrl || '未配置' }}</span>
      </div>
    </aside>

    <!-- Main -->
    <main class="main-area">
      <header class="top-bar glass-panel">
        <div class="top-bar-left">
          <i class="fa-solid fa-folder-open"></i>
          <button
            class="project-path"
            :title="config.projectRoot || '选择项目目录'"
            @click="pickProjectRoot"
          >
            {{ formatPath(config.projectRoot || '~', 40) }}
          </button>
          <span class="breadcrumb">/ {{ currentTabLabel }}</span>
        </div>
      </header>

      <div
        v-if="currentTab === 'installed' || currentTab === 'market'"
        class="content-toolbar"
        :class="{ 'content-toolbar--market': currentTab === 'market' }"
      >
        <div class="toolbar-row">
          <div class="search-box">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input
              v-if="currentTab === 'installed'"
              v-model="searchQuery"
              type="search"
              placeholder="搜索本地 Skill..."
            />
            <input
              v-else
              v-model="marketQuery"
              type="search"
              placeholder="搜索技能名称、描述..."
            />
            <button
              v-if="currentTab === 'market' && marketQuery"
              type="button"
              class="search-clear-btn"
              title="清除搜索"
              @click="marketQuery = ''"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div v-if="currentTab === 'market'" class="market-filter-actions">
          <button
            type="button"
            class="filter-chip"
            :class="{ 'filter-chip--active': marketOnlyFavorites }"
            @click="marketOnlyFavorites = !marketOnlyFavorites"
          >
            <i class="fa-solid fa-heart"></i>
            仅收藏
          </button>

          <div
            v-if="marketAvailableTags.length > 0"
            ref="marketTagDropdownRef"
            class="tag-filter-dropdown"
            :class="{ 'tag-filter-dropdown--open': showMarketTagDropdown }"
          >
            <button
              type="button"
              class="filter-chip tag-filter-trigger"
              :class="{ 'filter-chip--active': marketSelectedTagIds.length > 0 }"
              @click="toggleMarketTagDropdown"
            >
              <i class="fa-solid fa-tags"></i>
              标签
              <span v-if="marketSelectedTagIds.length > 0" class="tag-filter-badge">
                {{ marketSelectedTagIds.length }}
              </span>
              <i class="fa-solid fa-chevron-down tag-filter-chevron"></i>
            </button>
            <div
              v-show="showMarketTagDropdown"
              class="tag-filter-panel"
            >
              <div class="tag-filter-panel-header">
                <p class="tag-filter-hint">可多选，匹配任一标签即显示</p>
                <button
                  v-if="marketSelectedTagIds.length > 0"
                  type="button"
                  class="tag-filter-clear"
                  @click="clearMarketTagFilter"
                >
                  <i class="fa-solid fa-xmark"></i>
                  清除
                </button>
              </div>
              <div class="tag-filter-options">
                <button
                  v-for="tag in marketAvailableTags"
                  :key="tag.id"
                  type="button"
                  class="tag-filter-option"
                  :class="{ 'tag-filter-option--active': isMarketTagSelected(tag.id) }"
                  @click="toggleMarketTag(tag.id)"
                >
                  <span class="tag-filter-option-check">
                    <i v-if="isMarketTagSelected(tag.id)" class="fa-solid fa-check"></i>
                  </span>
                  <span class="tag-filter-option-label">{{ tag.name }}</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="btn-ghost toolbar-refresh-btn"
            :disabled="loading"
            title="从服务器刷新列表"
            @click="loadMarket"
          >
            <i class="fa-solid fa-arrows-rotate" :class="{ 'fa-spin': loading }"></i>
          </button>
          </div>
        </div>
      </div>

      <div class="content-area">
        <Transition name="fade" mode="out-in">
          <!-- Installed -->
          <div v-if="currentTab === 'installed'" key="installed">
            <div class="section-header">
              <div>
                <h2>
                  本地资产
                  <span class="accent">({{ installedSkills.length }})</span>
                </h2>
                <p class="subtitle">跨 Agent 目录集中管理，一键同步版本更新。</p>
              </div>
              <button
                v-if="updatesAvailable > 0"
                class="btn-primary"
                @click="updateAll"
              >
                <i class="fa-solid fa-cloud-arrow-down"></i>
                同步更新所有 ({{ updatesAvailable }})
              </button>
            </div>

            <div v-if="loading && !installedSkills.length" class="empty-state">
              <i class="fa-solid fa-circle-notch fa-spin"></i> 加载中...
            </div>
            <div v-else-if="!filteredInstalled().length" class="empty-state">
              暂无本地安装记录，前往技能市场安装。
            </div>
            <div v-else class="skill-grid-3">
              <div
                v-for="skill in filteredInstalled()"
                :key="skill.skillId"
                class="skill-card glass-panel glow-hover"
              >
                <div class="skill-card-top">
                  <div class="skill-icon">
                    <i class="fa-solid fa-cube"></i>
                  </div>
                  <div class="skill-info">
                    <div class="skill-title-row">
                      <h3>{{ skill.name }}</h3>
                      <span class="version-tag">v{{ skill.version || '?' }}</span>
                      <span
                        v-if="skill.version !== skill.latest"
                        class="update-badge"
                      >
                        <i class="fa-solid fa-arrow-up"></i> v{{ skill.latest }}
                      </span>
                    </div>
                    <p class="skill-desc line-clamp-2">{{ skill.description || skill.skillId }}</p>
                  </div>
                  <div class="skill-actions">
                    <button
                      class="btn-icon"
                      title="选择更新目录"
                      @click="openUpdateModal(skill)"
                    >
                      <i class="fa-solid fa-network-wired"></i>
                    </button>
                    <button
                      v-if="skill.version !== skill.latest"
                      class="btn-icon update-btn"
                      :disabled="skill._updating"
                      title="更新"
                      @click="updateOne(skill)"
                    >
                      <i
                        class="fa-solid fa-rotate"
                        :class="{ 'fa-spin': skill._updating }"
                      ></i>
                    </button>
                    <button v-else class="btn-icon" disabled title="已是最新">
                      <i class="fa-solid fa-check"></i>
                    </button>
                  </div>
                </div>
                <div class="skill-dirs">
                  <button
                    v-for="inst in skill.installs.slice(0, DIR_PREVIEW_COUNT)"
                    :key="inst.installPath"
                    type="button"
                    class="dir-tag dir-tag--reveal"
                    :title="`${inst.installPath}\n${revealPathHint}`"
                    @click="revealInstallPath(inst.installPath)"
                  >
                    <i class="fa-solid fa-folder-open"></i>
                    <span class="dir-tag-text">{{ formatPath(inst.installPath) }}</span>
                  </button>
                  <button
                    v-if="skill.installs.length > DIR_PREVIEW_COUNT"
                    type="button"
                    class="dir-tag dir-tag-more"
                    @click="openPathsModal(skill)"
                  >
                    +{{ skill.installs.length - DIR_PREVIEW_COUNT }} 查看全部
                  </button>
                  <span v-if="!skill.installs.length" class="dir-tag error">
                    未挂载
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Market -->
          <div v-else-if="currentTab === 'market'" key="market">
            <div class="section-header">
              <div>
                <h2>技能市场</h2>
                <p class="subtitle">从 Skill Base 服务端拉取团队共享 Agent 能力。</p>
              </div>
            </div>

            <div v-if="loading && !marketSkills.length" class="empty-state">
              <i class="fa-solid fa-circle-notch fa-spin"></i> 加载中...
            </div>
            <div v-else-if="!filteredMarketSkills.length" class="empty-state">
              <template v-if="marketQuery || marketOnlyFavorites || marketSelectedTagIds.length">
                无匹配结果，请调整搜索或筛选条件。
              </template>
              <template v-else>
                暂无技能，请检查服务器连接或点击刷新。
              </template>
            </div>
            <div v-else class="skill-grid-3">
              <div
                v-for="skill in filteredMarketSkills"
                :key="skill.id"
                class="market-card glass-panel"
              >
                <div class="market-card-glow"></div>
                <div class="market-card-header">
                  <h3>{{ skill.name }}</h3>
                  <div class="market-card-header-actions">
                    <span class="version-tag">v{{ skill.latest_version || '-' }}</span>
                    <button
                      type="button"
                      class="btn-icon market-detail-btn"
                      title="在浏览器中打开详情"
                      @click="openMarketSkillDetail(skill)"
                    >
                      <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                  </div>
                </div>
                <p class="skill-desc line-clamp-2">{{ skill.description }}</p>
                <div class="market-card-stats">
                  <span class="market-stat" title="下载次数">
                    <i class="fa-solid fa-download"></i>
                    {{ skill.download_count ?? 0 }}
                  </span>
                  <span
                    class="market-stat"
                    :class="{ 'market-stat--favorited': skill.is_favorited }"
                    :title="skill.is_favorited ? '已收藏' : '收藏数'"
                  >
                    <i class="fa-solid fa-heart"></i>
                    {{ skill.favorite_count ?? 0 }}
                  </span>
                </div>
                <div class="market-card-footer">
                  <span class="author">
                    <i class="fa-regular fa-user"></i>
                    {{ marketOwnerLabel(skill) }}
                  </span>
                  <button
                    class="install-btn"
                    :class="{ installed: isInstalled(skill.id) }"
                    :disabled="isInstalled(skill.id)"
                    @click="openInstallModal(skill)"
                  >
                    <i v-if="isInstalled(skill.id)" class="fa-solid fa-check"></i>
                    <i v-else class="fa-solid fa-download"></i>
                    {{ isInstalled(skill.id) ? '已安装' : '安装' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>

    </main>

    <!-- Toast (above modal overlays) -->
    <Transition name="fade">
      <div v-if="toastMessage" class="toast glass-panel">
        <i class="fa-solid fa-terminal"></i>
        <span>{{ toastMessage }}</span>
      </div>
    </Transition>

    <!-- Install Modal -->
    <div v-if="installModalOpen" class="modal-overlay" @click.self="installModalOpen = false">
      <div class="modal-panel glass-panel">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-download text-indigo"></i>
            安装 / {{ installSkill?.name || installSkill?.id }}
          </h3>
          <button class="btn-icon" @click="installModalOpen = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <label class="field-label">版本</label>
          <input v-model="installVersion" type="text" placeholder="latest" class="font-mono" />

          <label class="field-label" style="margin-top: 1rem">安装目标</label>

          <nav class="install-target-tabs">
            <button
              type="button"
              :class="{ active: installTargetTab === 'global' }"
              @click="installTargetTab = 'global'"
            >
              <i class="fa-solid fa-globe"></i>
              全局 Agent
            </button>
            <button
              type="button"
              :class="{ active: installTargetTab === 'project' }"
              @click="installTargetTab = 'project'"
            >
              <i class="fa-solid fa-robot"></i>
              项目 Agent
            </button>
            <button
              type="button"
              :class="{ active: installTargetTab === 'custom' }"
              @click="installTargetTab = 'custom'"
            >
              <i class="fa-solid fa-folder-open"></i>
              自定义目录
            </button>
          </nav>

          <!-- Tab: 全局 Agent -->
          <div v-if="installTargetTab === 'global'" class="install-tab-panel">
            <p class="settings-hint">可多选，安装到用户主目录下的 Agent 全局 skill 路径。</p>
            <div v-if="selectedGlobalTargetIds.length" class="selection-count">
              已选 {{ selectedGlobalTargetIds.length }} 个
            </div>
            <div v-if="!globalTargets.length" class="empty-hint">暂无可用全局目录</div>
            <template v-else>
              <div class="target-list-filter search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input
                  v-model="agentTargetFilter"
                  type="search"
                  placeholder="筛选 Agent（名称或路径）..."
                  @click.stop
                />
              </div>
              <div v-if="!filteredGlobalTargets.length" class="empty-hint">无匹配的 Agent</div>
              <div v-else class="target-list">
              <div
                v-for="target in filteredGlobalTargets"
                :key="target.id"
                :class="[
                  'target-option',
                  {
                    selected: selectedGlobalTargetIds.includes(target.id),
                    'target-exists': target.exists
                  }
                ]"
                @click="toggleGlobalTarget(target.id)"
              >
                <div class="target-info">
                  <div class="target-icon">
                    <i class="fa-solid fa-globe"></i>
                  </div>
                  <div class="target-info-text">
                    <div class="target-name-row">
                      <p class="target-name">{{ target.name }}</p>
                      <span v-if="target.exists" class="target-exists-badge">目录已存在</span>
                    </div>
                    <p class="target-path font-mono">{{ formatPath(target.path, 64) }}</p>
                  </div>
                </div>
                <div :class="['checkbox-box', { checked: selectedGlobalTargetIds.includes(target.id) }]">
                  <i v-if="selectedGlobalTargetIds.includes(target.id)" class="fa-solid fa-check"></i>
                </div>
              </div>
              </div>
            </template>
          </div>

          <!-- Tab: 项目 Agent -->
          <div v-else-if="installTargetTab === 'project'" class="install-tab-panel">
            <p class="settings-hint">第一步选择项目根目录，第二步勾选 Agent 在项目内的相对路径（可多选）。</p>

            <div class="project-step">
              <label class="field-label step-label">① 项目根目录</label>
              <div class="project-root-picker">
                <div class="target-option compact" :class="{ selected: installProjectRootPicked }">
                  <div class="target-info">
                    <div class="target-icon">
                      <i class="fa-solid fa-folder-tree"></i>
                    </div>
                    <div class="target-info-text">
                      <p class="target-path font-mono">
                        {{ installProjectRoot ? formatPath(installProjectRoot, 64) : '请选择项目根目录' }}
                      </p>
                    </div>
                  </div>
                  <button type="button" class="btn-ghost pick-dir-btn" @click="pickInstallProjectRoot">
                    选择项目…
                  </button>
                </div>
              </div>
            </div>

            <div class="project-step" :class="{ 'step-disabled': projectAgentStepDisabled }">
              <label class="field-label step-label">② Agent 目录</label>
              <p v-if="projectAgentStepDisabled" class="settings-hint step-hint">
                请先完成第一步，再勾选要写入的 Agent 目录。
              </p>
              <p v-else-if="selectedProjectTargetIds.length" class="selection-count">
                已选 {{ selectedProjectTargetIds.length }} 个 · 相对项目根
              </p>
              <div class="target-list-filter search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input
                  v-model="agentTargetFilter"
                  type="search"
                  placeholder="筛选 Agent（名称或路径）..."
                  :disabled="projectAgentStepDisabled"
                  @click.stop
                />
              </div>
              <div
                v-if="!projectAgentStepDisabled && !filteredProjectTargets.length"
                class="empty-hint"
              >
                无匹配的 Agent
              </div>
              <div class="target-list">
                <div
                  v-for="target in filteredProjectTargets"
                  :key="target.id"
                  :class="[
                    'target-option',
                    {
                      selected: selectedProjectTargetIds.includes(target.id),
                      'is-disabled': projectAgentStepDisabled,
                      'target-exists': target.exists
                    }
                  ]"
                  @click="toggleProjectTarget(target.id)"
                >
                  <div class="target-info">
                    <div class="target-icon">
                      <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="target-info-text">
                      <div class="target-name-row">
                        <p class="target-name">{{ target.name }}</p>
                        <span v-if="target.exists" class="target-exists-badge">目录已存在</span>
                      </div>
                      <p class="target-rel font-mono">{{ target.relPath }}</p>
                    </div>
                  </div>
                  <div
                    :class="[
                      'checkbox-box',
                      { checked: selectedProjectTargetIds.includes(target.id) }
                    ]"
                  >
                    <i
                      v-if="selectedProjectTargetIds.includes(target.id)"
                      class="fa-solid fa-check"
                    ></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: 自定义目录 -->
          <div v-else class="install-tab-panel">
            <p class="settings-hint">可添加多个文件夹，勾选要安装的目标（Skill 以子目录落地）。</p>
            <div class="custom-dir-toolbar">
              <button type="button" class="btn-ghost pick-dir-btn" @click="pickCustomInstallDir">
                <i class="fa-solid fa-plus"></i> 添加目录…
              </button>
              <span v-if="selectedCustomDirs.length" class="selection-count">
                已选 {{ selectedCustomDirs.length }} 个
              </span>
            </div>
            <div v-if="!customDirOptions.length" class="empty-hint">请点击「添加目录」选择安装位置</div>
            <div v-else class="target-list">
              <div
                v-for="dir in customDirOptions"
                :key="dir"
                :class="['target-option', { selected: selectedCustomDirs.includes(dir) }]"
                @click="toggleCustomDir(dir)"
              >
                <div class="target-info">
                  <div class="target-icon">
                    <i class="fa-solid fa-folder-open"></i>
                  </div>
                  <div class="target-info-text">
                    <p class="target-path font-mono">{{ formatPath(dir, 64) }}</p>
                  </div>
                </div>
                <div :class="['checkbox-box', { checked: selectedCustomDirs.includes(dir) }]">
                  <i v-if="selectedCustomDirs.includes(dir)" class="fa-solid fa-check"></i>
                </div>
              </div>
            </div>
          </div>

          <label class="label-row">
            <input v-model="installOverwrite" type="checkbox" />
            覆盖已存在的同名目录
          </label>
          <label v-if="installNestedWarn" class="label-row">
            <input v-model="installAcceptNested" type="checkbox" />
            确认在 Agent skill 目录内嵌套安装
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="installModalOpen = false">取消</button>
          <button class="btn-primary" :disabled="installing || !canConfirmInstall" @click="confirmInstall">
            <i v-if="installing" class="fa-solid fa-circle-notch fa-spin"></i>
            安装
          </button>
        </div>
      </div>
    </div>

    <!-- Update Modal -->
    <div v-if="updateModalOpen" class="modal-overlay" @click.self="updateModalOpen = false">
      <div class="modal-panel glass-panel">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-rotate text-indigo"></i>
            更新 / {{ updateSkill?.skillId }}
          </h3>
          <button class="btn-icon" @click="updateModalOpen = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <label class="field-label">版本</label>
          <select v-model="updateSelectedVersion">
            <option v-for="(v, i) in updateVersions" :key="v.version" :value="v.version">
              {{ v.version }}{{ i === 0 ? '（最新）' : '' }}
            </option>
          </select>

          <div v-if="updateSelectedVersionDetail" class="version-detail">
            <p class="version-detail-row">
              <span class="version-detail-label">提交人</span>
              <span class="version-detail-value font-mono">
                @{{ versionUploaderLabel(updateSelectedVersionDetail) }}
              </span>
            </p>
            <p class="version-detail-changelog">
              {{ updateSelectedVersionDetail.changelog || '暂无 changelog' }}
            </p>
            <div class="version-detail-actions">
              <button type="button" class="btn-ghost version-detail-btn" @click="openUpdateVersionOnline('detail')">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                在线查看
              </button>
              <button
                v-if="canOpenUpdateVersionDiff"
                type="button"
                class="btn-ghost version-detail-btn"
                @click="openUpdateVersionOnline('diff')"
              >
                <i class="fa-solid fa-code-compare"></i>
                对比当前安装版本
              </button>
            </div>
          </div>

          <div v-if="updateInstallPaths.length > 1" style="margin-top: 1rem">
            <label class="field-label">选择要更新的目录</label>
            <label
              v-for="inst in updateInstallPaths"
              :key="inst.installPath"
              class="label-row"
            >
              <input
                type="checkbox"
                :checked="updateSelectedPaths.includes(inst.installPath)"
                @change="toggleUpdatePath(inst.installPath)"
              />
              <code class="font-mono">{{ inst.installPath }}</code>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="updateModalOpen = false">取消</button>
          <button class="btn-primary" :disabled="updating" @click="confirmUpdate">
            <i v-if="updating" class="fa-solid fa-circle-notch fa-spin"></i>
            更新
          </button>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="settingsModalOpen" class="modal-overlay" @click.self="settingsModalOpen = false">
      <div class="modal-panel glass-panel settings-modal">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-sliders text-indigo"></i>
            连接设置
          </h3>
          <button class="btn-icon" @click="settingsModalOpen = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <p class="settings-hint settings-intro">
            配置 Skill Base 服务端地址与 CLI 登录（与 skb 共用 ~/.skill-base/config.json）。在浏览器打开登录页获取验证码，在此换取 PAT。
          </p>

          <h4 class="settings-section-title">
            <i class="fa-solid fa-server"></i>
            Server Connection
          </h4>

          <label class="field-label">Server 根地址</label>
          <div class="field-row">
            <input v-model="registryUrl" type="text" class="font-mono" />
            <button class="btn-ghost" @click="saveServer">保存</button>
          </div>

          <a href="#" class="login-link" @click.prevent="openLoginPage">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            在浏览器打开 CLI 登录页
          </a>

          <label class="field-label">8 位验证码</label>
          <div class="field-row">
            <input
              v-model="verificationCode"
              type="text"
              placeholder="如 AB12-CD34"
              class="font-mono"
            />
            <button
              class="btn-ghost"
              :disabled="isExchangingPat"
              @click="exchangePat"
            >
              <i
                class="fa-solid"
                :class="isExchangingPat ? 'fa-circle-notch fa-spin' : 'fa-key'"
              ></i>
              换取 PAT
            </button>
          </div>
          <p v-if="patReady" class="pat-status">
            <span class="status-dot small"></span>
            PAT 已就绪{{ config.username ? ` · ${config.username}` : '' }}
          </p>

          <div class="settings-actions">
            <button
              class="btn-ghost"
              :disabled="isTestingConnection"
              @click="testConnection"
            >
              <i v-if="isTestingConnection" class="fa-solid fa-circle-notch fa-spin"></i>
              验证连接
            </button>
            <button
              v-if="patReady"
              class="btn-ghost"
              @click="logout"
            >
              退出登录
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="settingsModalOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- Paths Modal -->
    <div v-if="pathsModalOpen" class="modal-overlay" @click.self="pathsModalOpen = false">
      <div class="modal-panel glass-panel paths-modal">
        <div class="modal-header">
          <h3>
            <i class="fa-solid fa-folder-tree text-indigo"></i>
            安装路径 / {{ pathsModalSkill?.name || pathsModalSkill?.skillId }}
          </h3>
          <button class="btn-icon" @click="pathsModalOpen = false">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">
          <p class="settings-hint" style="margin-top: 0">
            共 {{ pathsModalSkill?.installs?.length || 0 }} 个目录
          </p>
          <ul class="paths-list">
            <li v-for="inst in pathsModalSkill?.installs || []" :key="inst.installPath">
              <i class="fa-solid fa-folder"></i>
              <code class="path-full font-mono">{{ inst.installPath }}</code>
              <span v-if="inst.version" class="path-version">v{{ inst.version }}</span>
              <button
                type="button"
                class="btn-icon path-reveal-btn"
                :title="revealPathHint"
                @click="revealInstallPath(inst.installPath)"
              >
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </button>
            </li>
          </ul>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" @click="pathsModalOpen = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  -webkit-app-region: drag;
}

.app-layout button,
.app-layout input,
.app-layout select,
.app-layout textarea,
.app-layout a,
.app-layout .nav-btn,
.app-layout .project-path,
.app-layout .skill-card,
.app-layout .market-card,
.app-layout .content-toolbar,
.app-layout .content-area,
.app-layout .tag-filter-dropdown,
.app-layout .modal-overlay,
.app-layout .modal-panel,
.app-layout .toast {
  -webkit-app-region: no-drag;
}

.sidebar {
  width: 16rem;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #1e293b;
  z-index: 10;
}

.sidebar-header {
  height: 4rem;
  display: flex;
  align-items: center;
  padding: 4rem 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
}

.logo-icon {
  width: 2rem;
  height: 2rem;
  background: linear-gradient(135deg, #6366f1, #9333ea);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin-right: 0.75rem;
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
}

.sidebar-header h1 {
  font-size: 1.125rem;
  font-weight: 700;
  color: white;
  letter-spacing: 0.05em;
  margin: 0;
}

.sidebar-nav {
  flex: 1;
  padding: 1.5rem 0.75rem;
}

.sidebar-bottom {
  padding: 0 0.75rem 0.75rem;
  border-top: 1px solid rgba(30, 41, 59, 0.5);
  padding-top: 0.75rem;
}

.nav-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  border: 1px solid transparent;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.25rem;
}

.nav-btn i {
  width: 1.25rem;
  text-align: center;
}

.nav-btn:hover {
  background: rgba(30, 41, 59, 0.5);
  color: #e2e8f0;
}

.nav-btn.active {
  background: rgba(99, 102, 241, 0.1);
  color: #818cf8;
  border-color: rgba(99, 102, 241, 0.2);
  box-shadow: inset 0 0 15px rgba(99, 102, 241, 0.1);
}

.sidebar-status {
  padding: 1rem;
  border-top: 1px solid #1e293b;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  position: relative;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  background: #10b981;
  flex-shrink: 0;
}

.status-dot.small {
  width: 0.5rem;
  height: 0.5rem;
}

.status-text {
  font-size: 0.6875rem;
  font-family: ui-monospace, monospace;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: radial-gradient(ellipse at top right, rgba(30, 41, 59, 0.4), #0f172a);
  position: relative;
}

.top-bar {
  height: 4rem;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  flex-shrink: 0;
}

.top-bar-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

.project-path {
  background: none;
  border: none;
  color: #818cf8;
  font-family: ui-monospace, monospace;
  font-size: 0.8125rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  transition: background 0.2s;
}

.project-path:hover {
  background: rgba(99, 102, 241, 0.1);
}

.breadcrumb {
  font-family: ui-monospace, monospace;
}

.content-toolbar {
  margin: 2rem 2rem 0;
  padding: 0;
  padding-bottom: 1rem;
  background: transparent;
  border: none;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  width: 100%;
}

.content-toolbar .search-box {
  position: relative;
  width: min(26rem, 100%);
  flex-shrink: 0;
}

.content-toolbar--market .search-box {
  width: min(22rem, 55vw);
}

.content-toolbar .search-box i {
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 0.75rem;
  pointer-events: none;
}

.content-toolbar .search-box input {
  width: 100%;
  height: 2rem;
  padding: 0 2rem 0 2.125rem;
  font-size: 0.8125rem;
  line-height: 2rem;
  background: transparent;
  border: 1px solid #334155;
  border-radius: 1.25rem;
  box-shadow: none;
  color: #e2e8f0;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.content-toolbar .search-box input:hover {
  border-color: #475569;
}

.content-toolbar .search-box input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  outline: none;
}

.content-toolbar .search-box input::placeholder {
  color: #64748b;
}

.content-toolbar .search-clear-btn {
  right: 0.625rem;
}

.search-box {
  position: relative;
  width: 16rem;
}

.search-box i {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  font-size: 0.8125rem;
}

.search-box input {
  width: 100%;
  padding-left: 2.25rem;
  padding-right: 2rem;
  padding-top: 0.375rem;
  padding-bottom: 0.375rem;
  font-size: 0.8125rem;
}

.search-clear-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  border-radius: 0.25rem;
}

.search-clear-btn:hover {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
}

.market-filter-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 0.375rem;
  flex-shrink: 0;
}

.content-toolbar--market .filter-chip {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
}

.content-toolbar--market .toolbar-refresh-btn {
  padding: 0.25rem 0.5rem;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid #334155;
  background: rgba(15, 23, 42, 0.5);
  color: #94a3b8;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.filter-chip:hover {
  border-color: #475569;
  color: #cbd5e1;
}

.filter-chip--active {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.12);
  color: #a5b4fc;
}

.toolbar-refresh-btn {
  padding: 0.35rem 0.6rem;
}

.tag-filter-dropdown {
  position: relative;
}

.tag-filter-badge {
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background: rgba(99, 102, 241, 0.25);
  color: #a5b4fc;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.125rem;
  text-align: center;
}

.tag-filter-chevron {
  font-size: 0.625rem;
  opacity: 0.75;
  transition: transform 0.2s ease;
}

.tag-filter-dropdown--open .tag-filter-chevron {
  transform: rotate(180deg);
}

.tag-filter-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: 14rem;
  max-width: min(20rem, calc(100vw - 2rem));
  max-height: 11rem;
  display: flex;
  flex-direction: column;
  padding: 0.45rem 0.5rem 0.5rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.625rem;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}

.tag-filter-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-bottom: 0.35rem;
}

.tag-filter-hint {
  margin: 0;
  padding: 0.15rem 0.25rem 0 0;
  flex: 1;
  min-width: 0;
  font-size: 0.625rem;
  color: #64748b;
  line-height: 1.35;
}

.tag-filter-clear {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  padding: 0.25rem 0.4rem;
  border-radius: 0.375rem;
  border: 1px solid #334155;
  background: transparent;
  font-size: 0.625rem;
  color: #64748b;
  cursor: pointer;
}

.tag-filter-clear:hover {
  border-color: #475569;
  color: #94a3b8;
}

.tag-filter-options {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tag-filter-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.5rem;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: #94a3b8;
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
}

.tag-filter-option:hover {
  background: rgba(148, 163, 184, 0.08);
  color: #e2e8f0;
}

.tag-filter-option--active {
  background: rgba(99, 102, 241, 0.1);
  color: #a5b4fc;
}

.tag-filter-option-check {
  flex-shrink: 0;
  width: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #818cf8;
}

.tag-filter-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 2rem 2rem;
  container-type: inline-size;
  container-name: skill-content;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.section-header h2 .accent {
  color: #818cf8;
  font-size: 1.125rem;
}

.subtitle {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0.25rem 0 0;
}

.skill-grid-3 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

@container skill-content (min-width: 72rem) {
  .skill-grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.skill-card,
.market-card {
  min-width: 0;
}

.skill-card {
  border-radius: 0.75rem;
  padding: 1.25rem;
  border: 1px solid rgba(30, 41, 59, 0.8);
  transition: all 0.2s;
}

.skill-card-top {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.skill-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  background: #1e293b;
  border: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  flex-shrink: 0;
}

.skill-info {
  flex: 1;
  min-width: 0;
}

.skill-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.skill-title-row h3 {
  font-size: 1rem;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-tag {
  font-size: 0.6875rem;
  background: #1e293b;
  color: #94a3b8;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #334155;
  font-family: ui-monospace, monospace;
}

.update-badge {
  font-size: 0.625rem;
  background: rgba(245, 158, 11, 0.1);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.2);
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-family: ui-monospace, monospace;
  text-transform: uppercase;
}

.skill-desc {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.skill-actions {
  display: flex;
  gap: 0.375rem;
  padding-left: 0.75rem;
  border-left: 1px solid #1e293b;
  align-self: center;
}

.update-btn {
  color: #818cf8 !important;
}

.skill-dirs {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(30, 41, 59, 0.6);
}

.dir-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid #334155;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-family: ui-monospace, monospace;
  color: #94a3b8;
  width: fit-content;
  max-width: min(100%, 22rem);
}

button.dir-tag {
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.dir-tag--reveal:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.4);
  color: #c7d2fe;
}

.dir-tag--reveal:hover i {
  color: #a5b4fc;
}

.dir-tag-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 18rem;
}

.dir-tag-more {
  cursor: pointer;
  border-style: dashed;
  color: #818cf8;
  background: rgba(99, 102, 241, 0.06);
  border-color: rgba(99, 102, 241, 0.35);
  font-size: 0.6875rem;
  width: fit-content;
  transition: background 0.2s, border-color 0.2s;
}

.dir-tag-more:hover {
  background: rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.55);
  color: #a5b4fc;
}

.dir-tag i {
  color: rgba(129, 140, 248, 0.7);
}

.dir-tag.error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.market-card {
  border-radius: 0.75rem;
  padding: 1.25rem;
  border: 1px solid #334155;
  display: flex;
  flex-direction: column;
  min-height: 12.5rem;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;
}

.market-card:hover {
  border-color: rgba(99, 102, 241, 0.5);
}

.market-card-glow {
  position: absolute;
  top: 0;
  right: 0;
  width: 6rem;
  height: 6rem;
  background: rgba(99, 102, 241, 0.1);
  border-bottom-left-radius: 100%;
  transition: background 0.2s;
}

.market-card:hover .market-card-glow {
  background: rgba(99, 102, 241, 0.2);
}

.market-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  position: relative;
}

.market-card-header h3 {
  font-size: 1.125rem;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-card-header-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.market-detail-btn {
  color: #64748b !important;
}

.market-detail-btn:hover {
  color: #a5b4fc !important;
  background: rgba(99, 102, 241, 0.12) !important;
}

.market-card-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  position: relative;
}

.market-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.6875rem;
  color: #64748b;
  font-family: ui-monospace, monospace;
}

.market-stat--favorited {
  color: #f472b6;
}

.market-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  position: relative;
}

.author {
  font-size: 0.75rem;
  color: #64748b;
  font-family: ui-monospace, monospace;
}

.version-detail {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #334155;
  background: rgba(15, 23, 42, 0.5);
}

.version-detail-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
}

.version-detail-label {
  color: #64748b;
  flex-shrink: 0;
}

.version-detail-value {
  color: #94a3b8;
}

.version-detail-changelog {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-word;
}

.version-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #334155;
}

.version-detail-btn {
  font-size: 0.8125rem;
  padding: 0.375rem 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: #a5b4fc;
}

.version-detail-btn:hover {
  color: #c7d2fe;
  border-color: #6366f1;
}

.install-btn {
  padding: 0.375rem 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: #334155;
  color: white;
  transition: background 0.2s;
}

.install-btn:hover:not(:disabled) {
  background: #4f46e5;
}

.install-btn.installed {
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.2);
  cursor: not-allowed;
}

.settings-modal {
  width: min(32rem, 94vw);
}

.settings-intro {
  margin-top: 0;
}

.settings-section-title {
  font-size: 0.875rem;
  font-weight: 700;
  color: #e2e8f0;
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.settings-section-title i {
  color: #818cf8;
}

.settings-hint {
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.6;
  margin: 0 0 1.25rem;
}

.field-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: #94a3b8;
  margin-bottom: 0.375rem;
}

.field-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.field-row input {
  flex: 1;
}

.font-mono {
  font-family: ui-monospace, 'JetBrains Mono', monospace;
}

.login-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #f59e0b;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  margin-bottom: 1.25rem;
}

.login-link:hover {
  color: #fbbf24;
}

.pat-status {
  font-size: 0.75rem;
  color: #34d399;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem;
}

.settings-actions {
  padding-top: 1rem;
  border-top: 1px solid rgba(30, 41, 59, 0.6);
  display: flex;
  gap: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #64748b;
}

.toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(99, 102, 241, 0.5);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
  z-index: 60;
  pointer-events: none;
}

.toast i {
  color: #818cf8;
}

.toast span {
  font-size: 0.875rem;
  color: white;
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(30, 41, 59, 0.5);
}

.modal-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.text-indigo {
  color: #818cf8;
}

.target-list-filter {
  width: 100%;
  margin-bottom: 0.625rem;
}

.target-list-filter input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.target-list {
  max-height: 14rem;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.install-target-tabs {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 1rem;
  padding: 0.25rem;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 0.5rem;
  border: 1px solid #334155;
}

.install-target-tabs button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  background: transparent;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.install-target-tabs button:hover {
  color: #e2e8f0;
  background: rgba(51, 65, 85, 0.4);
}

.install-target-tabs button.active {
  color: #c7d2fe;
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.35);
  box-shadow: inset 0 0 12px rgba(99, 102, 241, 0.08);
}

.install-target-tabs button i {
  font-size: 0.8125rem;
}

.install-tab-panel {
  min-height: 8rem;
}

.project-step {
  margin-bottom: 1rem;
}

.project-step.step-disabled {
  opacity: 0.55;
}

.project-step.step-disabled .target-list {
  pointer-events: none;
}

.target-option.is-disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.target-option.is-disabled:hover {
  border-color: #334155;
}

.target-option.target-exists:not(.selected) {
  border-color: rgba(16, 185, 129, 0.35);
  background: rgba(16, 185, 129, 0.07);
}

.target-option.target-exists:not(.selected):hover {
  border-color: rgba(16, 185, 129, 0.55);
  background: rgba(16, 185, 129, 0.1);
}

.target-option.target-exists .target-icon {
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.35);
}

.target-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.125rem;
}

.target-exists-badge {
  font-size: 0.625rem;
  font-weight: 500;
  color: #34d399;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.28);
  border-radius: 9999px;
  padding: 0.0625rem 0.4375rem;
  line-height: 1.4;
  white-space: nowrap;
}

.step-label {
  margin-bottom: 0.5rem;
}

.step-hint {
  margin: 0;
}

.selection-count {
  display: inline-block;
  font-size: 0.75rem;
  color: #818cf8;
  margin-bottom: 0.5rem;
}

.custom-dir-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.project-root-row {
  margin-bottom: 0.75rem;
}

.project-root-picker .target-option.compact {
  margin-bottom: 0;
}

.empty-hint {
  padding: 1.25rem 1rem;
  text-align: center;
  font-size: 0.8125rem;
  color: #64748b;
  border: 1px dashed #334155;
  border-radius: 0.5rem;
  background: rgba(15, 23, 42, 0.35);
}

.target-rel {
  font-size: 0.6875rem;
  color: #818cf8;
  margin: 0.125rem 0;
}

.target-info-text {
  min-width: 0;
  flex: 1;
}

.pick-dir-btn {
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.target-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.target-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  background: #1e293b;
  border: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  flex-shrink: 0;
}

.target-option.selected .target-icon {
  color: #818cf8;
}

.target-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #cbd5e1;
  margin: 0;
}

.target-option.selected .target-name {
  color: #c7d2fe;
}

.target-path {
  font-size: 0.6875rem;
  color: #64748b;
  margin: 0.125rem 0 0;
  word-break: break-all;
}

.target-option.selected .target-path {
  color: rgba(129, 140, 248, 0.7);
}

code {
  font-size: 0.75rem;
  background: #0f172a;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  border: 1px solid #334155;
  color: #818cf8;
}

.paths-modal {
  width: min(640px, 94vw);
}

.paths-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 20rem;
  overflow-y: auto;
}

.paths-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  background: rgba(15, 23, 42, 0.5);
}

.path-reveal-btn {
  flex-shrink: 0;
  margin-left: auto;
  align-self: center;
  color: #94a3b8;
}

.path-reveal-btn:hover {
  color: #a5b4fc;
}

.paths-list li i {
  color: rgba(129, 140, 248, 0.8);
  margin-top: 0.125rem;
  flex-shrink: 0;
}

.path-full {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.5;
  background: transparent;
  border: none;
  padding: 0;
  color: #cbd5e1;
}

.path-version {
  flex-shrink: 0;
  font-size: 0.6875rem;
  font-family: ui-monospace, monospace;
  color: #64748b;
  padding: 0.125rem 0.375rem;
  background: #1e293b;
  border-radius: 0.25rem;
}
</style>
