import { atlasHeight as height, atlasWidth as width, clamp, lerp, smoothStep, toWorld } from './atlasPaths'
import type { WorldPoint } from './atlasPaths'
import type { MapPoint } from './MapCanvas'
import type { TerrainTile } from './seamlessTerrain'
import { resolveTerrainName, terrainNoise, terrainSurfaceKey } from './terrainSurface'

export type TerrainBlendSettings = {
  hardness: number
  strength: number
  noise: number
  harmonize: boolean
  relief: boolean
}

export const defaultTerrainBlend: TerrainBlendSettings = {
  hardness: 35, strength: 80, noise: 25, harmonize: true, relief: true,
}

export const MAX_ROUGHNESS = 40

export function coastDisplacementScale(roughness: number) {
  return roughness > 0 ? roughness * 6 : 0
}

export function coastDisplacementReach(roughness: number) {
  const scale = coastDisplacementScale(roughness)
  return scale > 0 ? Math.ceil(scale * 0.6) + 12 : 0
}

export function coastTurbulenceFrequency(roughness: number) {
  const t = clamp(roughness / MAX_ROUGHNESS)
  return Number((0.022 - t * 0.013).toFixed(4))
}

export type TerrainShape = 'Rectangle' | 'Ellipse' | 'Diamond' | 'Fill' | 'Polygon'
export type TerrainBrush = {
  diameter: number
  roughness: number
  smooth: boolean
  subtract: boolean
  clipToLand?: boolean
  water?: string
  eraser?: boolean
  opacity?: number
  terrain?: string
  generated?: boolean
  textureScale?: number
  rotation?: number
  shape?: TerrainShape
  blend?: TerrainBlendSettings
}
export type TerrainFeature = {
  id: string
  points: MapPoint[]
  brush?: TerrainBrush
  erasures?: { points: MapPoint[]; diameter: number }[]
}
export type TerrainTextures = Record<string, TerrainTile>

const tileSize = 80
const columns = Math.ceil(width / tileSize)
const rows = Math.ceil(height / tileSize)
const halo = 1
const cacheLimit = 240

type Bounds = { left: number; top: number; right: number; bottom: number }
type Tile = { x: number; y: number; width: number; height: number }
type Segment = { start: WorldPoint; dx: number; dy: number; inverse: number; bounds: Bounds }
type Texture = { pixels: ImageData; ux: number; uy: number; vx: number; vy: number; repeat: boolean }
type Material = { id: number; texture: Texture; height: Float32Array }
type Prepared = {
  feature: TerrainFeature
  bounds: Bounds
  segments?: Segment[]
  shape?: Path2D
  erasures?: { path: Path2D; diameter?: number }[]
  material?: Material
}

// The blend is calculated for a tile plus one pixel on each side so relief
// gradients are continuous across tile boundaries.
type TileState = {
  rgb: Float32Array
  alpha: Float32Array
  land: Float32Array
  elevation: Float32Array
  relief: Float32Array
  material: Uint16Array
  weight: Float32Array
}

function boundsOf(points: WorldPoint[], pad = 0): Bounds {
  const x = points.map(point => point.x)
  const y = points.map(point => point.y)
  return { left: Math.min(...x) - pad, top: Math.min(...y) - pad,
    right: Math.max(...x) + pad, bottom: Math.max(...y) + pad }
}

function intersects(bounds: Bounds, tile: Tile) {
  return bounds.left < tile.x + tile.width && bounds.right > tile.x &&
    bounds.top < tile.y + tile.height && bounds.bottom > tile.y
}

function tileBounds(key: number): Tile {
  const x = key % columns * tileSize
  const y = Math.floor(key / columns) * tileSize
  return { x, y, width: Math.min(tileSize, width - x), height: Math.min(tileSize, height - y) }
}

function tilesIn(bounds: Bounds) {
  const tiles: number[] = []
  const top = Math.max(0, Math.floor((bounds.top - halo) / tileSize))
  const left = Math.max(0, Math.floor((bounds.left - halo) / tileSize))
  const bottom = Math.min(rows - 1, Math.floor((bounds.bottom + halo) / tileSize))
  const right = Math.min(columns - 1, Math.floor((bounds.right + halo) / tileSize))
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) tiles.push(y * columns + x)
  return tiles
}

function strokePadding(brush?: TerrainBrush) {
  return brush ? (brush.shape ? 0 : brush.diameter / 2) + Math.max(8, coastDisplacementReach(brush.roughness) + 6) : 2
}

function featureBounds(feature: TerrainFeature) {
  return feature.brush?.shape === 'Fill' ? { left: 0, top: 0, right: width, bottom: height }
    : boundsOf(feature.points.map(toWorld), strokePadding(feature.brush))
}

function tileWithHalo(tile: Tile): Tile {
  return { x: tile.x - halo, y: tile.y - halo, width: tile.width + 2 * halo, height: tile.height + 2 * halo }
}

const midpoint = (a: WorldPoint, b: WorldPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function terrainBrushPath(points: MapPoint[], smooth: boolean) {
  const [first, ...remaining] = points.map(toWorld)
  const path = `M ${first.x} ${first.y}`
  if (!smooth) return path + remaining.map(point => ` L ${point.x} ${point.y}`).join('')
  const last = remaining[remaining.length - 1]
  const curves = remaining.slice(0, -1).map((point, index) => {
    const end = midpoint(point, remaining[index + 1])
    return `Q ${point.x} ${point.y} ${end.x} ${end.y}`
  })
  return last ? `${path} ${curves.join(' ')} L ${last.x} ${last.y}` : path
}

function strokeSegments(points: WorldPoint[], brush: TerrainBrush): Segment[] {
  const reach = strokePadding(brush)
  const segments: Segment[] = []
  const add = (a: WorldPoint, b: WorldPoint, support: WorldPoint[]) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    segments.push({ start: a, dx, dy, inverse: 1 / (dx * dx + dy * dy || 1), bounds: boundsOf(support, reach) })
  }
  let from = points[0]
  if (brush.smooth) {
    for (let index = 1; index < points.length - 1; index++) {
      const control = points[index]
      const end = midpoint(control, points[index + 1])
      const steps = Math.max(1, Math.ceil((Math.hypot(control.x - from.x, control.y - from.y) +
        Math.hypot(end.x - control.x, end.y - control.y)) / 8))
      let previous = from
      for (let step = 1; step <= steps; step++) {
        const t = step / steps
        const next = {
          x: lerp(lerp(from.x, control.x, t), lerp(control.x, end.x, t), t),
          y: lerp(lerp(from.y, control.y, t), lerp(control.y, end.y, t), t),
        }
        add(previous, next, [previous, next])
        previous = next
      }
      from = end
    }
    const last = points[points.length - 1]
    add(from, last, [from, last])
  } else {
    for (const point of points.slice(1)) {
      add(from, point, [from, point])
      from = point
    }
    if (points.length === 1) add(from, from, [from])
  }
  return segments
}

function addDistances(result: Float32Array, segments: Segment[], tile: Tile, first = 0, end = segments.length) {
  for (let segment = first; segment < end; segment++) {
    const { start, dx, dy, inverse, bounds } = segments[segment]
    if (!intersects(bounds, tile)) continue
    const left = Math.max(0, Math.floor(bounds.left - tile.x))
    const right = Math.min(tile.width, Math.ceil(bounds.right - tile.x))
    const top = Math.max(0, Math.floor(bounds.top - tile.y))
    const bottom = Math.min(tile.height, Math.ceil(bounds.bottom - tile.y))
    for (let y = top; y < bottom; y++) {
      const sy = tile.y + y + .5 - start.y
      for (let x = left, index = y * tile.width + left; x < right; x++, index++) {
        const sx = tile.x + x + .5 - start.x
        const t = clamp((sx * dx + sy * dy) * inverse)
        const a = sx - t * dx
        const b = sy - t * dy
        const squared = a * a + b * b
        if (squared < result[index]) result[index] = squared
      }
    }
  }
}

function shapePath(points: WorldPoint[], shape?: TerrainShape) {
  const path = new Path2D()
  if (points.length === 0) return path
  const { left, top, right, bottom } = boundsOf(points)
  if (shape === 'Fill') path.rect(0, 0, width, height)
  else if (shape === 'Rectangle') path.rect(left, top, right - left, bottom - top)
  else if (shape === 'Ellipse') path.ellipse((left + right) / 2, (top + bottom) / 2, (right - left) / 2, (bottom - top) / 2, 0, 0, Math.PI * 2)
  else {
    const vertices = shape === 'Diamond' ? [
      { x: (left + right) / 2, y: top }, { x: right, y: (top + bottom) / 2 },
      { x: (left + right) / 2, y: bottom }, { x: left, y: (top + bottom) / 2 },
    ] : points
    if (vertices.length < 3) return path
    path.moveTo(vertices[0].x, vertices[0].y)
    for (const point of vertices.slice(1)) path.lineTo(point.x, point.y)
    path.closePath()
  }
  return path
}

const reliefStep = 8
const reliefColumns = Math.ceil(width / reliefStep) + 2
const reliefRows = Math.ceil(height / reliefStep) + 2
const groundHeight = new Float32Array(reliefColumns * reliefRows)
const materialHeights = new Map<string, Float32Array>()
let groundReady = false

function makeHeight(terrain: string, surface?: TerrainTile) {
  const canonical = resolveTerrainName(terrain)
  const source = surface?.elevation
  const cached = materialHeights.get(canonical)
  if (!source && cached) return cached
  const result = new Float32Array(groundHeight.length)
  const strength = canonical === 'Highlands' || canonical === 'Ashlands' ? .68
    : canonical === 'Marsh' || canonical === 'Desert' || canonical === 'Snow' ? .18 : .30
  for (let y = 0; y < reliefRows; y++) for (let x = 0; x < reliefColumns; x++) {
    const i = y * reliefColumns + x
    if (!groundReady) {
      const large = terrainNoise(x / 18, y / 19)
      groundHeight[i] = large * 13 + terrainNoise(x / 8 + large, y / 9) * 6
    }
    if (source && surface) {
      const sx = Math.min(surface.pixels.width - 1, Math.round(x * reliefStep / width * (surface.pixels.width - 1)))
      const sy = Math.min(surface.pixels.height - 1, Math.round(y * reliefStep / height * (surface.pixels.height - 1)))
      result[i] = groundHeight[i] + (source[sy * surface.pixels.width + sx] - .5) * 10
    } else {
      const detail = terrainNoise((x + y) / 5, (y - x * .8) / 7)
      result[i] = groundHeight[i] + (detail - .5) * strength * 6
    }
  }
  groundReady = true
  if (!source) materialHeights.set(canonical, result)
  return result
}

function elevationAt(field: Float32Array, x: number, y: number) {
  const u = Math.max(0, x) / reliefStep
  const v = Math.max(0, y) / reliefStep
  const col = Math.floor(u)
  const row = Math.floor(v)
  const i = row * reliefColumns + col
  return lerp(lerp(field[i], field[i + 1], u - col),
    lerp(field[i + reliefColumns], field[i + reliefColumns + 1], u - col), v - row)
}

function textureFor(pixels: ImageData, brush: TerrainBrush, generated: boolean): Texture {
  const radius = (brush.rotation ?? 0) * Math.PI / 180
  const scale = Math.max(.25, (brush.textureScale ?? 100) / 100)
  const u = pixels.width / (360 * scale)
  const v = u
  return generated ? { pixels, ux: pixels.width / width, uy: 0, vx: 0, vy: pixels.height / height, repeat: false } : {
    pixels, repeat: true, ux: u * Math.cos(radius), uy: u * Math.sin(radius),
    vx: -v * Math.sin(radius), vy: v * Math.cos(radius),
  }
}

function blendPixel(state: TileState, index: number, material: Material, x: number, y: number, weight: number, settings?: TerrainBlendSettings) {
  const { texture } = material
  const same = state.material[index] === material.id
  const previousWeight = same ? state.weight[index] : 0
  const smartRepeat = settings && same
  if (smartRepeat && weight <= previousWeight) return
  const alpha = smartRepeat ? (weight - previousWeight) / (1 - previousWeight) : weight
  const under = state.alpha[index] * (1 - alpha)
  const total = alpha + under
  const ratio = alpha / total
  const { data, width: tw, height: th } = texture.pixels
  let u = x * texture.ux + y * texture.uy
  let v = x * texture.vx + y * texture.vy
  if (texture.repeat) {
    u -= Math.floor(u / tw) * tw
    v -= Math.floor(v / th) * th
  } else {
    u = clamp(u, 0, tw - 1)
    v = clamp(v, 0, th - 1)
  }
  const tx = Math.floor(u)
  const ty = Math.floor(v)
  const tx2 = tx + 1 < tw ? tx + 1 : texture.repeat ? 0 : tx
  const ty2 = ty + 1 < th ? ty + 1 : texture.repeat ? 0 : ty
  const rowA = ty * tw * 4
  const rowB = ty2 * tw * 4
  const color = index * 3
  const harmonize = settings?.harmonize && !same ? 4 * weight * (1 - weight) * under * .28 : 0
  for (let c = 0; c < 3; c++) {
    const source = lerp(lerp(data[rowA + tx * 4 + c], data[rowA + tx2 * 4 + c], u - tx),
      lerp(data[rowB + tx * 4 + c], data[rowB + tx2 * 4 + c], u - tx), v - ty)
    const lower = state.rgb[color + c]
    const balanced = source + clamp(lower - source, -70, 70) * harmonize
    state.rgb[color + c] = lerp(lower, balanced, ratio)
  }
  const h = elevationAt(material.height, x, y)
  state.elevation[index] = lerp(state.elevation[index], h, alpha)
  state.relief[index] = lerp(state.relief[index], settings?.relief ? 1 : 0, alpha)
  state.alpha[index] = total
  state.material[index] = material.id
  state.weight[index] = smartRepeat ? weight : alpha + previousWeight * (1 - alpha)
}

function makeState(tile: Tile): TileState {
  const size = tile.width * tile.height
  const elevation = new Float32Array(size)
  if (groundReady) {
    for (let i = 0; i < size; i++) elevation[i] =
      elevationAt(groundHeight, tile.x + i % tile.width + .5, tile.y + Math.floor(i / tile.width) + .5)
  }
  return { rgb: new Float32Array(size * 3), alpha: new Float32Array(size), land: new Float32Array(size),
    elevation, relief: new Float32Array(size), material: new Uint16Array(size), weight: new Float32Array(size) }
}

function copyState(state: TileState): TileState {
  return { rgb: state.rgb.slice(), alpha: state.alpha.slice(), land: state.land.slice(),
    elevation: state.elevation.slice(), relief: state.relief.slice(), material: state.material.slice(), weight: state.weight.slice() }
}

function surfaceFor(brush: TerrainBrush, surfaces?: TerrainTextures) {
  if (!brush.terrain || !brush.generated || brush.blend) return
  return surfaces?.[terrainSurfaceKey({ terrain: brush.terrain, scale: brush.textureScale ?? 100, rotation: brush.rotation ?? 0 })]
}

function textureTile(feature: TerrainFeature, textures?: TerrainTextures, surfaces?: TerrainTextures) {
  const { brush } = feature
  if (!brush?.terrain) return undefined
  return surfaceFor(brush, surfaces) || textures?.[resolveTerrainName(brush.terrain)] || textures?.[brush.terrain]
}

export class TerrainCompositor {
  private readonly canvas: CanvasRenderingContext2D
  private readonly mask = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
  private readonly committedTiles = new Map<number, TileState>()
  private readonly draftDistances = new Map<number, { value: Float32Array; count: number }>()
  private readonly noise = new Map<number, Float32Array>()
  private materials = new Map<string, Material>()
  private scene: TerrainFeature[] = []
  private prepared: Prepared[] = []
  private textures: TerrainTextures | undefined
  private surfaces: TerrainTextures | undefined
  private draft: TerrainFeature | null = null

  constructor(canvas: HTMLCanvasElement) {
    // This surface receives CPU-generated pixel tiles. Keep it CPU-backed
    // and let the browser composite the finished canvas in the SVG scene.
    this.canvas = canvas.getContext('2d', { willReadFrequently: true })!
  }

  private prepare(feature: TerrainFeature): Prepared {
    const { brush } = feature
    let material: Material | undefined
    if (brush?.terrain) {
      const canonical = resolveTerrainName(brush.terrain)
      const settings = { terrain: canonical, scale: brush.textureScale ?? 100, rotation: brush.rotation ?? 0 }
      const surface = surfaceFor(brush, this.surfaces)
      const tile = surface || this.textures?.[canonical] || this.textures?.[brush.terrain]
      const key = JSON.stringify([settings, Boolean(surface), Boolean(brush.blend?.relief)])
      if (tile) {
        material = this.materials.get(key)
        if (!material) {
          material = { id: this.materials.size + 1, texture: textureFor(tile.pixels, brush, !!surface),
            height: makeHeight(canonical, surface) }
          this.materials.set(key, material)
        }
      }
    }
    const points = feature.points.map(toWorld)
    const erasures = feature.erasures?.map(erase => {
      if (erase.points.length === 1) {
        const point = toWorld(erase.points[0])
        const path = new Path2D()
        path.arc(point.x, point.y, erase.diameter / 2, 0, Math.PI * 2)
        return { path }
      }
      return { path: new Path2D(terrainBrushPath(erase.points, true)), diameter: erase.diameter }
    })
    return { feature, bounds: featureBounds(feature), material,
      ...(brush && !brush.shape ? { segments: strokeSegments(points, brush) } : { shape: shapePath(points, brush?.shape) }),
      erasures }
  }

  private pattern(key: number, tile: Tile) {
    const cached = this.noise.get(key)
    if (cached) return cached
    const values = new Float32Array(tile.width * tile.height)
    for (let y = 0, i = 0; y < tile.height; y++) for (let x = 0; x < tile.width; x++, i++) {
      const u = tile.x + x + .5
      const v = tile.y + y + .5
      values[i] = (terrainNoise(u / 96, v / 92) - .5) * .95 +
        (terrainNoise(u / 37 + 11, v / 35 - 5) - .5) * .65 +
        (terrainNoise(u / 13 + 17, v / 14 - 7) - .5) * .3 +
        (terrainNoise(u / 5.2, v / 4.8) - .5) * .14
    }
    this.noise.set(key, values)
    return values
  }

  private coverage(prepared: Prepared, tile: Tile) {
    if (!prepared.shape && !prepared.erasures) return
    const ctx = this.mask
    ctx.canvas.width = tile.width
    ctx.canvas.height = tile.height
    ctx.translate(-tile.x, -tile.y)
    if (prepared.shape) {
      ctx.fill(prepared.shape)
      const { brush } = prepared.feature
      const reach = brush && !brush.subtract && brush.shape !== 'Fill' ? coastDisplacementReach(brush.roughness) : 0
      if (reach > 0) {
        ctx.lineWidth = reach * 2
        ctx.lineJoin = 'round'
        ctx.stroke(prepared.shape)
      }
    } else ctx.fillRect(tile.x, tile.y, tile.width, tile.height)
    if (prepared.erasures) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const { path, diameter } of prepared.erasures) {
        if (diameter) {
          ctx.lineWidth = diameter
          ctx.stroke(path)
        } else ctx.fill(path)
      }
    }
    return ctx.getImageData(0, 0, tile.width, tile.height).data
  }

  private distances(prepared: Prepared, tile: Tile, key: number, preview: boolean) {
    const segments = prepared.segments
    if (!segments) return
    if (!preview) {
      const value = new Float32Array(tile.width * tile.height).fill(Infinity)
      addDistances(value, segments, tile)
      return value
    }
    let cached = this.draftDistances.get(key)
    // A smoothed stroke only changes its final straight segment as new
    // points arrive. Cache the distance to the finished prefix.
    const stable = segments.length - (prepared.feature.brush?.smooth ? 1 : 0)
    if (!cached || cached.count > stable) {
      cached = { value: new Float32Array(tile.width * tile.height).fill(Infinity), count: 0 }
      this.draftDistances.set(key, cached)
    }
    addDistances(cached.value, segments, tile, cached.count, stable)
    cached.count = stable
    if (stable === segments.length) return cached.value
    const value = cached.value.slice()
    addDistances(value, segments, tile, stable)
    return value
  }

  private paint(state: TileState, prepared: Prepared, tile: Tile, key: number, preview = false) {
    if (!intersects(prepared.bounds, tile)) return
    const { brush } = prepared.feature
    const { material } = prepared
    const opacity = brush?.opacity ?? 1
    if (opacity <= 0) return
    const pixels = this.coverage(prepared, tile)
    const distance = this.distances(prepared, tile, key, preview)
    const pattern = distance && this.pattern(key, tile)
    const radius = (brush?.diameter ?? 0) / 2
    const blend = brush?.blend
    const reach = coastDisplacementReach(brush?.roughness ?? 0)
    const feather = blend ? Math.max(.8, radius * (1 - blend.hardness / 100) * blend.strength / 100) : 5.5
    const noiseAmount = blend ? Math.min(feather * .78, radius * .34) * blend.noise / 100 : 10
    for (let i = 0; i < state.land.length; i++) {
      const coverage = pixels ? pixels[i * 4 + 3] / 255 : 1
      if (!coverage) continue
      const edge = distance ? radius - Math.sqrt(distance[i]) : 1
      const grain = pattern?.[i] ?? 0
      const displaced = edge + grain * (reach * .72)
      const hard = coverage * (distance ? smoothStep((displaced + 1) / 2) : 1)
      if (brush?.subtract) {
        if (hard > 0) state.land[i] *= 1 - hard * opacity
        const core = distance ? coverage * smoothStep((edge - reach + 1) / 2) : (reach > 0 ? 0 : hard)
        if (!core) continue
        const coreRemaining = 1 - core * opacity
        state.alpha[i] *= coreRemaining
        state.weight[i] = 0
        state.material[i] = 0
        state.relief[i] *= coreRemaining
        const x = tile.x + i % tile.width + .5
        const y = tile.y + Math.floor(i / tile.width) + .5
        state.elevation[i] = lerp(elevationAt(groundHeight, x, y), state.elevation[i], coreRemaining)
        continue
      }
      const underlying = state.land[i]
      if (brush?.clipToLand) {
        const maskWeight = Math.max(underlying, state.alpha[i])
        if (maskWeight <= .001) continue
        const fill = distance ? (blend ? smoothStep((edge + grain * noiseAmount) / feather)
          : smoothStep((displaced + grain * noiseAmount + feather) / (feather * 2))) * coverage : coverage
        const weight = fill * maskWeight * opacity
        if (material && weight > .001) {
          blendPixel(state, i, material, tile.x + i % tile.width + .5, tile.y + Math.floor(i / tile.width) + .5, weight, blend)
        }
        continue
      }
      // The very first material on new land runs up to the coast. A stroke on
      // already solid ground uses its feathered mask at the same pixel.
      const fill = distance ? (blend ? smoothStep((edge + grain * noiseAmount) / feather)
        : smoothStep((displaced + grain * noiseAmount + feather) / (feather * 2))) * coverage : coverage
      const coastalFill = distance ? coverage * smoothStep((edge + reach + 4) / 10) : hard
      const weight = lerp(coastalFill, fill, underlying) * opacity
      state.land[i] = underlying + hard * (1 - underlying)
      if (material && weight > .001) {
        blendPixel(state, i, material, tile.x + i % tile.width + .5, tile.y + Math.floor(i / tile.width) + .5, weight, blend)
      }
    }
  }

  render(scene: TerrainFeature[], draft: TerrainFeature | null, textures: TerrainTextures, surfaces: TerrainTextures) {
    const dirty = new Set<number>()
    const oldTextures = this.textures
    const oldSurfaces = this.surfaces
    const textureChanged = textures !== oldTextures || surfaces !== oldSurfaces
    const changedTile = (feature: TerrainFeature) => textureChanged &&
      textureTile(feature, oldTextures, oldSurfaces) !== textureTile(feature, textures, surfaces)
    if (textureChanged || scene !== this.scene) {
      const previous = new Map(this.prepared.map(item => [item.feature.id, item]))
      const next = new Map(scene.map((feature, index) => [feature.id, { feature, index }]))
      this.textures = textures
      this.surfaces = surfaces
      const resetMaterials = this.materials.size > scene.length + 40
      if (resetMaterials) {
        this.materials = new Map()
        this.committedTiles.clear()
      }
      this.prepared.forEach((item, index) => {
        const replacement = next.get(item.feature.id)
        if (resetMaterials || changedTile(item.feature) || replacement?.feature !== item.feature || replacement.index !== index) {
          for (const key of tilesIn(item.bounds)) dirty.add(key)
        }
      })
      const indices = new Map(this.scene.map((feature, index) => [feature.id, index]))
      this.prepared = scene.filter(feature => feature.points.length).map((feature, index) => {
        const old = previous.get(feature.id)
        const same = !resetMaterials && old?.feature === feature && indices.get(feature.id) === index && !changedTile(feature)
        const prepared = same ? old : this.prepare(feature)
        if (!same) for (const key of tilesIn(prepared.bounds)) dirty.add(key)
        return prepared
      })
      for (const key of dirty) this.committedTiles.delete(key)
      this.scene = scene
    }
    if (draft && changedTile(draft)) for (const key of tilesIn(featureBounds(draft))) dirty.add(key)
    if (draft !== this.draft) {
      const previous = this.draft
      if (draft?.id !== previous?.id) this.draftDistances.clear()
      if (draft && previous?.id === draft.id && !draft.brush?.shape) {
        const tail = draft.points.slice(Math.max(0, previous.points.length - 2)).map(toWorld)
        for (const key of tilesIn(boundsOf(tail, strokePadding(draft.brush)))) dirty.add(key)
      } else {
        if (previous) for (const key of tilesIn(featureBounds(previous))) dirty.add(key)
        if (draft) for (const key of tilesIn(featureBounds(draft))) dirty.add(key)
      }
      this.draft = draft
    }
    if (!dirty.size) return
    const preview = draft?.points.length ? this.prepare(draft) : undefined
    for (const key of dirty) {
      const target = tileBounds(key)
      const tile = tileWithHalo(target)
      let committed = this.committedTiles.get(key)
      if (!committed) {
        committed = makeState(tile)
        for (const item of this.prepared) this.paint(committed, item, tile, key)
        if (this.committedTiles.size >= cacheLimit) this.committedTiles.delete(this.committedTiles.keys().next().value!)
        this.committedTiles.set(key, committed)
      }
      const state = preview && intersects(preview.bounds, tile) ? copyState(committed) : committed
      if (state !== committed) this.paint(state, preview!, tile, key, true)
      this.draw(state, target, tile)
    }
  }

  private draw(state: TileState, target: Tile, tile: Tile) {
    const image = this.canvas.createImageData(target.width, target.height)
    for (let y = 0, i = 0; y < target.height; y++) for (let x = 0; x < target.width; x++, i++) {
      const cell = (y + halo) * tile.width + x + halo
      const alpha = state.alpha[cell]
      if (alpha <= .001) continue
      const dx = state.elevation[cell + 1] - state.elevation[cell - 1]
      const dy = state.elevation[cell + tile.width] - state.elevation[cell - tile.width]
      const light = state.land[cell - 1] > .95 && state.land[cell + 1] > .95 &&
        state.land[cell - tile.width] > .95 && state.land[cell + tile.width] > .95
        ? 1 + clamp((dx + dy) * .37, -.11, .11) * state.relief[cell] : 1
      for (let c = 0; c < 3; c++) image.data[i * 4 + c] = state.rgb[cell * 3 + c] * light
      image.data[i * 4 + 3] = alpha * 255
    }
    this.canvas.putImageData(image, target.x, target.y)
  }
}
