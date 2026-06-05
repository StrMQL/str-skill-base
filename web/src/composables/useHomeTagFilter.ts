import { ref, watch } from 'vue'

const STORAGE_KEY = 'skb-home-tags'

function readStoredTagIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => typeof id === 'number' && Number.isInteger(id))
  } catch {
    return []
  }
}

function writeStoredTagIds(ids: number[]) {
  try {
    if (ids.length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    }
  } catch {
    // ignore
  }
}

export function useHomeTagFilter() {
  const selectedTagIds = ref<number[]>(readStoredTagIds())

  watch(selectedTagIds, (ids) => {
    writeStoredTagIds(ids)
  }, { deep: true })

  function pruneToAvailable(availableIds: Set<number>) {
    const pruned = selectedTagIds.value.filter((id) => availableIds.has(id))
    if (pruned.length !== selectedTagIds.value.length) {
      selectedTagIds.value = pruned
    }
  }

  return { selectedTagIds, pruneToAvailable }
}
