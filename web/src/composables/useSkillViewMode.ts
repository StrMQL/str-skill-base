import { ref, computed } from 'vue'

export type SkillViewMode = 'card' | 'list'

const STORAGE_KEY = 'skb-home-view'

function readStoredViewMode(): SkillViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'list' || v === 'card') return v
  } catch {
    // ignore
  }
  return 'card'
}

export function useSkillViewMode() {
  const mode = ref<SkillViewMode>(readStoredViewMode())

  const viewMode = computed({
    get: () => mode.value,
    set: (value: SkillViewMode) => {
      mode.value = value
      try {
        localStorage.setItem(STORAGE_KEY, value)
      } catch {
        // ignore
      }
    },
  })

  return { viewMode }
}
