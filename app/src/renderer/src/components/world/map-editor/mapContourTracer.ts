export type DraftImageStyle = 'line_sketch' | 'colored_draft' | 'reference_map'
export type DraftDetailLevel = 'standard' | 'high'

export type NormalizedPoint = { x: number; y: number }

export type ContourTraceGuidance = {
  imageStyle?: DraftImageStyle
  detail?: DraftDetailLevel
  waterSeeds?: NormalizedPoint[]
  landSeeds?: NormalizedPoint[]
  signal?: AbortSignal
  onProgress?: (stage: string, percent: number) => void
}

export type TracedLandmass = {
  points: NormalizedPoint[]
  centroid: NormalizedPoint
  areaFraction: number
  dominantBiome: string
}

export type TracedLake = {
  points: NormalizedPoint[]
  areaFraction: number
}

export type TracedBiomePatch = {
  biome: string
  center: NormalizedPoint
  radius: number
}

export type TracedRiver = {
  points: NormalizedPoint[]
  widthPreset: 'stream' | 'river' | 'wide_river'
}

export type TracedStamp = {
  kind: 'mountains' | 'forests' | 'settlements'
  stampId: string
  label: string
  point: NormalizedPoint
  size: number
}

export type ContourTraceResult = {
  imageStyle: 'line_sketch' | 'colored_draft'
  landmasses: TracedLandmass[]
  lakes: TracedLake[]
  biomePatches: TracedBiomePatch[]
  rivers: TracedRiver[]
  stamps: TracedStamp[]
  suggestedStamps: TracedStamp[]
  traceConfidence: 'high' | 'low'
}

const clamp01 = (n: number) => Math.max(0.004, Math.min(0.996, n))
const yieldFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d > 1e-5) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
    else if (max === gn) h = ((bn - rn) / d + 2) * 60
    else h = ((rn - gn) / d + 4) * 60
  }
  const s = max > 1e-5 ? d / max : 0
  return { h, s, v: max }
}

function isOceanBlue(r: number, g: number, b: number) {
  const { h, s, v } = rgbToHsv(r, g, b)
  return h >= 168 && h <= 252 && s > 0.14 && v > 0.12
}

function classifyBiome(r: number, g: number, b: number, edgeStrength = 0, medianLandV = 0.56): string {
  const { h, s, v } = rgbToHsv(r, g, b)
  const snowV = Math.max(0.76, Math.min(0.86, medianLandV + 0.18))
  const plainsMinV = Math.max(0.38, medianLandV - 0.14)

  if (v >= snowV && s <= 0.22) return 'Snow'
  if (v <= 0.25 && s <= 0.28) return 'Ashlands'
  if (h >= 24 && h <= 56 && s >= 0.28 && v >= 0.6) return 'Desert'
  if (h > 64 && h <= 162 && s > 0.16 && v < 0.46) return 'Woodland'
  if (h > 56 && h <= 155 && s > 0.14 && v >= 0.46) return 'Grassland'
  if (h > 140 && h <= 195 && s >= 0.1 && s <= 0.42 && v < 0.56) return 'Marsh'
  if ((h >= 20 && h <= 64 && v >= plainsMinV) || (s <= 0.24 && v >= plainsMinV + 0.06 && edgeStrength < 22)) return 'Plains'
  if ((v >= 0.25 && v < plainsMinV + 0.06 && s <= 0.28) || edgeStrength >= 24) return 'Highlands'
  return 'Plains'
}

// Separable O(W*H) binary dilation using a sliding window per axis
function dilateMask(src: Uint8Array, w: number, h: number, radius: number) {
  if (radius <= 0) return src.slice()
  const horiz = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let count = 0
    for (let x = 0; x <= Math.min(w - 1, radius); x++) count += src[row + x]
    for (let x = 0; x < w; x++) {
      horiz[row + x] = count > 0 ? 1 : 0
      const outX = x - radius
      if (outX >= 0) count -= src[row + outX]
      const inX = x + radius + 1
      if (inX < w) count += src[row + inX]
    }
  }
  const dst = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    let count = 0
    for (let y = 0; y <= Math.min(h - 1, radius); y++) count += horiz[y * w + x]
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = count > 0 ? 1 : 0
      const outY = y - radius
      if (outY >= 0) count -= horiz[outY * w + x]
      const inY = y + radius + 1
      if (inY < h) count += horiz[inY * w + x]
    }
  }
  return dst
}

// Separable O(W*H) erosion on inverse mask (keeps pixel only if whole (2r+1)^2 window is 1)
function erodeMask(src: Uint8Array, w: number, h: number, radius: number) {
  if (radius <= 0) return src.slice()
  const horiz = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let zeros = 0
    for (let x = -radius; x <= radius; x++) {
      zeros += x >= 0 && x < w ? (src[row + x] ? 0 : 1) : 1
    }
    for (let x = 0; x < w; x++) {
      horiz[row + x] = zeros === 0 ? 1 : 0
      const outX = x - radius
      zeros -= outX >= 0 && outX < w ? (src[row + outX] ? 0 : 1) : 1
      const inX = x + radius + 1
      zeros += inX >= 0 && inX < w ? (src[row + inX] ? 0 : 1) : 1
    }
  }
  const dst = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    let zeros = 0
    for (let y = -radius; y <= radius; y++) {
      zeros += y >= 0 && y < h ? (horiz[y * w + x] ? 0 : 1) : 1
    }
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = zeros === 0 ? 1 : 0
      const outY = y - radius
      zeros -= outY >= 0 && outY < h ? (horiz[outY * w + x] ? 0 : 1) : 1
      const inY = y + radius + 1
      zeros += inY >= 0 && inY < h ? (horiz[inY * w + x] ? 0 : 1) : 1
    }
  }
  return dst
}

function computeInlandDistance(land: Uint8Array, w: number, h: number): Int16Array {
  const total = w * h
  const dist = new Int16Array(total).fill(-1)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      const onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1
      if (!land[idx] || onEdge) {
        dist[idx] = 0
        queue[tail++] = idx
      }
    }
  }

  while (head < tail) {
    const idx = queue[head++]
    const nextD = dist[idx] + 1
    const x = idx % w
    const y = (idx - x) / w
    if (x > 0 && dist[idx - 1] === -1) { dist[idx - 1] = nextD; queue[tail++] = idx - 1 }
    if (x < w - 1 && dist[idx + 1] === -1) { dist[idx + 1] = nextD; queue[tail++] = idx + 1 }
    if (y > 0 && dist[idx - w] === -1) { dist[idx - w] = nextD; queue[tail++] = idx - w }
    if (y < h - 1 && dist[idx + w] === -1) { dist[idx + w] = nextD; queue[tail++] = idx + w }
  }

  return dist
}

// Separable O(W*H) sliding local max & min luminance range + O(W*H) Sobel + box mean
function computeSobelAndRelief(lum: Float32Array, w: number, h: number, pxScale: number) {
  const total = w * h
  const sobel = new Float32Array(total)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx =
        -lum[i - w - 1] + lum[i - w + 1] -
        2 * lum[i - 1] + 2 * lum[i + 1] -
        lum[i + w - 1] + lum[i + w + 1]
      const gy =
        -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] +
        lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1]
      sobel[i] = Math.hypot(gx, gy) / 4
    }
  }

  const stride = w + 1
  const integral = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      rowSum += sobel[y * w + x]
      integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum
    }
  }

  const localEdge = new Float32Array(total)
  const half = Math.max(4, Math.round(4 * pxScale))
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half)
    const y1 = Math.min(h - 1, y + half)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(w - 1, x + half)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      localEdge[y * w + x] =
        (integral[(y1 + 1) * stride + (x1 + 1)] -
          integral[y0 * stride + (x1 + 1)] -
          integral[(y1 + 1) * stride + x0] +
          integral[y0 * stride + x0]) / area
    }
  }

  // Separable local contrast (lumMax - lumMin) in radius rMax = max(3, round(3*pxScale))
  const rMax = Math.max(3, Math.round(3 * pxScale))
  const hMax = new Float32Array(total)
  const hMin = new Float32Array(total)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - rMax)
      const x1 = Math.min(w - 1, x + rMax)
      let mx = -Infinity
      let mn = Infinity
      for (let kx = x0; kx <= x1; kx++) {
        const v = lum[row + kx]
        if (v > mx) mx = v
        if (v < mn) mn = v
      }
      hMax[row + x] = mx
      hMin[row + x] = mn
    }
  }

  const localContrast = new Float32Array(total)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - rMax)
    const y1 = Math.min(h - 1, y + rMax)
    for (let x = 0; x < w; x++) {
      let mx = -Infinity
      let mn = Infinity
      for (let ky = y0; ky <= y1; ky++) {
        const idx = ky * w + x
        if (hMax[idx] > mx) mx = hMax[idx]
        if (hMin[idx] < mn) mn = hMin[idx]
      }
      localContrast[y * w + x] = mx - mn
    }
  }

  return { sobel, localEdge, localContrast }
}

function sampleRegionRgb(data: Uint8ClampedArray, w: number, h: number, nx: number, ny: number): [number, number, number] {
  const cx = Math.max(0, Math.min(w - 1, Math.round(nx * (w - 1))))
  const cy = Math.max(0, Math.min(h - 1, Math.round(ny * (h - 1))))
  let sr = 0
  let sg = 0
  let sb = 0
  let count = 0
  for (let dy = -2; dy <= 2; dy++) {
    const y = cy + dy
    if (y < 0 || y >= h) continue
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx
      if (x < 0 || x >= w) continue
      const idx = (y * w + x) * 4
      sr += data[idx]
      sg += data[idx + 1]
      sb += data[idx + 2]
      count++
    }
  }
  return count ? [sr / count, sg / count, sb / count] : [0, 0, 0]
}

function buildLineSketchMask(lum: Float32Array, w: number, h: number, pxScale: number, waterSeeds?: NormalizedPoint[]) {
  const total = w * h
  const stride = w + 1
  const integral = new Float64Array((w + 1) * (h + 1))
  let globalSum = 0
  for (let y = 0; y < h; y++) {
    let rowSum = 0
    for (let x = 0; x < w; x++) {
      const val = lum[y * w + x]
      globalSum += val
      rowSum += val
      integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum
    }
  }
  const globalMean = globalSum / total

  const rawBarrier = new Uint8Array(total)
  const half = Math.max(7, Math.round(7 * pxScale))
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half)
    const y1 = Math.min(h - 1, y + half)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half)
      const x1 = Math.min(w - 1, x + half)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      const sum =
        integral[(y1 + 1) * stride + (x1 + 1)] -
        integral[y0 * stride + (x1 + 1)] -
        integral[(y1 + 1) * stride + x0] +
        integral[y0 * stride + x0]
      const localMean = sum / area
      const l = lum[y * w + x]
      if (l < localMean - 15 || l < globalMean * 0.62) {
        rawBarrier[y * w + x] = 1
      }
    }
  }

  const barrier = dilateMask(rawBarrier, w, h, Math.max(1, Math.round(pxScale)))

  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  const enqueue = (idx: number) => {
    if (!visited[idx] && !barrier[idx]) {
      visited[idx] = 1
      queue[tail++] = idx
    }
  }
  for (let x = 0; x < w; x++) {
    enqueue(x)
    enqueue((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    enqueue(y * w)
    enqueue(y * w + (w - 1))
  }
  if (waterSeeds?.length) {
    for (const seed of waterSeeds) {
      const sx = Math.max(0, Math.min(w - 1, Math.round(seed.x * (w - 1))))
      const sy = Math.max(0, Math.min(h - 1, Math.round(seed.y * (h - 1))))
      enqueue(sy * w + sx)
    }
  }

  while (head < tail) {
    const idx = queue[head++]
    const x = idx % w
    const y = (idx - x) / w
    if (x > 0) enqueue(idx - 1)
    if (x < w - 1) enqueue(idx + 1)
    if (y > 0) enqueue(idx - w)
    if (y < h - 1) enqueue(idx + w)
  }

  const land = new Uint8Array(total)
  let landCount = 0
  for (let i = 0; i < total; i++) {
    if (!visited[i]) {
      land[i] = 1
      landCount++
    }
  }

  const fraction = landCount / total
  if (fraction < 0.02 || fraction > 0.92) {
    const sample: number[] = []
    for (let i = 0; i < total; i += 4) sample.push(lum[i])
    sample.sort((a, b) => a - b)
    const median = sample[Math.floor(sample.length / 2)] ?? globalMean
    land.fill(0)
    for (let i = 0; i < total; i++) {
      if (lum[i] < median - 14) land[i] = 1
    }
  }
  return land
}

function buildColoredMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  waterSeeds?: NormalizedPoint[],
  landSeeds?: NormalizedPoint[],
) {
  const total = w * h
  const aiWaterPrototypes: Array<[number, number, number]> = (waterSeeds ?? []).map(s => sampleRegionRgb(data, w, h, s.x, s.y))
  const landPrototypes: Array<[number, number, number]> = (landSeeds ?? []).map(s => sampleRegionRgb(data, w, h, s.x, s.y))

  const land = new Uint8Array(total)
  if (aiWaterPrototypes.length > 0 && landPrototypes.length > 0) {
    for (let i = 0; i < total; i++) {
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      let minW = Infinity
      for (const [wr, wg, wb] of aiWaterPrototypes) {
        const d = (r - wr) ** 2 + (g - wg) ** 2 + (b - wb) ** 2
        if (d < minW) minW = d
      }
      if (isOceanBlue(r, g, b)) minW = Math.max(0, minW - 400)
      let minL = Infinity
      for (const [lr, lg, lb] of landPrototypes) {
        const d = (r - lr) ** 2 + (g - lg) ** 2 + (b - lb) ** 2
        if (d < minL) minL = d
      }
      if (minL < minW) land[i] = 1
    }
    return land
  }

  const binCounts = new Map<number, { count: number; r: number; g: number; b: number }>()
  const addBorderSample = (x: number, y: number) => {
    const idx = (y * w + x) * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const entry = binCounts.get(key)
    if (entry) {
      entry.count++
      entry.r += r
      entry.g += g
      entry.b += b
    } else {
      binCounts.set(key, { count: 1, r, g, b })
    }
  }
  for (let x = 0; x < w; x++) {
    addBorderSample(x, 0)
    addBorderSample(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    addBorderSample(0, y)
    addBorderSample(w - 1, y)
  }
  let topBin: { count: number; r: number; g: number; b: number } | null = null
  for (const bin of binCounts.values()) {
    if (!topBin || bin.count > topBin.count) topBin = bin
  }
  const borderRgb: [number, number, number] = topBin
    ? [topBin.r / topBin.count, topBin.g / topBin.count, topBin.b / topBin.count]
    : [34, 91, 128]

  const isWater = new Uint8Array(total)
  const distSqLimit = 28 * 28
  const matchesBorder = (idx: number) => {
    const r = data[idx * 4]
    const g = data[idx * 4 + 1]
    const b = data[idx * 4 + 2]
    return (r - borderRgb[0]) ** 2 + (g - borderRgb[1]) ** 2 + (b - borderRgb[2]) ** 2 <= distSqLimit
  }

  for (let i = 0; i < total; i++) {
    if (isOceanBlue(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) {
      isWater[i] = 1
    }
  }

  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  const enqueueBg = (idx: number) => {
    if (!visited[idx] && (isWater[idx] || matchesBorder(idx))) {
      visited[idx] = 1
      isWater[idx] = 1
      queue[tail++] = idx
    }
  }
  for (let x = 0; x < w; x++) {
    enqueueBg(x)
    enqueueBg((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    enqueueBg(y * w)
    enqueueBg(y * w + (w - 1))
  }
  for (const seed of waterSeeds ?? []) {
    const sx = Math.max(0, Math.min(w - 1, Math.round(seed.x * (w - 1))))
    const sy = Math.max(0, Math.min(h - 1, Math.round(seed.y * (h - 1))))
    const idx = sy * w + sx
    if (!visited[idx]) {
      visited[idx] = 1
      isWater[idx] = 1
      queue[tail++] = idx
    }
  }

  while (head < tail) {
    const idx = queue[head++]
    const x = idx % w
    const y = (idx - x) / w
    if (x > 0) enqueueBg(idx - 1)
    if (x < w - 1) enqueueBg(idx + 1)
    if (y > 0) enqueueBg(idx - w)
    if (y < h - 1) enqueueBg(idx + w)
  }

  for (let i = 0; i < total; i++) {
    if (!isWater[i]) land[i] = 1
  }
  return land
}

function majorityFilter3x3(src: Uint8Array, w: number, h: number) {
  const dst = new Uint8Array(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ones = 0
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx >= 0 && nx < w && src[ny * w + nx]) ones++
        }
      }
      dst[y * w + x] = ones >= 5 ? 1 : 0
    }
  }
  return dst
}

type Component = {
  pixels: number[]
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function extractComponents(mask: Uint8Array, w: number, h: number, minArea: number): Component[] {
  const visited = new Uint8Array(mask.length)
  const queue = new Int32Array(mask.length)
  const components: Component[] = []

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue
    let head = 0
    let tail = 0
    visited[start] = 1
    queue[tail++] = start
    const pixels: number[] = []
    let minX = w
    let maxX = 0
    let minY = h
    let maxY = 0

    while (head < tail) {
      const idx = queue[head++]
      pixels.push(idx)
      const x = idx % w
      const y = (idx - x) / w
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      if (x > 0 && mask[idx - 1] && !visited[idx - 1]) { visited[idx - 1] = 1; queue[tail++] = idx - 1 }
      if (x < w - 1 && mask[idx + 1] && !visited[idx + 1]) { visited[idx + 1] = 1; queue[tail++] = idx + 1 }
      if (y > 0 && mask[idx - w] && !visited[idx - w]) { visited[idx - w] = 1; queue[tail++] = idx - w }
      if (y < h - 1 && mask[idx + w] && !visited[idx + w]) { visited[idx + w] = 1; queue[tail++] = idx + w }
    }

    if (pixels.length >= minArea) {
      components.push({ pixels, minX, maxX, minY, maxY })
    }
  }

  return components.sort((a, b) => b.pixels.length - a.pixels.length)
}

function perpendicularDistance(pt: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) return Math.hypot(pt.x - a.x, pt.y - a.y)
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq))
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy))
}

function douglasPeuckerOpen(pts: NormalizedPoint[], epsilon: number): NormalizedPoint[] {
  if (pts.length <= 2) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = 1
  keep[pts.length - 1] = 1
  const stack: Array<[number, number]> = [[0, pts.length - 1]]
  while (stack.length > 0) {
    const [start, end] = stack.pop()!
    let maxDist = epsilon
    let split = -1
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(pts[i], pts[start], pts[end])
      if (d > maxDist) {
        maxDist = d
        split = i
      }
    }
    if (split !== -1) {
      keep[split] = 1
      stack.push([start, split], [split, end])
    }
  }
  return pts.filter((_, idx) => keep[idx])
}

function traceOuterPolygon(comp: Component, w: number, h: number, detail: DraftDetailLevel, pxScale: number): NormalizedPoint[] {
  const bw = comp.maxX - comp.minX + 3
  const bh = comp.maxY - comp.minY + 3
  const ox = comp.minX - 1
  const oy = comp.minY - 1
  const grid = new Uint8Array(bw * bh)
  for (const idx of comp.pixels) {
    const gx = (idx % w) - ox
    const gy = ((idx - (idx % w)) / w) - oy
    grid[gy * bw + gx] = 1
  }

  type HalfEdge = { fromKey: number; toKey: number; x: number; y: number }
  const segments: HalfEdge[] = []
  const keyStride = (bw + 1) * 2
  const ptKey = (x2: number, y2: number) => y2 * keyStride + x2

  const addSeg = (ax2: number, ay2: number, bx2: number, by2: number) => {
    segments.push({ fromKey: ptKey(ax2, ay2), toKey: ptKey(bx2, by2), x: ax2 / 2, y: ay2 / 2 })
  }

  for (let cy = 0; cy < bh - 1; cy++) {
    for (let cx = 0; cx < bw - 1; cx++) {
      const tl = grid[cy * bw + cx]
      const tr = grid[cy * bw + cx + 1]
      const br = grid[(cy + 1) * bw + cx + 1]
      const bl = grid[(cy + 1) * bw + cx]
      const code = (tl << 3) | (tr << 2) | (br << 1) | bl
      if (code === 0 || code === 15) continue

      const nx = 2 * cx + 1, ny = 2 * cy
      const ex = 2 * cx + 2, ey = 2 * cy + 1
      const sx = 2 * cx + 1, sy = 2 * cy + 2
      const wx = 2 * cx, wy = 2 * cy + 1

      switch (code) {
        case 1: addSeg(wx, wy, sx, sy); break
        case 2: addSeg(sx, sy, ex, ey); break
        case 3: addSeg(wx, wy, ex, ey); break
        case 4: addSeg(ex, ey, nx, ny); break
        case 5: addSeg(wx, wy, nx, ny); addSeg(ex, ey, sx, sy); break
        case 6: addSeg(sx, sy, nx, ny); break
        case 7: addSeg(wx, wy, nx, ny); break
        case 8: addSeg(nx, ny, wx, wy); break
        case 9: addSeg(nx, ny, sx, sy); break
        case 10: addSeg(nx, ny, ex, ey); addSeg(sx, sy, wx, wy); break
        case 11: addSeg(nx, ny, ex, ey); break
        case 12: addSeg(ex, ey, wx, wy); break
        case 13: addSeg(ex, ey, sx, sy); break
        case 14: addSeg(sx, sy, wx, wy); break
      }
    }
  }

  if (segments.length === 0) return []
  const outgoing = new Map<number, number[]>()
  for (let i = 0; i < segments.length; i++) {
    const list = outgoing.get(segments[i].fromKey)
    if (list) list.push(i)
    else outgoing.set(segments[i].fromKey, [i])
  }

  const used = new Uint8Array(segments.length)
  let bestLoop: NormalizedPoint[] = []

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue
    const loop: NormalizedPoint[] = []
    const startKey = segments[i].fromKey
    let currIdx: number | undefined = i
    let steps = 0

    while (currIdx !== undefined && !used[currIdx] && steps <= segments.length + 2) {
      used[currIdx] = 1
      const seg = segments[currIdx]
      loop.push({ x: ox + seg.x, y: oy + seg.y })
      steps++
      if (seg.toKey === startKey) break
      const nextCandidates = outgoing.get(seg.toKey)
      currIdx = nextCandidates?.find(idx => !used[idx])
    }

    if (loop.length > bestLoop.length) bestLoop = loop
  }

  if (bestLoop.length < 4) return []

  // Gentle Laplacian smoothing preserves crisp headlands and bays
  const smoothed = bestLoop.map((pt, i) => {
    const prev = bestLoop[(i - 1 + bestLoop.length) % bestLoop.length]
    const next = bestLoop[(i + 1) % bestLoop.length]
    return {
      x: 0.15 * prev.x + 0.7 * pt.x + 0.15 * next.x,
      y: 0.15 * prev.y + 0.7 * pt.y + 0.15 * next.y,
    }
  })

  let farthestIdx = Math.floor(smoothed.length / 2)
  let maxDist = -1
  for (let i = 1; i < smoothed.length; i++) {
    const d = Math.hypot(smoothed[i].x - smoothed[0].x, smoothed[i].y - smoothed[0].y)
    if (d > maxDist) {
      maxDist = d
      farthestIdx = i
    }
  }

  const maxVertices = detail === 'high' ? 220 : 120
  let eps = detail === 'high' ? 0.85 * Math.max(1, pxScale * 0.55) : 1.25 * Math.max(1, pxScale * 0.65)
  let simplified: NormalizedPoint[] = []
  for (let attempt = 0; attempt < 6; attempt++) {
    const halfA = douglasPeuckerOpen(smoothed.slice(0, farthestIdx + 1), eps)
    const halfB = douglasPeuckerOpen([...smoothed.slice(farthestIdx), smoothed[0]], eps)
    simplified = [...halfA.slice(0, -1), ...halfB.slice(0, -1)]
    if (simplified.length <= maxVertices) break
    eps *= 1.4
  }

  if (simplified.length < 3) return []
  return simplified.map(pt => ({
    x: clamp01(pt.x / (w - 1)),
    y: clamp01(pt.y / (h - 1)),
  }))
}

function traceOfflineRivers(
  data: Uint8ClampedArray,
  landMask: Uint8Array,
  lakeMask: Uint8Array,
  w: number,
  h: number,
  detail: DraftDetailLevel,
  pxScale: number,
): TracedRiver[] {
  const total = w * h
  const waterMask = new Uint8Array(total)
  for (let i = 0; i < total; i++) waterMask[i] = landMask[i] ? 0 : 1

  const erodeRadius = Math.max(2, Math.round(2.4 * pxScale))
  const dilateRadius = erodeRadius + Math.max(1, Math.round(pxScale))
  const deepWater = erodeMask(waterMask, w, h, erodeRadius)
  const openOceanExpanded = dilateMask(deepWater, w, h, dilateRadius)
  const nearLand = dilateMask(landMask, w, h, Math.max(2, Math.round(2 * pxScale)))

  const riverMask = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if (!nearLand[i] || lakeMask[i] || openOceanExpanded[i]) continue
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const { h: hue, s, v } = rgbToHsv(r, g, b)
    if (hue >= 172 && hue <= 248 && s > 0.22 && v > 0.14) {
      riverMask[i] = 1
    }
  }

  const minRiverArea = Math.max(14, Math.round(14 * pxScale * pxScale))
  const comps = extractComponents(riverMask, w, h, minRiverArea)
  const member = new Uint8Array(total)
  const dist = new Int32Array(total)
  const parent = new Int32Array(total)
  const queue = new Int32Array(total)
  const rivers: TracedRiver[] = []
  const maxRivers = detail === 'high' ? 14 : 8
  const minSpan = 14 * pxScale

  const bfsLongest = (startIdx: number) => {
    dist.fill(-1)
    parent.fill(-1)
    let head = 0
    let tail = 0
    dist[startIdx] = 0
    queue[tail++] = startIdx
    let farthest = startIdx
    while (head < tail) {
      const idx = queue[head++]
      farthest = idx
      const x = idx % w
      const y = (idx - x) / w
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          const nIdx = ny * w + nx
          if (member[nIdx] && dist[nIdx] === -1) {
            dist[nIdx] = dist[idx] + 1
            parent[nIdx] = idx
            queue[tail++] = nIdx
          }
        }
      }
    }
    return farthest
  }

  for (const comp of comps) {
    if (rivers.length >= maxRivers) break
    const bw = comp.maxX - comp.minX + 1
    const bh = comp.maxY - comp.minY + 1
    if (Math.hypot(bw, bh) < minSpan || comp.pixels.length > bw * bh * 0.62) continue

    for (const p of comp.pixels) member[p] = 1
    const endA = bfsLongest(comp.pixels[0])
    const endB = bfsLongest(endA)
    const rawPts: NormalizedPoint[] = []
    let curr = endB
    while (curr !== -1) {
      const x = curr % w
      const y = (curr - x) / w
      rawPts.push({ x, y })
      curr = parent[curr]
    }
    for (const p of comp.pixels) member[p] = 0

    rawPts.reverse()
    if (rawPts.length < Math.max(4, Math.round(4 * pxScale))) continue

    const avgWidthPx = comp.pixels.length / Math.max(1, rawPts.length) / pxScale
    const widthPreset: TracedRiver['widthPreset'] =
      avgWidthPx < 2.0 ? 'stream' : avgWidthPx > 4.2 ? 'wide_river' : 'river'

    const simplified = douglasPeuckerOpen(rawPts, Math.max(1.5, 1.8 * pxScale))
    if (simplified.length >= 2) {
      rivers.push({
        points: simplified.map(pt => ({ x: clamp01(pt.x / (w - 1)), y: clamp01(pt.y / (h - 1)) })),
        widthPreset,
      })
    }
  }

  return rivers
}

function detectOfflineMountains(
  data: Uint8ClampedArray,
  inlandDist: Int16Array,
  sobel: Float32Array,
  localEdge: Float32Array,
  localContrast: Float32Array,
  detectedStyle: 'line_sketch' | 'colored_draft',
  w: number,
  h: number,
  detail: DraftDetailLevel,
  pxScale: number,
): TracedStamp[] {
  const total = w * h
  const minInland = Math.max(3, Math.round(2.8 * pxScale))
  const ridgeScore = new Float32Array(total)
  let sumScore = 0
  let count = 0

  for (let i = 0; i < total; i++) {
    if (inlandDist[i] < minInland) continue
    const score = localEdge[i] + localContrast[i] * 0.35
    ridgeScore[i] = score
    sumScore += score
    count++
  }
  if (!count) return []

  const meanScore = sumScore / count
  let varScore = 0
  for (let i = 0; i < total; i++) {
    if (inlandDist[i] < minInland) continue
    const d = ridgeScore[i] - meanScore
    varScore += d * d
  }
  const stdScore = Math.sqrt(varScore / count)
  const threshold = Math.max(18, meanScore + 0.85 * stdScore)

  const candidates = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if (inlandDist[i] < minInland) continue
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const { h: hue, s, v } = rgbToHsv(r, g, b)
    const isForestGreen = hue >= 74 && hue <= 158 && s > 0.22 && v < 0.5
    if (ridgeScore[i] > threshold && !isForestGreen) {
      candidates[i] = 1
    } else if (
      detectedStyle === 'colored_draft' &&
      localEdge[i] > 11 &&
      ((v > 0.76 && s < 0.22) || (v < 0.46 && s < 0.26 && sobel[i] > 17))
    ) {
      candidates[i] = 1
    }
  }

  const dilated = dilateMask(candidates, w, h, Math.max(2, Math.round(2 * pxScale)))
  const minCompArea = Math.max(14, Math.floor(total * (detail === 'high' ? 0.00018 : 0.00025)))
  const comps = extractComponents(dilated, w, h, minCompArea)

  const placed: TracedStamp[] = []
  const maxStamps = detail === 'high' ? 42 : 18
  const minSpacing = detail === 'high' ? 0.032 : 0.045
  const ridgeChoices = ['alpine_range', 'rocky_ridge'] as const
  const medChoices = ['mountain_cluster_01', 'misty_peak'] as const
  const smallChoices = ['foothills', 'peak_01'] as const

  for (const comp of comps) {
    if (placed.length >= maxStamps) break
    const bw = comp.maxX - comp.minX + 1
    const bh = comp.maxY - comp.minY + 1
    const normSpan = Math.hypot(bw / w, bh / h)
    const sliceCount = Math.max(1, Math.min(detail === 'high' ? 6 : 3, Math.round(normSpan / minSpacing)))
    const horizontalMajor = bw >= bh
    const majorStart = horizontalMajor ? comp.minX : comp.minY
    const majorSpan = Math.max(1, horizontalMajor ? bw : bh)

    for (let slice = 0; slice < sliceCount && placed.length < maxStamps; slice++) {
      const sliceMin = majorStart + (slice * majorSpan) / sliceCount
      const sliceMax = majorStart + ((slice + 1) * majorSpan) / sliceCount
      let sx = 0
      let sy = 0
      let cnt = 0
      let snowPixels = 0

      for (const idx of comp.pixels) {
        const px = idx % w
        const py = (idx - px) / w
        const axis = horizontalMajor ? px : py
        if (axis < sliceMin || axis > sliceMax) continue
        sx += px
        sy += py
        cnt++
        const { s, v } = rgbToHsv(data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2])
        if (v > 0.76 && s < 0.22) snowPixels++
      }

      if (cnt < Math.max(5, Math.round(5 * pxScale))) continue
      const point = { x: clamp01(sx / cnt / (w - 1)), y: clamp01(sy / cnt / (h - 1)) }
      if (placed.some(p => Math.hypot(p.point.x - point.x, p.point.y - point.y) < minSpacing)) continue

      const snowRatio = snowPixels / cnt
      const idxChoice = placed.length
      let stampId: string
      if (snowRatio > 0.26) {
        stampId = normSpan > 0.08 ? 'snow_ridge' : 'snow_peak'
      } else if (normSpan > 0.09) {
        stampId = ridgeChoices[idxChoice % ridgeChoices.length]
      } else if (normSpan > 0.045) {
        stampId = medChoices[idxChoice % medChoices.length]
      } else {
        stampId = smallChoices[idxChoice % smallChoices.length]
      }

      const size = Number(Math.max(0.48, Math.min(0.98, 0.52 + normSpan * 2.4)).toFixed(2))
      placed.push({
        kind: 'mountains',
        stampId,
        label: snowRatio > 0.26 ? 'Snowy peaks' : 'Mountain range',
        point,
        size,
      })
    }
  }

  return placed
}

function detectOfflineForests(
  data: Uint8ClampedArray,
  inlandDist: Int16Array,
  w: number,
  h: number,
  detail: DraftDetailLevel,
  pxScale: number,
): TracedStamp[] {
  const total = w * h
  const minInland = Math.max(2, Math.round(2 * pxScale))
  const mask = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if (inlandDist[i] < minInland) continue
    const { h: hue, s, v } = rgbToHsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
    if (hue >= 70 && hue <= 162 && s >= 0.17 && v >= 0.14 && v <= 0.54) {
      mask[i] = 1
    }
  }

  const dilated = dilateMask(mask, w, h, Math.max(1, Math.round(pxScale)))
  const comps = extractComponents(dilated, w, h, Math.max(18, Math.floor(total * (detail === 'high' ? 0.00022 : 0.0004))))
  const placed: TracedStamp[] = []
  const maxStamps = detail === 'high' ? 42 : 18
  const minSpacing = detail === 'high' ? 0.036 : 0.05

  for (const comp of comps) {
    if (placed.length >= maxStamps) break
    const bw = comp.maxX - comp.minX + 1
    const bh = comp.maxY - comp.minY + 1
    const normSpan = Math.hypot(bw / w, bh / h)
    const sliceCount = Math.max(1, Math.min(detail === 'high' ? 5 : 2, Math.round(normSpan / minSpacing)))
    const horizontalMajor = bw >= bh
    const majorStart = horizontalMajor ? comp.minX : comp.minY
    const majorSpan = Math.max(1, horizontalMajor ? bw : bh)

    for (let slice = 0; slice < sliceCount && placed.length < maxStamps; slice++) {
      const sliceMin = majorStart + (slice * majorSpan) / sliceCount
      const sliceMax = majorStart + ((slice + 1) * majorSpan) / sliceCount
      let sx = 0
      let sy = 0
      let sumH = 0
      let sumV = 0
      let n = 0
      for (const idx of comp.pixels) {
        const x = idx % w
        const y = (idx - x) / w
        const axis = horizontalMajor ? x : y
        if (axis < sliceMin || axis > sliceMax) continue
        sx += x
        sy += y
        const { h: hue, v } = rgbToHsv(data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2])
        sumH += hue
        sumV += v
        n++
      }
      if (n < Math.max(8, Math.round(8 * pxScale))) continue

      const point = { x: clamp01(sx / n / (w - 1)), y: clamp01(sy / n / (h - 1)) }
      if (placed.some(p => Math.hypot(p.point.x - point.x, p.point.y - point.y) < minSpacing)) continue

      const avgH = sumH / n
      const avgV = sumV / n

      let stampId = 'dense_forest'
      if (point.y < 0.28 || avgH > 125) stampId = 'pine_grove'
      else if (avgV < 0.34) stampId = 'dense_forest'
      else if (normSpan > 0.08) stampId = placed.length % 2 === 0 ? 'mixed_forest' : 'woodland'
      else stampId = placed.length % 2 === 0 ? 'oak_grove' : 'ancient_oak'

      const size = Number(Math.max(0.46, Math.min(0.92, 0.48 + normSpan * 2.2)).toFixed(2))
      placed.push({ kind: 'forests', stampId, label: 'Forest', point, size })
    }
  }

  return placed
}

function detectOfflineSettlements(
  data: Uint8ClampedArray,
  inlandDist: Int16Array,
  w: number,
  h: number,
  detail: DraftDetailLevel,
  pxScale: number,
): TracedStamp[] {
  const total = w * h
  const mask = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if (inlandDist[i] < 1) continue
    const { h: hue, s, v } = rgbToHsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
    if ((hue <= 16 || hue >= 340) && s >= 0.55 && v >= 0.35) {
      mask[i] = 1
    }
  }

  const minMarker = Math.max(4, Math.round(4 * pxScale * pxScale))
  const maxMarker = Math.max(48, Math.floor(total * 0.0012))
  const comps = extractComponents(mask, w, h, minMarker)
  const placed: TracedStamp[] = []
  const maxStamps = detail === 'high' ? 24 : 12

  for (const comp of comps) {
    if (placed.length >= maxStamps) break
    if (comp.pixels.length > maxMarker) continue
    const bw = Math.max(1, comp.maxX - comp.minX + 1)
    const bh = Math.max(1, comp.maxY - comp.minY + 1)
    if (Math.max(bw / bh, bh / bw) >= 2.5) continue

    let sx = 0
    let sy = 0
    let sumInland = 0
    for (const idx of comp.pixels) {
      const x = idx % w
      const y = (idx - x) / w
      sx += x
      sy += y
      sumInland += inlandDist[idx]
    }
    const n = comp.pixels.length
    const point = { x: clamp01(sx / n / (w - 1)), y: clamp01(sy / n / (h - 1)) }
    if (placed.some(p => Math.hypot(p.point.x - point.x, p.point.y - point.y) < 0.036)) continue

    const avgInland = sumInland / n / pxScale
    const stampId = avgInland <= 5
      ? 'coastal_castle'
      : n >= 18 * pxScale * pxScale
        ? 'walled_town'
        : placed.length % 2 === 0 ? 'town_01' : 'village'

    placed.push({
      kind: 'settlements',
      stampId,
      label: stampId === 'coastal_castle' ? 'Coastal keep' : stampId === 'walled_town' ? 'City' : 'Town',
      point,
      size: stampId === 'walled_town' ? 0.85 : 0.72,
    })
  }

  return placed
}

function buildNaturalStampSuggestions(
  data: Uint8ClampedArray,
  inlandDist: Int16Array,
  localEdge: Float32Array,
  medianLandV: number,
  w: number,
  h: number,
  pxScale: number,
  landComponents: Component[],
  existingStamps: TracedStamp[],
): TracedStamp[] {
  const total = w * h
  const suggestions: TracedStamp[] = []
  let mountainCount = 0
  let forestCount = 0
  const mtnChoices = ['alpine_range', 'rocky_ridge', 'foothills'] as const
  const forestChoices = ['dense_forest', 'mixed_forest', 'woodland'] as const

  const tooClose = (pt: NormalizedPoint, minD: number) =>
    existingStamps.some(s => Math.hypot(s.point.x - pt.x, s.point.y - pt.y) < minD) ||
    suggestions.some(s => Math.hypot(s.point.x - pt.x, s.point.y - pt.y) < minD)

  for (const comp of landComponents.slice(0, 10)) {
    const areaFrac = comp.pixels.length / total
    if (areaFrac < 0.01) continue

    let maxLandDist = 0
    for (const idx of comp.pixels) {
      if (inlandDist[idx] > maxLandDist) maxLandDist = inlandDist[idx]
    }
    const minSpine = Math.max(5 * pxScale, maxLandDist * 0.6)
    if (maxLandDist < minSpine) continue

    const spineCandidates: number[] = []
    const forestCandidates: number[] = []
    const sampleStep = Math.max(2, Math.round(3 * pxScale))

    for (let k = 0; k < comp.pixels.length; k += sampleStep) {
      const idx = comp.pixels[k]
      const d = inlandDist[idx]
      if (d >= minSpine) spineCandidates.push(idx)
      else if (d >= 3 * pxScale && d < minSpine) forestCandidates.push(idx)
    }

    spineCandidates.sort((a, b) => inlandDist[b] - inlandDist[a])
    let addedMtn = 0
    const targetMtn = areaFrac > 0.07 ? 4 : areaFrac > 0.03 ? 3 : 2
    for (const idx of spineCandidates) {
      if (mountainCount >= 20 || addedMtn >= targetMtn) break
      const px = idx % w
      const py = (idx - px) / w
      const pt = { x: clamp01(px / (w - 1)), y: clamp01(py / (h - 1)) }
      if (tooClose(pt, 0.055)) continue
      const polar = pt.y < 0.22 || pt.y > 0.8
      const stampId = polar ? 'snow_ridge' : mtnChoices[mountainCount % mtnChoices.length]
      suggestions.push({
        kind: 'mountains',
        stampId,
        label: polar ? 'Snowy ridge' : 'Mountain range',
        point: pt,
        size: 0.78,
      })
      mountainCount++
      addedMtn++
    }

    let addedForest = 0
    const targetForest = areaFrac > 0.07 ? 4 : 2
    const stride = Math.max(1, Math.floor(forestCandidates.length / 80))
    for (let k = 0; k < forestCandidates.length; k += stride) {
      if (forestCount >= 20 || addedForest >= targetForest) break
      const idx = forestCandidates[k]
      const r = data[idx * 4]
      const g = data[idx * 4 + 1]
      const b = data[idx * 4 + 2]
      const biome = classifyBiome(r, g, b, localEdge[idx], medianLandV)
      if (biome === 'Desert' || biome === 'Ashlands' || biome === 'Snow') continue
      const px = idx % w
      const py = (idx - px) / w
      const pt = { x: clamp01(px / (w - 1)), y: clamp01(py / (h - 1)) }
      if (tooClose(pt, 0.058)) continue
      const stampId = pt.y < 0.26 ? 'pine_grove' : forestChoices[forestCount % forestChoices.length]
      suggestions.push({
        kind: 'forests',
        stampId,
        label: pt.y < 0.26 ? 'Pine grove' : 'Woodland',
        point: pt,
        size: 0.74,
      })
      forestCount++
      addedForest++
    }
  }

  return suggestions
}

function sampleBiomePatches(
  data: Uint8ClampedArray,
  landMask: Uint8Array,
  localEdge: Float32Array,
  medianLandV: number,
  w: number,
  h: number,
  landmasses: TracedLandmass[],
  detail: DraftDetailLevel,
): TracedBiomePatch[] {
  const cols = detail === 'high' ? 28 : 16
  const rows = detail === 'high' ? 16 : 10
  const cellBiomes = new Array<string>(cols * rows).fill('')
  const fallbackDominant = landmasses[0]?.dominantBiome || 'Plains'

  for (let r = 0; r < rows; r++) {
    const yStart = Math.floor(r * h / rows)
    const yEnd = Math.floor((r + 1) * h / rows)
    for (let c = 0; c < cols; c++) {
      const xStart = Math.floor(c * w / cols)
      const xEnd = Math.floor((c + 1) * w / cols)
      const counts = new Map<string, number>()
      let landCount = 0
      const stepY = detail === 'high' ? 1 : 1
      for (let y = yStart; y < yEnd; y += stepY) {
        for (let x = xStart; x < xEnd; x++) {
          const i = y * w + x
          if (!landMask[i]) continue
          landCount++
          const biome = classifyBiome(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], localEdge[i], medianLandV)
          counts.set(biome, (counts.get(biome) ?? 0) + 1)
        }
      }
      if (landCount < 8) continue
      const cx = (c + 0.5) / cols
      const cy = (r + 0.5) / rows
      let nearestBase = fallbackDominant
      let bestDist = Infinity
      for (const lm of landmasses) {
        const d = Math.hypot(lm.centroid.x - cx, lm.centroid.y - cy)
        if (d < bestDist) {
          bestDist = d
          nearestBase = lm.dominantBiome
        }
      }
      let topBiome = ''
      let topCount = 0
      for (const [b, cnt] of counts) {
        if (cnt > topCount) {
          topCount = cnt
          topBiome = b
        }
      }
      if (topBiome && topBiome !== nearestBase && topCount / landCount >= 0.4) {
        cellBiomes[r * cols + c] = topBiome
      }
    }
  }

  const visited = new Uint8Array(cols * rows)
  const patches: TracedBiomePatch[] = []
  const maxPatches = detail === 'high' ? 32 : 18

  for (let i = 0; i < cols * rows && patches.length < maxPatches; i++) {
    const targetBiome = cellBiomes[i]
    if (!targetBiome || visited[i]) continue
    const queue = [i]
    visited[i] = 1
    const cells: Array<{ c: number; r: number }> = []
    let minC = cols, maxC = 0, minR = rows, maxR = 0

    while (queue.length > 0) {
      const curr = queue.pop()!
      const c = curr % cols
      const r = (curr - c) / cols
      cells.push({ c, r })
      if (c < minC) minC = c
      if (c > maxC) maxC = c
      if (r < minR) minR = r
      if (r > maxR) maxR = r
      const neighbors = [
        c > 0 ? curr - 1 : -1,
        c < cols - 1 ? curr + 1 : -1,
        r > 0 ? curr - cols : -1,
        r < rows - 1 ? curr + cols : -1,
      ]
      for (const n of neighbors) {
        if (n >= 0 && !visited[n] && cellBiomes[n] === targetBiome) {
          visited[n] = 1
          queue.push(n)
        }
      }
    }

    // Subdivide oversized/elongated biome belts into 2-3 overlapping localized patches
    if (cells.length > 10) {
      const spanC = maxC - minC + 1
      const spanR = maxR - minR + 1
      const horizontal = spanC >= spanR
      const sliceCount = Math.min(3, Math.ceil(cells.length / 8))
      const axisStart = horizontal ? minC : minR
      const axisSpan = Math.max(1, horizontal ? spanC : spanR)
      for (let s = 0; s < sliceCount && patches.length < maxPatches; s++) {
        const sMin = axisStart + (s * axisSpan) / sliceCount
        const sMax = axisStart + ((s + 1) * axisSpan) / sliceCount
        let sx = 0, sy = 0, cnt = 0
        for (const cell of cells) {
          const axis = horizontal ? cell.c : cell.r
          if (axis < sMin || axis > sMax) continue
          sx += (cell.c + 0.5) / cols
          sy += (cell.r + 0.5) / rows
          cnt++
        }
        if (!cnt) continue
        const areaFrac = cnt / (cols * rows)
        patches.push({
          biome: targetBiome,
          center: { x: clamp01(sx / cnt), y: clamp01(sy / cnt) },
          radius: Math.max(0.028, Math.min(0.11, Math.sqrt(areaFrac / Math.PI) * 1.15)),
        })
      }
    } else {
      let sx = 0, sy = 0
      for (const cell of cells) {
        sx += (cell.c + 0.5) / cols
        sy += (cell.r + 0.5) / rows
      }
      const areaFrac = cells.length / (cols * rows)
      patches.push({
        biome: targetBiome,
        center: { x: clamp01(sx / cells.length), y: clamp01(sy / cells.length) },
        radius: Math.max(0.028, Math.min(0.12, Math.sqrt(areaFrac / Math.PI) * 1.15)),
      })
    }
  }

  return patches.slice(0, maxPatches)
}

export async function traceDraftContours(
  source: HTMLImageElement | ImageBitmap,
  guidance?: ContourTraceGuidance,
): Promise<ContourTraceResult> {
  const detail: DraftDetailLevel = guidance?.detail ?? 'high'
  const signal = guidance?.signal
  const onProgress = guidance?.onProgress
  const maxSide = detail === 'high' ? 960 : 420

  const srcW = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height
  const scale = Math.min(1, maxSide / Math.max(srcW || maxSide, srcH || maxSide))
  const gridW = Math.max(64, Math.round((srcW || maxSide) * scale))
  const gridH = Math.max(64, Math.round((srcH || maxSide / 2) * scale))
  const pxScale = gridW / 340

  onProgress?.(detail === 'high' ? `Sampling pixels at ${gridW}×${gridH}…` : 'Sampling draft pixels…', 20)
  await yieldFrame()
  signal?.throwIfAborted()

  const canvas = document.createElement('canvas')
  canvas.width = gridW
  canvas.height = gridH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return {
      imageStyle: 'line_sketch',
      landmasses: [],
      lakes: [],
      biomePatches: [],
      rivers: [],
      stamps: [],
      suggestedStamps: [],
      traceConfidence: 'low',
    }
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, gridW, gridH)
  ctx.drawImage(source, 0, 0, gridW, gridH)

  const { data } = ctx.getImageData(0, 0, gridW, gridH)
  const total = gridW * gridH
  const lum = new Float32Array(total)
  let colorfulPixels = 0

  for (let i = 0; i < total; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b
    const { s, v } = rgbToHsv(r, g, b)
    if (s > 0.22 && v > 0.12) colorfulPixels++
  }

  const detectedStyle: 'line_sketch' | 'colored_draft' =
    guidance?.imageStyle === 'line_sketch'
      ? 'line_sketch'
      : guidance?.imageStyle === 'colored_draft' || guidance?.imageStyle === 'reference_map'
        ? 'colored_draft'
        : colorfulPixels / total < 0.12
          ? 'line_sketch'
          : 'colored_draft'

  onProgress?.('Segmenting oceans & landmasses…', 35)
  await yieldFrame()
  signal?.throwIfAborted()

  const rawLand = detectedStyle === 'line_sketch'
    ? buildLineSketchMask(lum, gridW, gridH, pxScale, guidance?.waterSeeds)
    : buildColoredMask(data, gridW, gridH, guidance?.waterSeeds, guidance?.landSeeds)

  const land = majorityFilter3x3(rawLand, gridW, gridH)
  const inlandDist = computeInlandDistance(land, gridW, gridH)

  onProgress?.('Analyzing mountain ridges & elevation texture…', 50)
  await yieldFrame()
  signal?.throwIfAborted()

  const { sobel, localEdge, localContrast } = computeSobelAndRelief(lum, gridW, gridH, pxScale)

  let landPixels = 0
  const landVSample: number[] = []
  for (let i = 0; i < total; i++) {
    if (land[i]) {
      landPixels++
      if (i % 4 === 0 && detectedStyle === 'colored_draft') {
        landVSample.push(rgbToHsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]).v)
      }
    }
  }
  const landAreaFraction = landPixels / total
  landVSample.sort((a, b) => a - b)
  const medianLandV = landVSample.length ? landVSample[Math.floor(landVSample.length / 2)] : 0.56

  onProgress?.('Tracing high-detail coastlines & islands…', 64)
  await yieldFrame()
  signal?.throwIfAborted()

  const minLandArea = Math.ceil(total * (detail === 'high' ? 0.00045 : 0.0014))
  const maxLandCount = detail === 'high' ? 32 : 18
  const landComponents = extractComponents(land, gridW, gridH, minLandArea).slice(0, maxLandCount)
  const landmasses: TracedLandmass[] = []

  for (const comp of landComponents) {
    const points = traceOuterPolygon(comp, gridW, gridH, detail, pxScale)
    if (points.length < 3) continue
    let sx = 0
    let sy = 0
    const biomeCounts = new Map<string, number>()
    const stride = comp.pixels.length > 10000 ? 2 : 1
    for (let k = 0; k < comp.pixels.length; k += stride) {
      const idx = comp.pixels[k]
      const x = idx % gridW
      const y = (idx - x) / gridW
      sx += x
      sy += y
      if (detectedStyle === 'colored_draft') {
        const b = classifyBiome(data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2], localEdge[idx], medianLandV)
        biomeCounts.set(b, (biomeCounts.get(b) ?? 0) + 1)
      }
    }
    const sampled = Math.ceil(comp.pixels.length / stride)
    let dominantBiome = 'Grassland'
    if (detectedStyle === 'colored_draft') {
      let best = 0
      for (const [b, cnt] of biomeCounts) {
        if (cnt > best) {
          best = cnt
          dominantBiome = b
        }
      }
    }
    landmasses.push({
      points,
      centroid: {
        x: clamp01(sx / sampled / (gridW - 1)),
        y: clamp01(sy / sampled / (gridH - 1)),
      },
      areaFraction: comp.pixels.length / total,
      dominantBiome,
    })
  }

  onProgress?.('Detecting inland lakes & rivers…', 76)
  await yieldFrame()
  signal?.throwIfAborted()

  const outerWater = new Uint8Array(total)
  const waterQueue = new Int32Array(total)
  let head = 0
  let tail = 0
  const visitWater = (idx: number) => {
    if (!outerWater[idx] && !land[idx]) {
      outerWater[idx] = 1
      waterQueue[tail++] = idx
    }
  }
  for (let x = 0; x < gridW; x++) {
    visitWater(x)
    visitWater((gridH - 1) * gridW + x)
  }
  for (let y = 0; y < gridH; y++) {
    visitWater(y * gridW)
    visitWater(y * gridW + (gridW - 1))
  }
  while (head < tail) {
    const idx = waterQueue[head++]
    const x = idx % gridW
    const y = (idx - x) / gridW
    if (x > 0) visitWater(idx - 1)
    if (x < gridW - 1) visitWater(idx + 1)
    if (y > 0) visitWater(idx - gridW)
    if (y < gridH - 1) visitWater(idx + gridW)
  }

  const inlandWater = new Uint8Array(total)
  for (let i = 0; i < total; i++) {
    if (!land[i] && !outerWater[i]) inlandWater[i] = 1
  }
  const minLakeArea = Math.ceil(total * (detail === 'high' ? 0.0005 : 0.0015))
  const lakeComps = extractComponents(inlandWater, gridW, gridH, minLakeArea).slice(0, detail === 'high' ? 16 : 10)
  const lakeMask = new Uint8Array(total)
  const lakes: TracedLake[] = []
  for (const comp of lakeComps) {
    for (const p of comp.pixels) lakeMask[p] = 1
    const points = traceOuterPolygon(comp, gridW, gridH, detail, pxScale)
    if (points.length >= 3) {
      lakes.push({ points, areaFraction: comp.pixels.length / total })
    }
  }

  const biomePatches = detectedStyle === 'colored_draft'
    ? sampleBiomePatches(data, land, localEdge, medianLandV, gridW, gridH, landmasses, detail)
    : []
  const rivers = detectedStyle === 'colored_draft'
    ? traceOfflineRivers(data, land, lakeMask, gridW, gridH, detail, pxScale)
    : []

  onProgress?.('Placing mountain, forest & settlement stamps…', 88)
  await yieldFrame()
  signal?.throwIfAborted()

  const mountains = detectOfflineMountains(
    data,
    inlandDist,
    sobel,
    localEdge,
    localContrast,
    detectedStyle,
    gridW,
    gridH,
    detail,
    pxScale,
  )
  const forests = detectedStyle === 'colored_draft'
    ? detectOfflineForests(data, inlandDist, gridW, gridH, detail, pxScale)
    : []
  const settlements = detectedStyle === 'colored_draft'
    ? detectOfflineSettlements(data, inlandDist, gridW, gridH, detail, pxScale)
    : []
  const stamps = [...mountains, ...forests, ...settlements]
  const suggestedStamps = buildNaturalStampSuggestions(
    data,
    inlandDist,
    localEdge,
    medianLandV,
    gridW,
    gridH,
    pxScale,
    landComponents,
    stamps,
  )

  onProgress?.('Finalizing geometry…', 96)

  const traceConfidence: 'high' | 'low' =
    landmasses.length >= 1 && landAreaFraction >= 0.025 && landAreaFraction <= 0.91
      ? 'high'
      : 'low'

  return {
    imageStyle: detectedStyle,
    landmasses,
    lakes,
    biomePatches,
    rivers,
    stamps,
    suggestedStamps,
    traceConfidence,
  }
}
