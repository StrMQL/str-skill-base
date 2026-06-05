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

    <div v-if="isLoading" class="collections-shelf" :class="shelfLayoutClass(3)">
      <div v-for="i in 3" :key="i" class="collection-shelf-item">
        <CollectionBookCover loading size="sm" />
      </div>
    </div>

    <div v-else-if="collections.length === 0" class="collections-empty">
      <Package :size="40" :stroke-width="1.5" aria-hidden="true" />
      <p>{{ t('collections.empty') }}</p>
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
import { collectionsApi, type Collection } from '@/services/api'

const { t } = useI18n()
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
}

.collections-page-title {
  margin: 0 0 0.5rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-fg-strong);
}

.collections-page-subtitle {
  margin: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8125rem;
  color: var(--color-base-400);
}

.collections-shelf {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2.5rem 3rem;
  padding: 1rem 0 2rem;
}

.collections-shelf--single,
.collections-shelf--pair {
  justify-content: center;
  gap: 3rem 4rem;
}

.collections-shelf--single .collection-shelf-item {
  max-width: 20rem;
}

.collections-shelf--pair .collection-shelf-item {
  max-width: 18rem;
}

.collection-shelf-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 11.5rem;
  text-align: center;
}

.collection-shelf-link {
  text-decoration: none;
  color: inherit;
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

</style>
