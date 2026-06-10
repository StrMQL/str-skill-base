<template>
  <div class="collection-install-bar">
    <span class="collection-install-prompt">$</span>
    <code class="collection-install-cmd">skb install --collection {{ collectionSlug }}</code>
    <button
      type="button"
      class="collection-install-copy"
      :title="t('index.copyCommand')"
      @click="copyCollectionInstallCommand(collectionSlug)"
    >
      <Copy v-if="copiedSlug !== collectionSlug" :size="14" />
      <span v-else class="collection-install-copied">{{ t('index.copied') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import { useI18n } from '@/composables/useI18n'
import { useBatchInstallCopy } from '@/composables/useBatchInstallCopy'

defineProps<{
  collectionSlug: string
}>()

const { t } = useI18n()
const { copiedSlug, copyCollectionInstallCommand } = useBatchInstallCopy()
</script>

<style scoped>
.collection-install-bar {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  background: var(--color-base-950);
  border: 1px solid var(--color-base-800);
  border-radius: 0.375rem;
  padding: 0.35rem 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8125rem;
}

.collection-install-prompt {
  color: var(--color-neon-400);
  margin-right: 0.5rem;
  user-select: none;
}

.collection-install-cmd {
  color: var(--color-base-200);
  margin-right: 0.75rem;
  white-space: nowrap;
}

.collection-install-copy {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--color-base-400);
  cursor: pointer;
  padding: 0.125rem;
  display: flex;
  align-items: center;
}

.collection-install-copy:hover {
  color: var(--color-neon-400);
}

.collection-install-copied {
  font-size: 0.75rem;
  color: var(--color-neon-400);
  font-weight: 600;
}
</style>
