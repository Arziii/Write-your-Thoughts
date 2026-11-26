import type { TerrainTile } from './seamlessTerrain'

export type TerrainSurface = { terrain: string; scale: number; rotation: number }

type RGB = readonly [number, number, number]

function profile(name: string): { low: RGB; high: RGB; surfaceGrain: number } {
  if (/snowfield|glacial|peaks/i.test(name)) {
    if (/peaks/i.test(name)) return { low: [96, 87, 74], high: [181, 165, 137], surfaceGrain: 1 }
    return { low: [126, 149, 154], high: [228, 232, 222], surfaceGrain: 0.5 }
  }
  if (/tundra/i.test(name)) return { low: [108, 125, 121], high: [205, 211, 190], surfaceGrain: 0.65 }
  if (/forest/i.test(name)) return { low: [48, 69, 42], high: [108, 127, 68], surfaceGrain: 1.25 }
  if (/bog|water/i.test(name)) return { low: [54, 80, 68], high: [115, 130, 86], surfaceGrain: 0.55 }
  return { low: [100, 106, 58], high: [170, 155, 93], surfaceGrain: 0.75 }
}

export const terrainSurfaceKey = ({ terrain, scale, rotation }: TerrainSurface) => JSON.stringify([terrain, scale, rotation])

function lattice(x: number, y: number) {
  let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295
}

const mix = (a: number, b: number, weight: number) => a + (b - a) * weight
const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function terrainNoise(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const sx = smooth(x - ix)
  const sy = smooth(y - iy)
  return mix(mix(lattice(ix, iy), lattice(ix + 1, iy), sx), mix(lattice(ix, iy + 1), lattice(ix + 1, iy + 1), sx), sy)
}

const noise = terrainNoise
const yieldToRenderer = () => new Promise<void>(resolve => setTimeout(resolve, 0))

// Build a single map-space height field. Position, scale and rotation determine
// the result, so another stroke with those settings meets the same landforms.
export async function makeTerrainSurface(settings: TerrainSurface, cancelled: () => boolean): Promise<TerrainTile | undefined> {
  const width = 800
  const height = 500
  const elevation = new Float32Array(width * height)
  const { low, high, surfaceGrain } = profile(settings.terrain)
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
      // Rotate successive frequency bands to avoid rows of similarly oriented folds.
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
      // Diffuse light on the shared terrain normal avoids bright, plastic-looking crests.
      const gx = dx * 13
      const gy = dy * 13
      const diffuse = clamp((0.82 + gx * 0.4 + gy * 0.4) / Math.hypot(1, gx, gy))
      const light = 0.57 + diffuse * 0.46
      const mottling = noise(x / 4.2 + 9, y / 4.2 - 11) - 0.5
      const grain = (mottling * 14 + (lattice(x, y) - 0.5) * 7) * surfaceGrain
      const tone = smooth(clamp((elevation[i] + mottling * 0.11 - 0.17) / 0.59))
      for (let c = 0; c < 3; c++) image.data[i * 4 + c] = mix(low[c], high[c], tone) * light + grain
      image.data[i * 4 + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  return { url: canvas.toDataURL('image/jpeg', 0.9), pixels: image, elevation }
}
