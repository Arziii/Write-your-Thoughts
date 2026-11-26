import manifest from '../../../../../../assets/maps/map-assets/map-assets/manifest.json'
import licenses from '../../../../../../assets/maps/map-assets/map-assets/LICENSES.md?url'
import originalReadme from '../../../../../../assets/maps/map-assets/map-assets/ORIGINAL_README.txt?url'

export const stampCredits = { licenses, originalReadme }

export const stampCategories = [
  { id: 'mountains', label: 'Mountains' },
  { id: 'forests', label: 'Forests' },
  { id: 'settlements', label: 'Settlements' },
] as const

const paths = import.meta.glob<string>('../../../../../../assets/maps/map-assets/map-assets/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})
const directory = '../../../../../../assets/maps/map-assets/map-assets/'

export const stampAssets = manifest.flatMap(entry => {
  const url = paths[directory + entry.path]
  if (!url || !stampCategories.some(category => category.id === entry.category)) return []

  const label = entry.label ?? entry.id.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase())
  return [{ ...entry, label, url }]
})

export type StampAsset = typeof stampAssets[number]
export const stampsById = new Map(stampAssets.map(asset => [asset.id, asset]))
