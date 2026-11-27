import type { TerrainTile } from './seamlessTerrain'

export type TerrainSurface = { terrain: string; scale: number; rotation: number }

type RGB = readonly [number, number, number]

export type BiomeDefinition = {
  name: string
  low: RGB
  mid: RGB
  high: RGB
  accent: RGB
  grain: number
  seed: number
}

export const biomeDefinitions: readonly BiomeDefinition[] = [
  {
    name: 'Grassland',
    low: [104, 112, 62],
    mid: [134, 138, 76],
    high: [164, 162, 98],
    accent: [152, 144, 86],
    grain: 0.72,
    seed: 101,
  },
  {
    name: 'Plains',
    low: [122, 134, 82],
    mid: [152, 160, 102],
    high: [182, 184, 126],
    accent: [126, 144, 86],
    grain: 0.78,
    seed: 203,
  },
  {
    name: 'Woodland',
    low: [62, 82, 49],
    mid: [86, 106, 63],
    high: [114, 131, 80],
    accent: [98, 109, 64],
    grain: 0.80,
    seed: 307,
  },
  {
    name: 'Highlands',
    low: [102, 93, 81],
    mid: [132, 122, 106],
    high: [160, 150, 132],
    accent: [122, 118, 96],
    grain: 0.92,
    seed: 409,
  },
  {
    name: 'Snow',
    low: [182, 194, 200],
    mid: [215, 222, 224],
    high: [236, 240, 240],
    accent: [198, 207, 209],
    grain: 0.42,
    seed: 503,
  },
  {
    name: 'Desert',
    low: [182, 140, 82],
    mid: [212, 174, 112],
    high: [234, 204, 144],
    accent: [198, 154, 94],
    grain: 0.58,
    seed: 607,
  },
  {
    name: 'Marsh',
    low: [66, 84, 72],
    mid: [90, 107, 89],
    high: [116, 129, 102],
    accent: [82, 104, 96],
    grain: 0.68,
    seed: 709,
  },
  {
    name: 'Ashlands',
    low: [58, 54, 52],
    mid: [84, 79, 75],
    high: [110, 102, 96],
    accent: [96, 82, 74],
    grain: 0.88,
    seed: 811,
  },
] as const

const biomeByName = new Map(biomeDefinitions.map(biome => [biome.name, biome]))

const legacyTerrainAliases: Record<string, string> = {
  'Seamless Ancient Grassland': 'Grassland',
  'Mossy Ancient Grassland Map Cutout': 'Grassland',
  'Rolling Ancient Grassland': 'Grassland',
  'Grassland with Scattered Ancient Stone': 'Grassland',
  'Lighter, Open Canopy Forest': 'Woodland',
  'Isometric Woodland Clearing Tile': 'Woodland',
  'Standard Dense Forest Floor': 'Woodland',
  'Forest to Path Transition': 'Woodland',
  'Craggy Peaks & Scree': 'Highlands',
  'Snowy Tundra': 'Snow',
  'High Mountain Snowfield': 'Snow',
  'Deep Glacial Ice': 'Snow',
  'Bog & Fens': 'Marsh',
  'Murky Stagnant Water': 'Marsh',
}

export function resolveTerrainName(name?: string): string {
  if (!name) return 'Grassland'
  if (biomeByName.has(name)) return name
  if (legacyTerrainAliases[name]) return legacyTerrainAliases[name]
  const lower = name.toLowerCase()
  if (/snow|tundra|ice|glacial/.test(lower)) return 'Snow'
  if (/woodland|forest|canopy/.test(lower)) return 'Woodland'
  if (/highland|peak|crag|scree|mountain|stone/.test(lower)) return 'Highlands'
  if (/desert|dune|sand/.test(lower)) return 'Desert'
  if (/marsh|bog|fen|swamp|stagnant/.test(lower)) return 'Marsh'
  if (/ash|volcan|cinder/.test(lower)) return 'Ashlands'
  if (/plain|steppe|meadow/.test(lower)) return 'Plains'
  return 'Grassland'
}

function profile(name: string): BiomeDefinition {
  return biomeByName.get(resolveTerrainName(name)) ?? biomeDefinitions[0]
}

export const terrainSurfaceKey = ({ terrain, scale, rotation }: TerrainSurface) =>
  JSON.stringify([resolveTerrainName(terrain), scale, rotation])

function lattice(x: number, y: number, seed = 0) {
  let hash = (Math.imul(x + seed * 31, 374761393) + Math.imul(y - seed * 17, 668265263)) | 0
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295
}

const mix = (a: number, b: number, weight: number) => a + (b - a) * weight
const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const wrapInt = (value: number, period: number) => ((value % period) + period) % period

export function terrainNoise(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const sx = smooth(x - ix)
  const sy = smooth(y - iy)
  return mix(
    mix(lattice(ix, iy), lattice(ix + 1, iy), sx),
    mix(lattice(ix, iy + 1), lattice(ix + 1, iy + 1), sx),
    sy
  )
}

function periodicNoise(x: number, y: number, period: number, seed: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const sx = smooth(x - ix)
  const sy = smooth(y - iy)
  const x0 = wrapInt(ix, period)
  const x1 = wrapInt(ix + 1, period)
  const y0 = wrapInt(iy, period)
  const y1 = wrapInt(iy + 1, period)
  return mix(
    mix(lattice(x0, y0, seed), lattice(x1, y0, seed), sx),
    mix(lattice(x0, y1, seed), lattice(x1, y1, seed), sx),
    sy
  )
}

const proceduralTileCache = new Map<string, TerrainTile>()

function paintWrapped(size: number, x: number, y: number, margin: number, draw: (dx: number, dy: number) => void) {
  const oxList = x < margin ? [0, size] : x > size - margin ? [0, -size] : [0]
  const oyList = y < margin ? [0, size] : y > size - margin ? [0, -size] : [0]
  for (const dx of oxList) {
    for (const dy of oyList) {
      draw(dx, dy)
    }
  }
}

function paintPlainsOverlay(context: CanvasRenderingContext2D, size: number, seed: number) {
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'

  // Subtle horizontal rolling-hill grass wisps
  for (let i = 0; i < 48; i++) {
    const x = lattice(i, 1, seed + 401) * size
    const y = lattice(i, 2, seed + 409) * size
    const span = 18 + lattice(i, 3, seed + 419) * 26
    const arch = (lattice(i, 4, seed + 421) - 0.5) * 6
    const warm = i % 2 === 0
    context.strokeStyle = warm ? 'rgba(218, 220, 160, 0.22)' : 'rgba(104, 118, 68, 0.16)'
    context.lineWidth = 1.25
    paintWrapped(size, x, y, span + 6, (dx, dy) => {
      context.beginPath()
      context.moveTo(x - span / 2 + dx, y + dy)
      context.quadraticCurveTo(x + dx, y + arch + dy, x + span / 2 + dx, y + dy)
      context.stroke()
    })
  }

  // Jittered-grid 3-blade cartographic meadow tufts
  const cols = 10
  const rows = 9
  const cellW = size / cols
  const cellH = size / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (lattice(c, r, seed + 431) < 0.06) continue
      const x = (c + 0.18 + lattice(c, r, seed + 433) * 0.64) * cellW
      const y = (r + 0.22 + lattice(c, r, seed + 439) * 0.58) * cellH
      const h = 5 + lattice(c, r, seed + 443) * 4
      const spread = 3 + lattice(c, r, seed + 449) * 2.2
      const lean = (lattice(c, r, seed + 457) - 0.5) * 2.2

      paintWrapped(size, x, y, 24, (dx, dy) => {
        const bx = x + dx
        const by = y + dy
        context.strokeStyle = 'rgba(214, 216, 156, 0.18)'
        context.lineWidth = 1.0
        context.beginPath()
        context.moveTo(bx + 1, by + 0.6)
        context.quadraticCurveTo(bx + 1 + lean * 0.4, by - h * 0.5, bx + 1 + lean, by - h + 0.8)
        context.stroke()

        context.strokeStyle = 'rgba(84, 102, 54, 0.24)'
        context.lineWidth = 1.15
        context.beginPath()
        // Center blade
        context.moveTo(bx, by)
        context.quadraticCurveTo(bx + lean * 0.4, by - h * 0.55, bx + lean, by - h)
        // Left curved blade
        context.moveTo(bx - 1.2, by)
        context.quadraticCurveTo(bx - spread * 0.65, by - h * 0.45, bx - spread + lean * 0.4, by - h * 0.78)
        // Right curved blade
        context.moveTo(bx + 1.2, by)
        context.quadraticCurveTo(bx + spread * 0.65, by - h * 0.45, bx + spread + lean * 0.4, by - h * 0.78)
        context.stroke()
      })
    }
  }

  // Soft meadow seed & pebble stipples
  context.fillStyle = 'rgba(92, 100, 62, 0.16)'
  for (let i = 0; i < 130; i++) {
    const x = lattice(i, 5, seed + 461) * size
    const y = lattice(i, 6, seed + 463) * size
    const radius = 0.7 + lattice(i, 7, seed + 467) * 0.9
    paintWrapped(size, x, y, 8, (dx, dy) => {
      context.beginPath()
      context.arc(x + dx, y + dy, radius, 0, Math.PI * 2)
      context.fill()
    })
  }

  context.restore()
}

// Generate a mathematically seamless 384x384 painterly watercolor/parchment tile
// free of baked landforms so map stamps stay visually dominant.
export function makeProceduralBiomeTile(name: string): TerrainTile {
  const biome = profile(name)
  const cached = proceduralTileCache.get(biome.name)
  if (cached) return cached

  const size = 384
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to generate biome tile')
  const image = context.createImageData(size, size)

  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      const broad = periodicNoise(u * 3, v * 3, 3, biome.seed + 11)
      const warpX = (broad - 0.5) * 0.14
      const warpY = (periodicNoise(u * 3, v * 3, 3, biome.seed + 23) - 0.5) * 0.14
      const wash = periodicNoise((u + warpX) * 6, (v + warpY) * 6, 6, biome.seed + 37)
      const mottle = periodicNoise(u * 12, v * 12, 12, biome.seed + 73)
      const detail = periodicNoise(u * 28, v * 28, 28, biome.seed + 131)

      let combined = broad * 0.45 + wash * 0.30 + mottle * 0.17 + detail * 0.08
      let extraAccent = 0
      if (biome.name === 'Plains') {
        const rolling = periodicNoise(u * 6, v * 12, 6, biome.seed + 181)
        const clover = periodicNoise(u * 18, v * 18, 18, biome.seed + 193)
        combined = clamp(combined * 0.72 + rolling * 0.28 + (clover - 0.5) * 0.08)
        extraAccent = smooth(clamp((rolling - 0.4) / 0.42)) * 0.2
      } else if (biome.name === 'Desert') {
        const ripple = Math.sin((u * 4 + v * 2 + broad * 0.85) * Math.PI * 2) * 0.085
        combined = clamp(combined + ripple)
      }

      const tone = smooth(clamp((combined - 0.18) / 0.64))
      const accentMix = Math.min(0.55, smooth(clamp((mottle - 0.35) / 0.45)) * 0.32 + extraAccent)
      const paper = (lattice(x, y, biome.seed) - 0.5) * 7.5 * biome.grain + (detail - 0.5) * 6 * biome.grain

      const index = (y * size + x) * 4
      for (let c = 0; c < 3; c++) {
        const base = tone < 0.5
          ? mix(biome.low[c], biome.mid[c], tone * 2)
          : mix(biome.mid[c], biome.high[c], (tone - 0.5) * 2)
        const painted = mix(base, biome.accent[c], accentMix) + paper
        image.data[index + c] = Math.max(0, Math.min(255, Math.round(painted)))
      }
      image.data[index + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  if (biome.name === 'Plains') {
    paintPlainsOverlay(context, size, biome.seed)
  }
  const finalPixels = biome.name === 'Plains' ? context.getImageData(0, 0, size, size) : image
  const tile: TerrainTile = { url: canvas.toDataURL('image/png'), pixels: finalPixels }
  proceduralTileCache.set(biome.name, tile)
  return tile
}

const noise = terrainNoise
const yieldToRenderer = () => new Promise<void>(resolve => setTimeout(resolve, 0))

// Build a single map-space height field. Position, scale and rotation determine
// the result, so another stroke with those settings meets the same landforms.
export async function makeTerrainSurface(settings: TerrainSurface, cancelled: () => boolean): Promise<TerrainTile | undefined> {
  const width = 800
  const height = 500
  const elevation = new Float32Array(width * height)
  const biome = profile(settings.terrain)
  const angle = settings.rotation * Math.PI / 180
  const frequency = 100 / Math.max(25, settings.scale) / 54
  const cos = Math.cos(angle) * frequency
  const sin = Math.sin(angle) * frequency

  for (let y = 0; y < height; y++) {
    if (y && y % 40 === 0) await yieldToRenderer()
    if (cancelled()) return
    for (let x = 0; x < width; x++) {
      const u = x * cos + y * sin
      const v = y * cos - x * sin
      const a = u + (noise(u * 0.62 + 19, v * 0.62 - 4) - 0.5) * 2.1
      const b = v + (noise(u * 0.58 - 11, v * 0.58 + 21) - 0.5) * 2.1
      const broad = noise(a * 0.62, b * 0.62)
      const hills = noise(a * 1.45 - b * 0.93 - 37, a * 0.93 + b * 1.45)
      const brokenSlopes = noise(a * 2.2 + b * 2.1, b * 2.2 - a * 2.1 + 13)
      const channels = noise(a * 3.8 + b * 1.7 + 59, b * 4.9 - a * 1.7)
      const ridge = 1 - Math.abs(2 * channels - 1)
      const detail = noise(a * 8.6 - b * 2.9, b * 8.6 + a * 2.9 - 72)
      const highGround = smooth(clamp((broad * 0.75 + hills * 0.25 - 0.33) / 0.43))
      const ridgeStrength = highGround * mix(0.034, 0.11, brokenSlopes)
      elevation[y * width + x] = broad * 0.49 + hills * 0.26 + brokenSlopes * 0.105 +
        smooth(ridge) * ridgeStrength + detail * mix(0.018, 0.045, highGround)
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to generate terrain surface')
  const image = context.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    if (y && y % 80 === 0) await yieldToRenderer()
    if (cancelled()) return
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const dx = elevation[y * width + Math.min(width - 1, x + 1)] - elevation[y * width + Math.max(0, x - 1)]
      const dy = elevation[Math.min(height - 1, y + 1) * width + x] - elevation[Math.max(0, y - 1) * width + x]
      const gx = dx * 13
      const gy = dy * 13
      const diffuse = clamp((0.82 + gx * 0.4 + gy * 0.4) / Math.hypot(1, gx, gy))
      const light = 0.57 + diffuse * 0.46
      const mottling = noise(x / 4.2 + 9, y / 4.2 - 11) - 0.5
      const grain = (mottling * 14 + (lattice(x, y) - 0.5) * 7) * biome.grain
      const tone = smooth(clamp((elevation[i] + mottling * 0.11 - 0.17) / 0.59))
      for (let c = 0; c < 3; c++) {
        const base = tone < 0.5
          ? mix(biome.low[c], biome.mid[c], tone * 2)
          : mix(biome.mid[c], biome.high[c], (tone - 0.5) * 2)
        image.data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(base * light + grain)))
      }
      image.data[i * 4 + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return { url: canvas.toDataURL('image/jpeg', 0.9), pixels: image, elevation }
}
