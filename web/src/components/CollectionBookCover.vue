<template>
  <div class="book-cover" :class="[`book-cover--${size}`]">
    <div class="book-face" :style="faceStyle">
      <span class="book-badge">COLLECTION</span>
      <h2 class="book-title">{{ name }}</h2>
      <p v-if="description && size === 'lg'" class="book-desc">{{ description }}</p>
      <div class="book-footer">
        <Package class="book-icon" :size="size === 'lg' ? 16 : 14" aria-hidden="true" />
        <span class="book-count">{{ t('index.skillsCount', { count: skillCount }) }}</span>
      </div>
    </div>
    <div class="book-pages" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Package } from 'lucide-vue-next'
import { useI18n } from '@/composables/useI18n'
import { getCollectionCoverPreset } from '@/composables/useCollectionCoverColors'

const props = withDefaults(defineProps<{
  name: string
  description?: string | null
  skillCount?: number
  colorIndex?: number
  size?: 'sm' | 'lg'
}>(), {
  skillCount: 0,
  colorIndex: 0,
  size: 'sm',
})

const { t } = useI18n()

const preset = computed(() => getCollectionCoverPreset(props.colorIndex))

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
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
