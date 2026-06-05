export interface CollectionCoverPreset {
  index: number
  hue: number
  background: string
  color: string
  descColor: string
}

export const COLLECTION_COVER_PRESET_COUNT = 50

/**
 * 按色系分组，轮询交错取色，避免相邻 preset 落在色环上相近位置。
 * 排序优先：蓝 → 绿 → 黄 → 青绿 → 青 → 紫 → 粉 → 橙 → 红 → 黄绿
 */
const HUE_FAMILIES: readonly (readonly number[])[] = [
  [210, 220, 205, 228, 215], // 蓝
  [145, 135, 155, 125, 160], // 绿
  [48, 42, 55, 38, 60],      // 黄
  [175, 168, 182, 172, 178], // 青绿
  [195, 185, 200, 188, 192], // 青
  [275, 265, 285, 260, 270], // 紫
  [330, 320, 340, 315, 325], // 粉
  [30, 22, 38, 28, 35],      // 橙
  [8, 350, 15, 345, 5],      // 红
  [95, 85, 105, 80, 100],    // 黄绿
]

function buildPreset(index: number, hue: number): CollectionCoverPreset {
  const familyIndex = index % HUE_FAMILIES.length
  const shadeIndex = Math.floor(index / HUE_FAMILIES.length)
  const bgSaturation = 50 + (shadeIndex % 3) * 10
  const themeSaturation = 65 + (familyIndex % 2) * 15
  const bgLightStart = 96
  const bgLightEnd = 90
  const themeLight = 40
  const descLight = 25

  return {
    index,
    hue,
    background: `linear-gradient(135deg, hsl(${hue}, ${bgSaturation}%, ${bgLightStart}%) 0%, hsl(${hue}, ${bgSaturation}%, ${bgLightEnd}%) 100%)`,
    color: `hsl(${hue}, ${themeSaturation}%, ${themeLight}%)`,
    descColor: `hsl(${hue}, ${bgSaturation}%, ${descLight}%)`,
  }
}

function buildCollectionCoverPresets(count: number): CollectionCoverPreset[] {
  const presets: CollectionCoverPreset[] = []
  const familyCount = HUE_FAMILIES.length

  for (let i = 0; i < count; i++) {
    const family = HUE_FAMILIES[i % familyCount]!
    const shadeIndex = Math.floor(i / familyCount) % family.length
    const hue = family[shadeIndex]!
    presets.push(buildPreset(i, hue))
  }

  return presets
}

export const COLLECTION_COVER_PRESETS = buildCollectionCoverPresets(COLLECTION_COVER_PRESET_COUNT)

export function resolveCollectionColorIndex(colorIndex: number): number {
  return ((colorIndex % COLLECTION_COVER_PRESET_COUNT) + COLLECTION_COVER_PRESET_COUNT) % COLLECTION_COVER_PRESET_COUNT
}

export function getCollectionCoverPreset(colorIndex: number): CollectionCoverPreset {
  const index = resolveCollectionColorIndex(colorIndex)
  return COLLECTION_COVER_PRESETS[index] ?? COLLECTION_COVER_PRESETS[0]!
}
