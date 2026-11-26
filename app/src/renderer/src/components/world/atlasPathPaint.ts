import { atlasHeight, atlasWidth, clamp, isAtlasPath, lerp, pathSettings, smoothStep, spline } from './atlasPaths'
import type { AtlasPathFeature, AtlasPathSettings, AtlasPathTool, AtlasTerrain, PathSample, WorldPoint } from './atlasPaths'

const urls = import.meta.glob('../../../../../../assets/maps/map-assets/map-assets/{roads,rivers}/*.png', {
  eager: true, import: 'default', query: '?url',
}) as Record<string, string>
type Texture = ImageData
export type Textures = Record<string, Texture>
type TerrainAt = (point: WorldPoint) => AtlasTerrain
type Color = readonly [number, number, number]
type Style = { body: Color; edge: Color; width: number }
const styles: Record<Exclude<AtlasTerrain, 'water'>, Style> = {
  dirt: { body: [194, 146, 88], edge: [112, 111, 55], width: 1 },
  forest_trail: { body: [134, 100, 63], edge: [74, 88, 48], width: .72 },
  gravel: { body: [158, 140, 113], edge: [105, 96, 72], width: .94 },
  stone: { body: [150, 147, 139], edge: [94, 91, 84], width: .83 },
  sand: { body: [205, 168, 107], edge: [185, 151, 94], width: .95 },
  snow: { body: [202, 216, 220], edge: [153, 173, 180], width: .95 },
  mud: { body: [112, 83, 58], edge: [83, 82, 50], width: .83 },
  cobblestone: { body: [159, 144, 121], edge: [97, 83, 66], width: 1.08 },
}
const water: Color = [52, 122, 151]
type PreparedPath = { tool: AtlasPathTool; samples: PathSample[]; settings: AtlasPathSettings }
type Segment = { a: PathSample; b: PathSample; dx: number; dy: number; length: number; x: number; y: number; right: number; bottom: number }
const wrap = (n: number, size: number) => ((n % size) + size) % size

let texturePromise: Promise<Textures> | undefined
export function loadPathTextures() {
  texturePromise ??= Promise.all(Object.entries(urls).map(async ([path, url]) => {
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(img, 0, 0)
      return [path.split('/').pop()!.replace('.png', ''), context.getImageData(0, 0, canvas.width, canvas.height)] as const
    } catch (error) {
      console.warn('Could not load a bundled map path texture', path, error)
      return null
    }
  })).then(entries => Object.fromEntries(entries.filter(entry => entry !== null)))
  return texturePromise
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function segments(samples: PathSample[], padding = 0): Segment[] {
  return samples.slice(1).flatMap((b, i) => {
    const a = samples[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    return length < .001 ? [] : [{
      a, b, dx, dy, length,
      x: Math.floor(Math.min(a.x, b.x) - padding), y: Math.floor(Math.min(a.y, b.y) - padding),
      right: Math.ceil(Math.max(a.x, b.x) + padding), bottom: Math.ceil(Math.max(a.y, b.y) + padding),
    }]
  })
}

function trace(context: CanvasRenderingContext2D, samples: WorldPoint[], close = false) {
  context.beginPath()
  context.moveTo(samples[0].x, samples[0].y)
  for (const { x, y } of samples.slice(1)) context.lineTo(x, y)
  if (close) context.closePath()
}

function drawBorder(context: CanvasRenderingContext2D, { samples, settings }: PreparedPath) {
  const { color, width, opacity, spacing, border, fill, closed } = settings
  context.save()
  trace(context, samples, closed || fill)
  if (fill) {
    context.fillStyle = color
    context.globalAlpha = opacity * .17
    context.fill()
  }
  context.globalAlpha = opacity
  context.strokeStyle = color
  context.fillStyle = color
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = width
  switch (border) {
    case 'double':
      for (const sign of [-1, 1]) {
        const lastIndex = samples.length - 1
        const offset = samples.map((point, i) => {
          const before = samples[i === 0 && (closed || fill) ? lastIndex - 1 : Math.max(i - 1, 0)]
          const after = samples[i === lastIndex && (closed || fill) ? 1 : Math.min(i + 1, lastIndex)]
          const dx = after.x - before.x
          const dy = after.y - before.y
          const length = Math.hypot(dx, dy) || 1
          return { x: point.x - dy / length * width * sign, y: point.y + dx / length * width * sign }
        })
        trace(context, offset, closed || fill)
        context.stroke()
      }
      break
    case 'dashed':
    case 'dotted':
      context.setLineDash(border === 'dotted' ? [.1, spacing + width] : [spacing * 1.2, spacing])
      context.stroke()
      break
    case 'decorative': {
      context.stroke()
      let next = spacing * 2
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1]
        const b = samples[i]
        while (next <= b.at && b.at > a.at) {
          const t = (next - a.at) / (b.at - a.at)
          const x = lerp(a.x, b.x, t)
          const y = lerp(a.y, b.y, t)
          const r = width * 1.5
          context.save()
          context.translate(x, y)
          context.rotate(Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 4)
          context.fillRect(-r, -r, 2 * r, 2 * r)
          context.fillStyle = '#ddbf87'
          context.fillRect(-r * .42, -r * .42, r * .84, r * .84)
          context.restore()
          next += Math.max(width * 4, spacing * 2)
        }
      }
      break
    }
    default:
      context.stroke()
  }
  context.restore()
}

function ribbonField(samples: PathSample[], radius: number) {
  const parts = segments(samples, radius)
  const left = clamp(Math.min(...parts.map(part => part.x)), 0, atlasWidth)
  const top = clamp(Math.min(...parts.map(part => part.y)), 0, atlasHeight)
  const width = clamp(Math.max(...parts.map(part => part.right)), 0, atlasWidth) - left
  const height = clamp(Math.max(...parts.map(part => part.bottom)), 0, atlasHeight) - top
  if (!width || !height) return
  const offset = new Float32Array(width * height).fill(Infinity)
  const arc = new Float32Array(width * height)
  const side = new Int8Array(width * height)
  for (const { a, b, dx, dy, length, x, y, right, bottom } of parts) {
    const inverse = 1 / (length * length)
    const lastX = Math.min(left + width, right)
    const lastY = Math.min(top + height, bottom)
    for (let row = Math.max(top, y); row < lastY; row++) {
      let index = (row - top) * width + Math.max(0, x - left)
      for (let column = Math.max(left, x); column < lastX; column++, index++) {
        const px = column + .5 - a.x
        const py = row + .5 - a.y
        const t = clamp((px * dx + py * dy) * inverse)
        const xx = px - dx * t
        const yy = py - dy * t
        const squared = xx * xx + yy * yy
        if (squared >= offset[index] || squared >= radius * radius) continue
        offset[index] = squared
        arc[index] = lerp(a.at, b.at, t)
        side[index] = dx * yy - dy * xx < 0 ? -1 : 1
      }
    }
  }
  return { left, top, width, height, offset, arc, side }
}

// The supplied artwork has a painted core and a wider margin. Sample the core
// in arc-length coordinates and color the outer edge from the underlying terrain.
function textureColor(texture: Texture | undefined, distance: number, side: number, repeat: number, channel: number) {
  if (!texture) return 125
  const x = wrap(distance, repeat) * texture.width / repeat
  const column = Math.floor(x)
  const line = Math.round(clamp(.5 + side * .235) * (texture.height - 1))
  const pixel = (line * texture.width + column) * 4 + channel
  const next = (line * texture.width + (column + 1) % texture.width) * 4 + channel
  return lerp(texture.data[pixel], texture.data[next], x - column)
}

function terrainSamples(samples: PathSample[], terrainAt: TerrainAt, step: number) {
  const result: AtlasTerrain[] = []
  const length = samples[samples.length - 1].at
  let index = 1
  for (let at = 0; at < length + step; at += step) {
    while (index < samples.length - 1 && samples[index].at < at) index++
    const a = samples[index - 1]
    const b = samples[index]
    const t = clamp((at - a.at) / (b.at - a.at || 1))
    result.push(terrainAt({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }))
  }
  return result
}

function paintRibbon(path: PreparedPath, textures: Textures, terrainAt: TerrainAt) {
  const { tool, settings, samples } = path
  const river = tool === 'River'
  const trade = !river && settings.terrainMode === 'manual' && settings.texture === 'trade_route'
  const maxWidth = river ? Math.max(settings.width, settings.mouthWidth) : settings.width
  const field = ribbonField(samples, maxWidth * .72 + 3)
  if (!field) return
  const { left, top, width, height, offset, arc, side } = field
  const layers = makeCanvas(width, height)
  const context = layers.getContext('2d')!
  const body = context.createImageData(width, height)
  const bank = context.createImageData(width, height)
  const step = Math.round(clamp(maxWidth * .7, 9, 25))
  const terrain = river || settings.terrainMode === 'auto' ? terrainSamples(samples, terrainAt, step) : []
  const fromWater = terrain[0] === 'water'
  const toWater = terrain[terrain.length - 1] === 'water'
  const length = samples[samples.length - 1].at
  const repeat = river ? 128 : 112
  const dashPeriod = Math.max(15, settings.width * 2.6)
  const tint = settings.texture === 'trade_route' ? [102, 55, 32] : null
  for (let i = 0; i < offset.length; i++) {
    if (!Number.isFinite(offset[i])) continue
    const at = arc[i]
    const sample = Math.floor(at / step)
    const blend = smoothStep(at / step - sample)
    const a = terrain[sample] ?? 'dirt'
    const b = terrain[sample + 1] ?? a
    const leftMaterial = river || settings.terrainMode === 'auto' ? (a === 'water' ? 'dirt' : a) : (trade ? 'dirt' : settings.texture as keyof typeof styles)
    const rightMaterial = river || settings.terrainMode === 'auto' ? (b === 'water' ? 'dirt' : b) : leftMaterial
    const styleA = styles[leftMaterial]
    const styleB = styles[rightMaterial]
    const radius = .5 * (river ? lerp(settings.width, settings.mouthWidth, at / length) : settings.width * lerp(styleA.width, styleB.width, blend))
    const signedDistance = Math.sqrt(offset[i]) * side[i]
    const x = left + i % width
    const y = top + Math.floor(i / width)
    const grain = Math.sin(x * 1.3 + y * 2.1) * Math.cos(y * 1.7 - x * .53)
    const edge = (Math.sin(at * .19 + side[i] * 2) + Math.sin(at * .61) * .5) * Math.min(radius * .12, 1.5) + grain * .32
    const ratio = signedDistance / Math.max(1, radius)
    const feather = leftMaterial === 'sand' || rightMaterial === 'sand' ? 2.4 : 1.2
    const core = smoothStep((radius + edge - Math.abs(signedDistance) + feather) / (2 * feather))
    const margin = smoothStep((radius * 1.27 + edge - Math.abs(signedDistance) + 1.6) / 3.2)
    const outlet = river ? Math.min(fromWater ? smoothStep(at / (radius * 3)) : 1,
      toWater ? smoothStep((length - at) / (radius * 3)) : 1) : 1
    const bankFade = river ? 1 - lerp(a === 'water' ? 1 : 0, b === 'water' ? 1 : 0, blend) : 1
    const dashEnd = trade ? Math.max(0, Math.abs(wrap(at + dashPeriod / 2, dashPeriod) - dashPeriod / 2) - dashPeriod * .18) : 0
    const dash = trade ? smoothStep((Math.max(1, radius * .64) - Math.hypot(dashEnd, signedDistance) + 1) / 2) : 1
    const pixel = i * 4
    const texA = textures[river ? settings.river : leftMaterial]
    const texB = textures[river ? settings.river : rightMaterial]
    const repeatA = !river && leftMaterial === 'cobblestone' ? 72 : repeat
    const repeatB = !river && rightMaterial === 'cobblestone' ? 72 : repeat
    const bodyAlpha = core * dash * outlet
    const bankAlpha = margin * bankFade * (trade ? .16 : river ? .88 : .57)
    if (bodyAlpha <= 0 && bankAlpha <= 0) continue
    const wave = river ? Math.sin(ratio * 20 + Math.sin(at * .11) * .65 + at * .01) : 0
    const glint = river ? Math.max(0, wave - .55) * Math.max(0, Math.sin(at * .09 + ratio * 8)) * 74 : 0
    const current = river ? -10 + smoothStep(Math.abs(ratio)) * 17 + glint : 10 - Math.abs(ratio) * 21
    for (let channel = 0; channel < 3; channel++) {
      const base = river ? water[channel] : tint?.[channel] ?? lerp(styleA.body[channel], styleB.body[channel], blend)
      const textureA = textureColor(texA, at, ratio, repeatA, channel)
      const textureB = texA === texB ? textureA : textureColor(texB, at, ratio, repeatB, channel)
      const color = lerp(textureA, textureB, blend)
      body.data[pixel + channel] = trade ? base + grain * 8 : lerp(base, color, river ? .5 : .42) + grain * 7 + current
      bank.data[pixel + channel] = lerp(styleA.edge[channel], styleB.edge[channel], blend) + 10 + grain * 18
    }
    body.data[pixel + 3] = 255 * bodyAlpha * settings.opacity
    bank.data[pixel + 3] = 255 * bankAlpha * settings.opacity
  }
  const banks = makeCanvas(width, height)
  banks.getContext('2d')!.putImageData(bank, 0, 0)
  context.putImageData(body, 0, 0)
  return { body: layers, banks, left, top }
}

function bridgeCrossings(roads: PreparedPath[], rivers: PreparedPath[], terrainAt: TerrainAt) {
  const cell = 48
  const buckets = new Map<string, { segment: Segment; river: PreparedPath }[]>()
  for (const river of rivers) {
    for (const segment of segments(river.samples)) {
      for (let y = Math.floor(segment.y / cell); y <= Math.floor(segment.bottom / cell); y++) {
        for (let x = Math.floor(segment.x / cell); x <= Math.floor(segment.right / cell); x++) {
          const key = x + ':' + y
          const bucket = buckets.get(key) ?? []
          bucket.push({ segment, river })
          buckets.set(key, bucket)
        }
      }
    }
  }
  const bridges: { point: WorldPoint; angle: number; length: number; width: number; opacity: number }[] = []
  for (const road of roads) for (const part of segments(road.samples)) {
    for (let y = Math.floor(part.y / cell); y <= Math.floor(part.bottom / cell); y++) {
      for (let x = Math.floor(part.x / cell); x <= Math.floor(part.right / cell); x++) {
        for (const { segment, river } of buckets.get(x + ':' + y) ?? []) {
          const determinant = part.dx * segment.dy - part.dy * segment.dx
          const crossingAngle = Math.abs(determinant) / (part.length * segment.length)
          if (crossingAngle < .3) continue
          const qx = segment.a.x - part.a.x
          const qy = segment.a.y - part.a.y
          const t = (qx * segment.dy - qy * segment.dx) / determinant
          const u = (qx * part.dy - qy * part.dx) / determinant
          if (t < 0 || t > 1 || u < 0 || u > 1) continue
          const point = { x: part.a.x + t * part.dx, y: part.a.y + t * part.dy }
          if (terrainAt(point) === 'water') continue
          const width = road.settings.width * 1.13
          if (bridges.some(bridge => Math.hypot(bridge.point.x - point.x, bridge.point.y - point.y) < Math.max(6, width))) continue
          const riverProgress = lerp(segment.a.at, segment.b.at, u) / river.samples[river.samples.length - 1].at
          const length = lerp(river.settings.width, river.settings.mouthWidth, riverProgress) / crossingAngle + 8
          bridges.push({ point, angle: Math.atan2(part.dy, part.dx), length, width, opacity: Math.min(road.settings.opacity, river.settings.opacity) })
        }
      }
    }
  }
  return bridges
}

function drawBridges(context: CanvasRenderingContext2D, roads: PreparedPath[], rivers: PreparedPath[], terrainAt: TerrainAt) {
  for (const { point, angle, length, width, opacity } of bridgeCrossings(roads, rivers, terrainAt)) {
    context.save()
    context.translate(point.x, point.y)
    context.rotate(angle)
    context.globalAlpha = opacity
    context.fillStyle = '#473529'
    context.fillRect(-length / 2 - 1, -width / 2 - 2, length + 2, width + 4)
    context.fillStyle = '#b18c62'
    context.fillRect(-length / 2, -width / 2, length, width)
    context.strokeStyle = '#6c5037'
    context.lineWidth = 1
    context.beginPath()
    for (let x = -length / 2 + 3; x < length / 2; x += 3) {
      context.moveTo(x, -width / 2)
      context.lineTo(x, width / 2)
    }
    context.stroke()
    context.restore()
  }
}

export function paintAtlasPaths(canvas: HTMLCanvasElement, features: AtlasPathFeature[], textures: Textures, terrainAt: TerrainAt) {
  const context = canvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, atlasWidth, atlasHeight)
  const paths = features.flatMap((feature, index) => {
    if (!isAtlasPath(feature.tool)) return []
    const settings = pathSettings(feature, index)
    const samples = spline(feature.points, feature.tool === 'Border' && (settings.closed || settings.fill))
    return samples.length >= 2 && settings.opacity > 0 ? [{ tool: feature.tool, settings, samples }] : []
  }).sort((a, b) => a.settings.layerOrder - b.settings.layerOrder)
  // Let the wider channel cover the tip of a tributary while keeping layer
  // order for channels of equal width.
  const rivers = paths.filter(path => path.tool === 'River').sort((a, b) =>
    a.settings.width + a.settings.mouthWidth - b.settings.width - b.settings.mouthWidth)
  const roads = paths.filter(path => path.tool === 'Route')
  const composite = makeCanvas(atlasWidth, atlasHeight)
  const bodies = composite.getContext('2d')!
  // Put every shoulder or bank behind all the bodies in its group so a
  // tributary or branch does not leave a rim across the continuing channel.
  for (const river of rivers) {
    const ribbon = paintRibbon(river, textures, terrainAt)
    if (!ribbon) continue
    context.drawImage(ribbon.banks, ribbon.left, ribbon.top)
    bodies.drawImage(ribbon.body, ribbon.left, ribbon.top)
  }
  context.drawImage(composite, 0, 0)
  const roadLayer = makeCanvas(atlasWidth, atlasHeight)
  const shoulders = roadLayer.getContext('2d')!
  const roadBodies = makeCanvas(atlasWidth, atlasHeight)
  const roadInk = roadBodies.getContext('2d')!
  for (const road of roads) {
    const ribbon = paintRibbon(road, textures, terrainAt)
    if (!ribbon) continue
    shoulders.drawImage(ribbon.banks, ribbon.left, ribbon.top)
    roadInk.drawImage(ribbon.body, ribbon.left, ribbon.top)
  }
  shoulders.drawImage(roadBodies, 0, 0)
  shoulders.globalCompositeOperation = 'destination-out'
  shoulders.drawImage(composite, 0, 0)
  context.drawImage(roadLayer, 0, 0)
  drawBridges(context, roads, rivers, terrainAt)
  for (const path of paths) if (path.tool === 'Border') drawBorder(context, path)
}
