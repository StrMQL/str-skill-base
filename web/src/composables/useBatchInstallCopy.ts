import { ref } from 'vue'

export function useBatchInstallCopy() {
  const copiedSlug = ref<string | null>(null)

  async function copyCollectionInstallCommand(collectionSlug: string) {
    const cmd = `skb install --collection ${collectionSlug}`
    try {
      await navigator.clipboard.writeText(cmd)
    } catch {
      const el = document.createElement('textarea')
      el.value = cmd
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    copiedSlug.value = collectionSlug
    setTimeout(() => {
      copiedSlug.value = null
    }, 2000)
  }

  return { copiedSlug, copyCollectionInstallCommand }
}
