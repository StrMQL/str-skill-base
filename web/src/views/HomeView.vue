<template>
  <!-- 页面内容 -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
    <!-- 页面标题区域 -->
    <div class="page-header mb-8 text-center">
      <div class="inline-flex items-center justify-center gap-2 px-3 py-1 bg-base-900 border border-base-800 rounded-full mb-6 text-xs font-mono text-neon-400">
        <span class="w-2 h-2 rounded-full bg-neon-400 animate-pulse"></span>
        Skill Directory
      </div>

      <div class="search-bar">
        <div class="search-icon-wrapper">
          <span>$</span>
          <span>grep</span>
        </div>
        <input
          type="search"
          id="searchInput"
          :placeholder="`&quot;${t('index.searchPlaceholder')}&quot;`"
          autocomplete="off"
          v-model="searchQuery"
        >
        <button type="button" class="clear-btn" id="clearSearch" @click="clearSearch">
          <X :size="16" :stroke-width="2" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- 面包屑与过滤器 -->
    <div v-if="skillsStore.skills.length > 0" class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div class="text-sm text-base-400 font-mono flex items-center gap-2">
        <span class="text-neon-400">~</span>
        <span class="opacity-50">/</span>
        <span class="text-fg-strong">skills</span>
        <span class="opacity-50 ml-2">ls -la</span>
      </div>
      <div class="home-filter-actions">
        <button
          type="button"
          class="filter-chip"
          :class="{ 'filter-chip--active': onlyFavorites }"
          @click="onlyFavorites = !onlyFavorites"
        >
          <Heart :size="14" :stroke-width="2" aria-hidden="true" />
          {{ t('index.favoriteOnly') }}
        </button>

        <div
          v-if="!isLoading && availableTags.length > 0"
          class="tag-filter-dropdown"
          :class="{ 'tag-filter-dropdown--open': showTagDropdown }"
        >
          <button
            type="button"
            class="filter-chip tag-filter-trigger"
            :class="{ 'filter-chip--active': selectedTagIds.length > 0 }"
            :aria-expanded="showTagDropdown"
            aria-haspopup="listbox"
            @click.stop="toggleTagDropdown"
          >
            <Tags :size="14" :stroke-width="2" aria-hidden="true" />
            {{ t('index.tagsFilter') }}
            <span v-if="selectedTagIds.length > 0" class="tag-filter-badge">{{ selectedTagIds.length }}</span>
            <ChevronDown class="tag-filter-chevron" :size="14" :stroke-width="2.5" aria-hidden="true" />
          </button>
          <div
            v-show="showTagDropdown"
            class="tag-filter-panel"
            role="listbox"
            aria-multiselectable="true"
            @click.stop
          >
            <div class="tag-filter-panel-header">
              <p class="tag-filter-hint">{{ t('index.tagsFilterHint') }}</p>
              <button
                v-if="selectedTagIds.length > 0"
                type="button"
                class="tag-filter-clear"
                :title="t('index.clearTags')"
                @click="clearTagFilter"
              >
                <X class="tag-filter-clear-icon" :size="12" :stroke-width="2" aria-hidden="true" />
                <span>{{ t('index.clearTags') }}</span>
              </button>
            </div>
            <div class="tag-filter-options">
              <button
                v-for="tag in availableTags"
                :key="tag.id"
                type="button"
                class="tag-filter-option"
                :class="{ 'tag-filter-option--active': isTagSelected(tag.id) }"
                role="option"
                :aria-selected="isTagSelected(tag.id)"
                @click="toggleTag(tag.id)"
              >
                <span class="tag-filter-option-check" aria-hidden="true">
                  <Check v-if="isTagSelected(tag.id)" :size="14" :stroke-width="2.5" />
                </span>
                <span class="tag-filter-option-label">{{ tag.name }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Skill 列表 -->
    <div id="skill-list" class="skill-grid pb-16">
      <!-- 加载状态 -->
      <template v-if="isLoading">
        <div v-for="i in 6" :key="i" class="skeleton-card">
          <div class="skeleton-title"></div>
          <div class="skeleton-desc"></div>
          <div class="skeleton-desc-short"></div>
          <div class="skeleton-footer"></div>
        </div>
      </template>

      <!-- 空状态 -->
      <template v-else-if="!filteredSkills || filteredSkills.length === 0">
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📦</div>
          <p v-if="searchQuery" class="empty-state-text">{{ t('index.noResults', { q: searchQuery }) }}</p>
          <p v-else-if="skillsStore.skills.length > 0" class="empty-state-text">{{ t('index.noFilterMatch') }}</p>
          <template v-else>
            <p class="empty-state-text">{{ t('index.noSkills') }}</p>
            <router-link to="/publish" class="btn btn-primary mt-6">
              <Plus class="mr-1" :size="18" :stroke-width="2.5" aria-hidden="true" />
              {{ t('index.publishBtn') }}
            </router-link>
          </template>
        </div>
      </template>

      <!-- Skill 卡片 -->
      <template v-else>
        <router-link
          v-for="skill in filteredSkills"
          :key="skill.id"
          :to="`/skills/${skill.id}`"
          class="skill-card"
        >
          <div class="skill-card-header">
            <h3 class="skill-card-name">{{ skill.name }}</h3>
            <span v-if="skill.visibility === 'private'" class="skill-visibility-badge">PRIVATE</span>
          </div>
          <p class="skill-card-desc">{{ truncateDescription(skill.description) }}</p>
          <div class="skill-card-footer">
            <div class="skill-card-meta">
              <span class="skill-card-owner">
                <User :size="14" :stroke-width="2" aria-hidden="true" />
                {{ skill.owner?.name || skill.owner?.username || t('state.unknown') }}
              </span>
              <span class="skill-card-stats">
                <span class="skill-card-stat" :title="t('index.downloadCount')">
                  <Download :size="14" :stroke-width="2" aria-hidden="true" />
                  {{ skill.download_count ?? 0 }}
                </span>
                <span
                  class="skill-card-stat"
                  :title="skill.is_favorited ? t('index.favorited') : t('index.favorite')"
                >
                  <span :class="{ 'skill-card-stat--favorited': skill.is_favorited }">
                    <Heart :size="14" :stroke-width="2" aria-hidden="true" />
                  </span>
                  {{ skill.favorite_count ?? 0 }}
                </span>
              </span>
            </div>
            <span>{{ formatDate(skill.updated_at, currentLang) }}</span>
          </div>
        </router-link>
      </template>
    </div>
  </main>

  <!-- 浮动发布按钮 -->
  <router-link to="/publish" class="fab" :title="t('index.fabTitle')">
    <Plus :size="24" :stroke-width="2" aria-hidden="true" />
  </router-link>
</template>

<script setup lang="ts">
import { X, Heart, Plus, User, Download, Tags, ChevronDown, Check } from 'lucide-vue-next'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSkillsStore } from '@/stores/skills'
import { useI18n } from '@/composables/useI18n'
import { formatDate } from '@/utils/date'
import type { Tag } from '@/services/api'

const skillsStore = useSkillsStore()
const { t, currentLang } = useI18n()
const searchQuery = ref('')
const onlyFavorites = ref(false)
const selectedTagIds = ref<number[]>([])
const showTagDropdown = ref(false)
const isLoading = ref(true)

/** 当前列表中出现的标签（与可见 Skill 一致，不额外请求 /tags） */
const availableTags = computed(() => {
  const map = new Map<number, Tag>()
  for (const skill of skillsStore.skills) {
    for (const tag of skill.tags || []) {
      if (!map.has(tag.id)) {
        map.set(tag.id, tag)
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
})

const filteredSkills = computed(() => {
  let result = skillsStore.skills

  if (onlyFavorites.value) {
    result = result.filter(skill => skill.is_favorited)
  }

  const tagIds = selectedTagIds.value
  if (tagIds.length > 0) {
    const need = new Set(tagIds)
    result = result.filter((skill) => {
      const have = (skill.tags || []).map((t) => t.id)
      return have.some((id) => need.has(id))
    })
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(skill =>
      skill.name.toLowerCase().includes(query) ||
      skill.description.toLowerCase().includes(query)
    )
  }

  return result
})

function isTagSelected(id: number) {
  return selectedTagIds.value.includes(id)
}

function toggleTag(id: number) {
  const cur = selectedTagIds.value
  const i = cur.indexOf(id)
  if (i === -1) {
    selectedTagIds.value = [...cur, id]
  } else {
    selectedTagIds.value = cur.filter((x) => x !== id)
  }
}

function clearTagFilter() {
  selectedTagIds.value = []
}

function toggleTagDropdown() {
  showTagDropdown.value = !showTagDropdown.value
}

function closeTagDropdown() {
  showTagDropdown.value = false
}

function onDocumentClick() {
  closeTagDropdown()
}

function clearSearch() {
  searchQuery.value = ''
}

function truncateDescription(desc: string | null | undefined): string {
  if (!desc) return t('state.noDesc')
  if (desc.length > 100) {
    return desc.substring(0, 100) + '...'
  }
  return desc
}

onMounted(async () => {
  document.addEventListener('click', onDocumentClick)
  await skillsStore.fetchSkills()
  isLoading.value = false
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>

<style scoped>
/* 骨架屏样式（随 html[data-theme] 变量切换） */
.skeleton-card {
  background-color: var(--color-base-900);
  border: 1px solid var(--color-base-800);
  padding: 1.5rem;
  border-radius: 0.75rem;
}
.skeleton-title, .skeleton-desc, .skeleton-desc-short, .skeleton-footer {
  background: linear-gradient(
    90deg,
    var(--color-base-900) 25%,
    var(--color-base-700) 50%,
    var(--color-base-900) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
  height: 1rem;
}
.skeleton-title { width: 75%; margin-bottom: 1rem; height: 1.25rem; }
.skeleton-desc { width: 100%; margin-bottom: 0.5rem; }
.skeleton-desc-short { width: 85%; margin-bottom: 1.5rem; }
.skeleton-footer { width: 100%; margin-top: auto; }

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 空状态 */
.empty-state {
  padding: 4rem 1rem;
  text-align: center;
  color: var(--color-base-400);
  font-family: 'JetBrains Mono', monospace;
}
.empty-state-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.3;
}
.empty-state-text {
  color: var(--color-base-400);
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.skill-visibility-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.625rem;
  line-height: 1;
  padding: 0.3rem 0.5rem;
  color: #fcd34d;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.3);
  letter-spacing: 0.04em;
}

.home-filter-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.tag-filter-dropdown {
  position: relative;
}

.tag-filter-trigger {
  gap: 0.35rem;
}

.tag-filter-badge {
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  background: rgba(255, 117, 181, 0.25);
  color: #ff75b5;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.125rem;
  text-align: center;
}

.tag-filter-chevron {
  flex-shrink: 0;
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
  background: var(--color-base-900);
  border: 1px solid var(--color-base-800);
  border-radius: 0.625rem;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
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
  font-family: 'JetBrains Mono', monospace;
  color: var(--color-base-400);
  line-height: 1.35;
}

.tag-filter-clear {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  padding: 0.25rem 0.4rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-base-800);
  background: transparent;
  font-size: 0.625rem;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  color: var(--color-base-400);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.tag-filter-clear:hover {
  border-color: var(--color-base-600);
  color: var(--color-base-200);
  background: color-mix(in srgb, var(--color-fg-strong) 5%, transparent);
}

.tag-filter-clear-icon {
  flex-shrink: 0;
  color: var(--color-base-500);
  opacity: 0.9;
}

.tag-filter-clear:hover .tag-filter-clear-icon {
  color: var(--color-base-400);
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
  color: var(--color-base-300);
  font-size: 0.8125rem;
  font-family: 'JetBrains Mono', monospace;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.tag-filter-option:hover {
  background: color-mix(in srgb, var(--color-fg-strong) 6%, transparent);
  color: var(--color-fg-strong);
}

.tag-filter-option--active {
  background: rgba(var(--color-neon-rgb), 0.08);
  color: var(--color-neon-400);
}

.tag-filter-option-check {
  flex-shrink: 0;
  width: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-neon-400);
}

.tag-filter-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
