import { biomeDefinitions, resolveTerrainName } from './terrainSurface'
import type { BiomeDefinition } from './terrainSurface'

const waterUrls = import.meta.glob<string>('../../../../../../../assets/maps/waters/*.{png,webp,jpeg,jpg}', {
  eager: true, import: 'default', query: '?url',
})

const waterNames: Record<string, string> = {
  'Painterly Deep Blue Water Splash-2': 'Deep Blue Water',
  'Painterly Turquoise Water Pool-1': 'Turquoise Water',
}

const preferredFormats = ['png', 'webp', 'jpeg', 'jpg']

function collectTextures(entries: [string, string][], aliases: Record<string, string>) {
  const textures = new Map<string, { name: string; url: string; priority: number }>()
  for (const [path, url] of entries) {
    const file = path.slice(path.lastIndexOf('/') + 1)
    const extension = file.lastIndexOf('.')
    const stem = file.slice(0, extension)
    const name = aliases[stem] ?? stem
    const priority = preferredFormats.indexOf(file.slice(extension + 1).toLowerCase())
    if (priority < (textures.get(name)?.priority ?? Infinity)) textures.set(name, { name, url, priority })
  }
  return textures
}

function rgbCss(rgb: readonly [number, number, number]) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
}

function makeBiomeSwatchUrl(biome: BiomeDefinition): string {
  const detail = biome.name === 'Plains'
    ? `<g stroke="#5f723c" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".42"><path d="M24 38q-2-6-5-9m5 9q0-7 1-11m-1 11q3-5 6-8"/><path d="M52 24q-2-5-4-8m4 8q1-6 1-10m-1 10q3-4 5-7"/><path d="M68 48q-2-5-5-8m5 8q0-6 1-10m-1 10q3-5 5-7"/></g>`
    : biome.name === 'Desert'
      ? `<g stroke="#b88844" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".35"><path d="M8 22q18-6 36 0t38 0"/><path d="M12 44q20-6 40 0t36 0"/></g>`
      : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${rgbCss(biome.high)}"/><stop offset="55%" stop-color="${rgbCss(biome.mid)}"/><stop offset="100%" stop-color="${rgbCss(biome.low)}"/></linearGradient></defs><rect width="96" height="64" fill="url(#g)"/><ellipse cx="26" cy="22" rx="22" ry="14" fill="${rgbCss(biome.accent)}" opacity=".38"/><ellipse cx="70" cy="44" rx="20" ry="14" fill="${rgbCss(biome.low)}" opacity=".28"/>${detail}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const terrainTextures = biomeDefinitions.map(biome => ({
  name: biome.name,
  url: makeBiomeSwatchUrl(biome),
  color: rgbCss(biome.mid),
}))

const proceduralBiomeSet = new Set(biomeDefinitions.map(biome => biome.name))
export const isProceduralBiome = (name: string) => proceduralBiomeSet.has(name)
export const defaultTerrain = 'Grassland'
export { resolveTerrainName }

const waterMap = collectTextures(Object.entries(waterUrls), waterNames)
export const waterTextures = [...waterMap.values()].sort((a, b) => a.name.localeCompare(b.name))
export const defaultWater = waterMap.get('Turquoise Water')?.name ?? waterTextures[0]?.name ?? ''
