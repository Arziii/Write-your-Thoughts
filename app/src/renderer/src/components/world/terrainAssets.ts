const urls = import.meta.glob<string>('../../../../../../assets/maps/*.{png,webp,jpeg,jpg}', {
  eager: true, import: 'default', query: '?url',
})

const savedNames: Record<string, string> = {
  'Mossy Ancient Grassland Map Cutout': 'Seamless Ancient Grassland',
  'Isometric Woodland Clearing Tile': 'Lighter, Open Canopy Forest',
}

const preferredFormats = ['png', 'webp', 'jpeg', 'jpg']
const textures = new Map<string, { name: string; url: string; priority: number }>()

for (const [path, url] of Object.entries(urls)) {
  const file = path.slice(path.lastIndexOf('/') + 1)
  const extension = file.lastIndexOf('.')
  const stem = file.slice(0, extension)
  const name = savedNames[stem] ?? stem
  const priority = preferredFormats.indexOf(file.slice(extension + 1))
  if (priority < (textures.get(name)?.priority ?? Infinity)) textures.set(name, { name, url, priority })
}

export const terrainTextures = [...textures.values()].sort((a, b) => a.name.localeCompare(b.name))
export const defaultTerrain = textures.get('Seamless Ancient Grassland')?.name ?? terrainTextures[0]?.name ?? ''
