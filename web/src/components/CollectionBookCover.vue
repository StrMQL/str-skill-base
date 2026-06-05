<template>
  <div
    class="book-cover"
    :class="[
      `book-cover--${size}`,
      {
        'book-cover--interactive': interactive,
        'book-cover--loading': loading,
      },
    ]"
  >
    <div v-if="loading" class="book-face book-face--skeleton">
      <div class="skeleton-shimmer" aria-hidden="true"></div>
    </div>
    <template v-else>
      <div class="book-face" :style="faceStyle">
        <span class="book-badge">COLLECTION</span>
        <h2 class="book-title">{{ displayName }}</h2>
        <p v-if="displayDescription" class="book-desc">{{ displayDescription }}</p>
        <div class="book-footer">
          <Package class="book-icon" :size="size === 'lg' ? 16 : 14" aria-hidden="true" />
          <span class="book-count">{{ t('index.skillsCount', { count: displaySkillCount }) }}</span>
        </div>
      </div>
      <div class="book-pages" aria-hidden="true"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Package } from 'lucide-vue-next'
import { useI18n } from '@/composables/useI18n'
import { getCollectionCoverPreset } from '@/composables/useCollectionCoverColors'
import type { Collection } from '@/services/api'

type CollectionCoverSource = Pick<Collection, 'id' | 'name' | 'description' | 'skill_count'>

const props = withDefaults(defineProps<{
  collection?: CollectionCoverSource
  name?: string
  description?: string | null
  skillCount?: number
  colorIndex?: number
  size?: 'sm' | 'lg'
  loading?: boolean
  interactive?: boolean
}>(), {
  skillCount: undefined,
  colorIndex: 0,
  size: 'sm',
  loading: false,
  interactive: false,
})

const { t } = useI18n()

const displayName = computed(() => props.collection?.name ?? props.name ?? '')
const displayDescription = computed(() => props.collection?.description ?? props.description ?? null)
const displaySkillCount = computed(() => props.skillCount ?? props.collection?.skill_count ?? 0)
const displayColorIndex = computed(() => props.collection?.id ?? props.colorIndex ?? 0)

const preset = computed(() => getCollectionCoverPreset(displayColorIndex.value))

const faceStyle = computed(() => ({
  background: `
    radial-gradient(circle at 88% 8%, rgba(255, 255, 255, 0.85) 0, transparent 28%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.55) 0%, transparent 42%),
    ${preset.value.background}
  `,
  '--book-fg': preset.value.color,
  '--book-muted': preset.value.descColor,
  '--book-accent': preset.value.color,
  '--book-line': 'rgba(255, 255, 255, 0.45)',
  '--book-badge-bg': 'rgba(255, 255, 255, 0.72)',
  '--book-badge-line': 'rgba(0, 0, 0, 0.08)',
}))
</script>

<style scoped>
.book-cover {
  position: relative;
  display: flex;
  flex-shrink: 0;
  filter:
    drop-shadow(0 10px 22px rgba(15, 23, 42, 0.1))
    drop-shadow(0 2px 6px rgba(15, 23, 42, 0.06));
  transition: transform 0.25s ease, filter 0.25s ease;
}

.book-cover--interactive:hover {
  transform: translateY(-6px) rotate(-1deg);
  filter:
    drop-shadow(0 16px 28px rgba(15, 23, 42, 0.14))
    drop-shadow(0 4px 10px rgba(15, 23, 42, 0.08));
}

.book-cover--sm {
  width: 11.5rem;
}

.book-cover--lg {
  width: 14.5rem;
}

.book-face {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 1rem 0.875rem 0.875rem;
  border: 1px solid var(--book-line);
  border-radius: 0.375rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.book-cover--lg .book-face {
  padding: 1.25rem 1rem 1rem;
  min-height: 18rem;
}

.book-cover--sm .book-face {
  min-height: 15rem;
}

.book-face--skeleton {
  background: var(--color-base-900);
  border-color: var(--color-base-800);
  box-shadow: none;
  overflow: hidden;
}

.skeleton-shimmer {
  flex: 1;
  width: 100%;
  background: linear-gradient(90deg, var(--color-base-900) 25%, var(--color-base-800) 50%, var(--color-base-900) 75%);
  background-size: 200% 100%;
  animation: book-cover-skeleton 1.5s infinite;
}

@keyframes book-cover-skeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.book-pages {
  position: absolute;
  top: 4px;
  right: -5px;
  bottom: 4px;
  width: 6px;
  border-radius: 0 2px 2px 0;
  background: repeating-linear-gradient(
    180deg,
    #f8fafc 0px,
    #e2e8f0 1px,
    #f8fafc 2px
  );
  border: 1px solid #cbd5e1;
  box-shadow: inset 1px 0 1px rgba(255, 255, 255, 0.9);
}

.book-badge {
  align-self: flex-start;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--book-accent);
  background: var(--book-badge-bg);
  padding: 0.15rem 0.35rem;
  border-radius: 0.2rem;
  border: 1px solid var(--book-badge-line);
  margin-bottom: 0.75rem;
}

.book-title {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--book-fg);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-cover--lg .book-title {
  font-size: 1.125rem;
  -webkit-line-clamp: 5;
}

.book-desc {
  margin: 0.625rem 0 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--book-muted);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.book-footer {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: auto;
  padding-top: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  color: var(--book-muted);
}

.book-icon {
  color: var(--book-accent);
  opacity: 0.85;
}
</style>
