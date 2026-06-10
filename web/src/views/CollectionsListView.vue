<template>
  <main class="collections-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
    <header class="collections-page-header mb-10">
      <div class="inline-flex items-center justify-center gap-2 px-3 py-1 bg-base-900 border border-base-800 rounded-full mb-6 text-xs font-mono text-neon-400">
        <span class="w-2 h-2 rounded-full bg-neon-400 animate-pulse"></span>
        Collections
      </div>
      <h1 class="collections-page-title">{{ t('collections.title') }}</h1>
      <p class="collections-page-subtitle">{{ t('collections.subtitle') }}</p>
    </header>

    <div v-if="isLoading" class="collections-shelf" :class="shelfLayoutClass(1)">
      <div class="collection-shelf-item">
        <CollectionBookCover loading size="sm" />
      </div>
    </div>

    <div v-else-if="collections.length === 0" class="collections-empty">
      <Package :size="40" :stroke-width="1.5" aria-hidden="true" />
      <p class="collections-empty-title">{{ t('collections.empty') }}</p>
      <p class="collections-empty-hint">{{ t('collections.emptyHint') }}</p>
      <router-link
        v-if="authStore.isAdmin"
        to="/admin/collections"
        class="collections-empty-cta"
      >
        {{ t('collections.emptyAdminCta') }}
      </router-link>
    </div>

    <div v-else class="collections-shelf" :class="shelfLayoutClass(collections.length)">
      <router-link
        v-for="collection in collections"
        :key="collection.id"
        :to="`/collections/${collection.id}`"
        class="collection-shelf-item collection-shelf-link"
      >
        <CollectionBookCover
          :collection="collection"
          size="sm"
          interactive
        />
      </router-link>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Package } from 'lucide-vue-next'
import CollectionBookCover from '@/components/CollectionBookCover.vue'
import { useI18n } from '@/composables/useI18n'
import { useAuthStore } from '@/stores/auth'
import { collectionsApi, type Collection } from '@/services/api'

const { t } = useI18n()
const authStore = useAuthStore()
const collections = ref<Collection[]>([])
const isLoading = ref(true)

function shelfLayoutClass(count: number) {
  if (count <= 1) return 'collections-shelf--single'
  if (count === 2) return 'collections-shelf--pair'
  return ''
}

onMounted(async () => {
  try {
    const res = await collectionsApi.list()
    collections.value = res.collections || []
  } catch {
    collections.value = []
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.collections-page-header {
  text-align: center;
  position: relative;
  margin-top: 0.5rem;
}

.collections-page-title {
  margin: 0 0 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: clamp(1.9rem, 4vw, 3.1rem);
  font-weight: 700;
  color: var(--color-fg-strong);
  line-height: 1.12;
}

.collections-page-subtitle {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8125rem;
  color: var(--color-base-400);
}

.collections-shelf {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
  justify-items: center;
  gap: 3rem 3.25rem;
  max-width: 72rem;
  margin: 0 auto;
  padding: 2.25rem 1.25rem 3.5rem;
}

.collections-shelf--single,
.collections-shelf--pair {
  grid-template-columns: repeat(var(--collection-count, 1), minmax(13.5rem, 17rem));
  justify-content: center;
  gap: 3rem 4rem;
}

.collections-shelf--pair {
  --collection-count: 2;
}

.collections-shelf--single .collection-shelf-item {
  max-width: 17rem;
}

.collections-shelf--pair .collection-shelf-item {
  max-width: 15.5rem;
}

.collection-shelf-item {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 13.5rem;
  text-align: center;
}

.collection-shelf-link {
  text-decoration: none;
  color: inherit;
  outline: none;
  border-radius: 0.65rem;
}

.collection-shelf-link:focus-visible {
  box-shadow: 0 0 0 2px rgba(var(--color-neon-rgb), 0.65);
}

@media (max-width: 640px) {
  .collections-shelf {
    grid-template-columns: 1fr;
    gap: 2rem;
    padding: 1.75rem 0.75rem 2.75rem;
  }

  .collections-shelf--pair {
    grid-template-columns: 1fr;
  }
}

.collections-empty {
  padding: 4rem 1rem;
  text-align: center;
  color: var(--color-base-400);
  font-family: 'JetBrains Mono', monospace;
}

.collections-empty svg {
  margin: 0 auto 1rem;
  opacity: 0.35;
}

.collections-empty-title {
  margin: 0 0 0.75rem;
  font-size: 0.9375rem;
  color: var(--color-fg-strong);
}

.collections-empty-hint {
  margin: 0 auto;
  max-width: 28rem;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--color-base-400);
}

.collections-empty-cta {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  color: var(--color-neon-400);
  text-decoration: none;
  border: 1px solid var(--color-base-800);
  border-radius: 0.5rem;
  transition: border-color 0.15s, color 0.15s;
}

.collections-empty-cta:hover {
  color: var(--color-fg-strong);
  border-color: var(--color-neon-400);
}

</style>
