import { ref } from 'vue'

export function useBatchInstallCopy() {
  const copiedId = ref<number | null>(null)

  async function copyCollectionInstallCommand(collectionId: number) {
    const cmd = `skb install --collection ${collectionId}`
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
    copiedId.value = collectionId
    setTimeout(() => {
      copiedId.value = null
    }, 2000)
  }

  return { copiedId, copyCollectionInstallCommand }
}
