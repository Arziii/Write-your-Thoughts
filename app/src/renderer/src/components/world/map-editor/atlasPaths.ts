import type { MapPoint } from './MapCanvas'

export const atlasWidth = 3840
export const atlasHeight = 1920
export type AtlasPathTool = 'Route' | 'River' | 'Border'
export const isAtlasPath = (tool: string): tool is AtlasPathTool =>
  tool === 'Route' || tool === 'River' || tool === 'Border'
export const roadTextures = {
  dirt: 'Dirt road', forest_trail: 'Forest trail', gravel: 'Gravel road', stone: 'Rocky path',
  sand: 'Sandy trail', snow: 'Snow trail', mud: 'Muddy path', cobblestone: 'Cobblestone road',
  trade_route: 'Dashed trade route',
} as const
export type RoadTexture = keyof typeof roadTextures
export type AtlasTerrain = Exclude<RoadTexture, 'trade_route'> | 'water'
export const riverPresets = {
  stream: { label: 'Narrow stream', width: 9, mouth: 14 },
  river: { label: 'Medium river', width: 16, mouth: 27 },
  wide_river: { label: 'Wide river', width: 28, mouth: 46 },
} as const
export const borderStyles = {
  solid: 'Solid kingdom border', double: 'Double imperial border', dashed: 'Dashed territorial border',
  dotted: 'Dotted disputed border', decorative: 'Decorative fantasy border',
} as const
export type AtlasPathSettings = {
  width: number
  mouthWidth: number
  opacity: number
  terrainMode: 'auto' | 'manual'
  texture: RoadTexture
  river: keyof typeof riverPresets
  border: keyof typeof borderStyles
  color: string
  spacing: number
  fill: boolean
  closed: boolean
  layerOrder: number
}
export type AtlasPathFeature = {
  id: string
  tool: string
  points: MapPoint[]
  path?: Partial<AtlasPathSettings>
}
export type WorldPoint = { x: number; y: number }
export type PathSample = WorldPoint & { at: number }
export const toWorld = ({ x, y }: MapPoint): WorldPoint => ({ x: x * atlasWidth, y: y * atlasHeight })
export const toMap = ({ x, y }: WorldPoint): MapPoint => ({ x: x / atlasWidth, y: y / atlasHeight })
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n))
export const smoothStep = (n: number) => {
  const t = clamp(n)
  return t * t * (3 - 2 * t)
}
export const pathDefaults = (tool: AtlasPathTool): AtlasPathSettings => ({
  width: tool === 'River' ? 16 : tool === 'Route' ? 14 : 3,
  mouthWidth: 27, opacity: 1, terrainMode: 'auto', texture: 'dirt', river: 'river',
  border: 'solid', color: '#823c2e', spacing: 10, fill: false, closed: false, layerOrder: 0,
})
export function pathSettings(feature: AtlasPathFeature, index = 0): AtlasPathSettings {
  const tool = feature.tool as AtlasPathTool
  const previous = !feature.path && (tool === 'Border'
    ? { border: 'dashed', closed: true, fill: true, color: '#97612b' } as const
    : tool === 'Route' ? { terrainMode: 'manual', texture: 'trade_route', width: 5 } as const
      : { width: 5, mouthWidth: 7, river: 'stream' } as const)
  return { ...pathDefaults(tool), layerOrder: index, ...(previous || {}), ...feature.path }
}

export function terrainFromName(name = ''): AtlasTerrain {
  const normalized = name.toLowerCase()
  if (/snow|tundra|ice|glacial/.test(normalized)) return 'snow'
  if (/woodland|forest|canopy/.test(normalized)) return 'forest_trail'
  if (/marsh|bog|fen|swamp|mud|stagnant/.test(normalized)) return 'mud'
  if (/desert|dune|sand|dryland/.test(normalized)) return 'sand'
  if (/highland|ashland|peak|crag|mountain|scree/.test(normalized)) return 'stone'
  if (/plain|rolling|hill|scattered.*stone|gravel/.test(normalized)) return 'gravel'
  return 'dirt'
}

function distance(a: WorldPoint, b: WorldPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Limit each tangent to the length of its shortest neighbouring segment so sparse
// point-to-point paths and denser freehand paths can use the same interpolator.
export function spline(points: MapPoint[], closed = false): PathSample[] {
  const knots: WorldPoint[] = []
  for (const input of points) {
    const point = toWorld(input)
    if (!knots.length || distance(knots[knots.length - 1], point) > .05) knots.push(point)
  }
  if (closed && knots.length > 2 && distance(knots[0], knots[knots.length - 1]) < .1) knots.pop()
  if (!knots.length) return []
  const result = [{ ...knots[0], at: 0 }]
  if (knots.length < 2) return result
  closed = closed && knots.length > 2
  const knot = (i: number) => knots[closed ? (i + knots.length) % knots.length : clamp(i, 0, knots.length - 1)]
  for (let i = 0; i < knots.length - (closed ? 0 : 1); i++) {
    const [a, b, c, d] = [knot(i - 1), knot(i), knot(i + 1), knot(i + 2)]
    const length = distance(b, c)
    const left = distance(a, b)
    const right = distance(c, d)
    const start = left ? .55 * Math.min(length, left) / Math.max(.01, distance(a, c)) : 1
    const end = right ? .55 * Math.min(length, right) / Math.max(.01, distance(b, d)) : 1
    const control1 = left ? { x: b.x + (c.x - a.x) * start, y: b.y + (c.y - a.y) * start }
      : { x: lerp(b.x, c.x, 1 / 3), y: lerp(b.y, c.y, 1 / 3) }
    const control2 = right ? { x: c.x - (d.x - b.x) * end, y: c.y - (d.y - b.y) * end }
      : { x: lerp(b.x, c.x, 2 / 3), y: lerp(b.y, c.y, 2 / 3) }
    for (let step = 1, count = Math.ceil(length / 6); step <= count; step++) {
      const t = step / count
      const u = 1 - t
      const point = {
        x: u ** 3 * b.x + 3 * u ** 2 * t * control1.x + 3 * u * t ** 2 * control2.x + t ** 3 * c.x,
        y: u ** 3 * b.y + 3 * u ** 2 * t * control1.y + 3 * u * t ** 2 * control2.y + t ** 3 * c.y,
      }
      const last = result[result.length - 1]
      result.push({ ...point, at: last.at + distance(last, point) })
    }
  }
  return result
}

export function nearestOnPath(point: WorldPoint, samples: PathSample[]) {
  let best: { point: WorldPoint; distance: number } | undefined
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1))
    const projected = { x: a.x + dx * t, y: a.y + dy * t }
    const offset = distance(point, projected)
    if (!best || offset < best.distance) best = { point: projected, distance: offset }
  }
  return best
}

export function simplifyPath(points: MapPoint[], tolerance = 2.5): MapPoint[] {
  if (points.length <= 2) return points
  const world = points.map(toWorld)
  const keep = new Set([0, points.length - 1])
  const ranges = [[0, points.length - 1]]
  while (ranges.length) {
    const [start, end] = ranges.pop()!
    const segment = [{ ...world[start], at: 0 }, { ...world[end], at: 0 }]
    let farthest = tolerance
    let split = start
    for (let index = start + 1; index < end; index++) {
      const offset = nearestOnPath(world[index], segment)?.distance ?? 0
      if (offset > farthest) {
        split = index
        farthest = offset
      }
    }
    if (split !== start) {
      keep.add(split)
      ranges.push([start, split], [split, end])
    }
  }
  return points.filter((_, index) => keep.has(index))
}
