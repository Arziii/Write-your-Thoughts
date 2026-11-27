import { atlasWidth, clamp, pathDefaults, riverPresets } from './atlasPaths'
import type { AtlasPathSettings, RoadTexture } from './atlasPaths'
import type { MapDraftAnalysis } from './mapDraftAnalyzer'
import type { MapFeature } from './ParchmentMapTools'
import { resolveTerrainName } from './terrainAssets'
import { defaultTerrainBlend } from './terrainBlend'

export type MapDraftBuildOptions = {
  includeLandmasses: boolean
  includeLakes: boolean
  includeBiomes: boolean
  includePaths: boolean
  includeMountains: boolean
  includeForests: boolean
  includeSettlements: boolean
  includeSuggestedNature: boolean
  roughness: number
  includeLabels: boolean
}

const VALID_ROADS = new Set<RoadTexture>([
  'dirt', 'forest_trail', 'gravel', 'stone', 'sand', 'snow', 'mud', 'cobblestone', 'trade_route',
])

export function buildFeaturesFromDraft(
  analysis: MapDraftAnalysis,
  options: MapDraftBuildOptions,
): MapFeature[] {
  const result: MapFeature[] = []
  let addedOrder = 0
  let pathOrder = 0

  // 1. Landmass base polygons
  if (options.includeLandmasses) {
    for (const lm of analysis.landmasses) {
      if (lm.points.length < 3) continue
      result.push({
        id: crypto.randomUUID(),
        tool: 'Land',
        name: lm.name,
        points: lm.points,
        size: 1,
        angle: 0,
        addedOrder: addedOrder++,
        brush: {
          diameter: 120,
          roughness: options.roughness,
          smooth: true,
          subtract: false,
          opacity: 1,
          terrain: resolveTerrainName(lm.biome),
          generated: false,
          textureScale: 100,
          rotation: 0,
          shape: 'Polygon',
          blend: { ...defaultTerrainBlend },
        },
      })
    }
  }

  // 2. Inland lakes / seas carved out of landmass shapes
  if (options.includeLakes) {
    for (const lake of analysis.lakes) {
      if (lake.points.length < 3) continue
      result.push({
        id: crypto.randomUUID(),
        tool: 'Land',
        name: lake.name,
        points: lake.points,
        size: 1,
        angle: 0,
        addedOrder: addedOrder++,
        brush: {
          diameter: 60,
          roughness: Math.min(options.roughness, 10),
          smooth: true,
          subtract: true,
          opacity: 1,
          shape: 'Polygon',
        },
      })
    }
  }

  // 3. Soft blended biome patches clipped inside coastlines
  if (options.includeBiomes) {
    for (const zone of analysis.biomeZones) {
      const biome = resolveTerrainName(zone.biome)
      const diameter = Math.round(clamp(zone.radius * atlasWidth * 1.9, 110, 520))
      result.push({
        id: crypto.randomUUID(),
        tool: 'Land',
        name: `${biome} region`,
        points: [zone.center],
        size: 1,
        angle: 0,
        addedOrder: addedOrder++,
        brush: {
          diameter,
          roughness: 6,
          smooth: true,
          subtract: false,
          clipToLand: true,
          opacity: 0.88,
          terrain: biome,
          generated: false,
          textureScale: 100,
          rotation: 0,
          blend: {
            ...defaultTerrainBlend,
            hardness: 22,
            strength: 90,
            noise: 45,
          },
        },
      })
    }
  }

  // 4. Vector rivers, roads, and borders
  if (options.includePaths) {
    for (const item of analysis.paths) {
      if (item.points.length < 2) continue
      const defaults = pathDefaults(item.kind)
      const path: AtlasPathSettings = { ...defaults, layerOrder: pathOrder++ }
      if (item.kind === 'River') {
        const key = item.preset && item.preset in riverPresets ? (item.preset as keyof typeof riverPresets) : 'river'
        const preset = riverPresets[key]
        path.river = key
        path.width = preset.width
        path.mouthWidth = preset.mouth
      } else if (item.kind === 'Route') {
        const road = item.preset && VALID_ROADS.has(item.preset as RoadTexture) ? (item.preset as RoadTexture) : 'dirt'
        path.terrainMode = item.preset === 'trade_route' ? 'manual' : 'auto'
        path.texture = road
      } else if (item.kind === 'Border') {
        path.border = 'dashed'
        path.closed = item.preset === 'closed'
        path.fill = false
      }
      result.push({
        id: crypto.randomUUID(),
        tool: item.kind,
        name: item.name,
        points: item.points,
        size: 1,
        angle: 0,
        addedOrder: addedOrder++,
        path,
      })
    }
  }

  // 5. Mountain, forest, and settlement stamps
  const detectedMountains = options.includeMountains ? analysis.stamps.filter(s => s.kind === 'mountains') : []
  const detectedForests = options.includeForests ? analysis.stamps.filter(s => s.kind === 'forests') : []
  const detectedSettlements = options.includeSettlements ? analysis.stamps.filter(s => s.kind === 'settlements') : []
  const suggestedMountains = options.includeSuggestedNature && options.includeMountains
    ? analysis.suggestedStamps.filter(s => s.kind === 'mountains')
    : []
  const suggestedForests = options.includeSuggestedNature && options.includeForests
    ? analysis.suggestedStamps.filter(s => s.kind === 'forests')
    : []

  const ordered = [
    ...detectedMountains,
    ...suggestedMountains,
    ...detectedForests,
    ...suggestedForests,
    ...detectedSettlements,
  ]
  for (const stamp of ordered) {
    result.push({
      id: crypto.randomUUID(),
      tool: 'Stamp',
      stampId: stamp.stampId,
      name: stamp.label,
      points: [stamp.point],
      size: stamp.size,
      angle: 0,
      opacity: 1,
      stampOrder: 'auto',
      addedOrder: addedOrder++,
    })
  }

  // 6. Map text labels
  if (options.includeLabels) {
    for (const label of analysis.labels) {
      result.push({
        id: crypto.randomUUID(),
        tool: 'Label',
        name: label.text,
        points: [label.point],
        size: label.size,
        angle: 0,
        addedOrder: addedOrder++,
      })
    }
  }

  return result
}
