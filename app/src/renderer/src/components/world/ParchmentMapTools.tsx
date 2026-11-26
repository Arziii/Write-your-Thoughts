import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Droplets, Eraser, Hand, Mountain, Pencil, Redo2, Route, Shapes, Trash2, Trees, Type, Undo2, Waves, Warehouse } from 'lucide-react'
import MapCanvas from './MapCanvas'
import type { MapPoint as Point } from './MapCanvas'
import { getSeamlessTerrain } from './seamlessTerrain'
import type { TerrainTile } from './seamlessTerrain'
import { defaultTerrain, terrainTextures } from './terrainAssets'
import { makeTerrainSurface, terrainSurfaceKey } from './terrainSurface'
import TerrainBlendLayer from './TerrainBlendLayer'
import { defaultTerrainBlend, terrainBrushPath as brushPath } from './terrainBlend'
import type { TerrainBrush as BrushStyle, TerrainShape as Shape, TerrainTextures } from './terrainBlend'
import { MapStamp, stampWidthFraction } from './MapStamp'
import { stampAssets, stampCategories, stampCredits, stampsById } from './mapStampAssets'
import AtlasPathControls from './AtlasPathControls'
import AtlasPathLayer from './AtlasPathLayer'
import { atlasHeight, atlasWidth, clamp, isAtlasPath, nearestOnPath, pathDefaults, pathSettings,
  simplifyPath, spline, terrainFromName, toMap, toWorld } from './atlasPaths'
import type { AtlasPathSettings, AtlasPathTool, AtlasTerrain, WorldPoint } from './atlasPaths'

const tools = ['Land', 'River', 'Border', 'Route', 'Mountain', 'Forest', 'Town', 'Label', 'Stamp'] as const
type Tool = typeof tools[number]
type Erasure = { id: string; points: Point[]; diameter: number }
type Feature = {
  id: string
  tool: Tool
  points: Point[]
  name: string
  size: number
  angle: number
  hidden?: boolean
  brush?: BrushStyle
  erasures?: Erasure[]
  stampId?: string
  opacity?: number
  addedOrder?: number
  stampOrder?: 'auto' | 'front' | 'back'
  path?: Partial<AtlasPathSettings>
}
const brushTools = ['Land brush', 'Water brush', 'Edge brush', 'Shape brush', 'Eraser brush', 'Forest scatter'] as const
type BrushTool = typeof brushTools[number]
const isBrush = (tool: string): tool is BrushTool => brushTools.some(brush => brush === tool)

function surfaceSettings(brush?: BrushStyle) {
  return brush?.generated && brush.terrain
    ? { terrain: brush.terrain, scale: brush.textureScale ?? 100, rotation: brush.rotation ?? 0 }
    : null
}
const historyLimit = 40
const brushPointLimit = 1500
const mapWidth = atlasWidth
const mapHeight = atlasHeight
const xAt = (point: Point) => point.x * mapWidth
const yAt = (point: Point) => point.y * mapHeight
const coordinatesFor = (points: Point[]) => points.map(point => `${xAt(point)},${yAt(point)}`).join(' ')
const distance = (a: Point, b: Point) => Math.hypot(xAt(a) - xAt(b), yAt(a) - yAt(b))
const control = 'rounded-md border border-[hsl(var(--studio-edge))] bg-surface-950 px-2.5 py-1.5 text-xs text-surface-100 hover:bg-surface-900 disabled:opacity-50'
const toolButtons = [
  ['', 'Pan and select pins', Hand],
  ['Land brush', 'Land brush', Pencil],
  ['Water brush', 'Water brush', Waves],
  ['Eraser brush', 'Eraser brush', Eraser],
  ['Edge brush', 'Edge brush', Pencil],
  ['Shape brush', 'Shape brush', Shapes],
  ['Land', 'Land polygon', Shapes],
  ['River', 'River', Droplets],
  ['Border', 'Border', Shapes],
  ['Route', 'Road / route', Route],
  ['Mountain', 'Mountain stamp', Mountain],
  ['Forest', 'Forest stamp', Trees],
  ['Town', 'Town stamp', Warehouse],
  ['Label', 'Label', Type],
] as const
const isPath = (tool: Tool) => tools.indexOf(tool) < 4
const ink = '#4c402d'

function isSettlement(feature: Feature) {
  return feature.tool === 'Town' || (!!feature.stampId && stampsById.get(feature.stampId)?.category === 'settlements')
}

function stampEntrance(feature: Feature) {
  const origin = toWorld(feature.points[0])
  const asset = feature.stampId && stampsById.get(feature.stampId)
  const radius = asset
    ? stampWidthFraction(asset, feature.size) * mapWidth * asset.height / asset.width / 2
    : 18 * feature.size
  const radians = feature.angle * Math.PI / 180
  return { point: { x: clamp(origin.x - Math.sin(radians) * radius, 0, mapWidth),
    y: clamp(origin.y + Math.cos(radians) * radius, 0, mapHeight) }, radius }
}

function seed(): Feature[] {
  return [
    { id: 'land', tool: 'Land', name: 'Mainland', size: 1, angle: 0, points: [
      {x:.15,y:.35},{x:.29,y:.19},{x:.47,y:.23},{x:.59,y:.12},{x:.79,y:.23},{x:.87,y:.4},
      {x:.78,y:.51},{x:.84,y:.67},{x:.63,y:.82},{x:.48,y:.72},{x:.31,y:.84},{x:.17,y:.65},{x:.23,y:.52}
    ] },
    ...([['Mountain', .48, .32], ['Mountain', .55, .29], ['Mountain', .61, .27],
      ['Forest', .31, .52], ['Forest', .36, .54], ['Forest', .66, .41], ['Forest', .71, .43],
      ['Town', .58, .57], ['Town', .33, .39], ['Town', .73, .62]] as const)
      .map(([tool, x, y], index) => ({ id: String(index), tool, points: [{ x, y }], name: tool === 'Town' ? (['Linen', 'Astron', 'Novus'][index - 7] ?? '') : '', size: 1, angle: 0 })),
    { id: 'river', tool: 'River', name: 'River', size: 1, angle: 0,
      points: [{ x: .55, y: .32 }, { x: .54, y: .39 }, { x: .58, y: .48 }, { x: .56, y: .59 }, { x: .61, y: .71 }, { x: .63, y: .82 }] },
    { id: 'road', tool: 'Route', name: 'Road to Novus', size: 1, angle: 0,
      points: [{ x: .58, y: .57 }, { x: .63, y: .55 }, { x: .67, y: .57 }, { x: .73, y: .62 }] },
  ]
}

const storageKey = (mapId: string) => `wyt-parchment-map-${mapId}`
export function initializeParchmentMap(mapId: string, starter = false) {
  localStorage.setItem(storageKey(mapId), JSON.stringify(starter ? seed() : []))
}

export function disposeParchmentMap(mapId: string) {
  localStorage.removeItem(storageKey(mapId))
}

function Stamp({ tool }: { tool: Tool }) {
  if (tool === 'Mountain') return <path d="M-27 12 -8-17 2-5 12-24 30 12Z M-15-6 -8-17 -1-7 M4-9 12-24 21-8 14-12 10-8" fill="#b8a586" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
  if (tool === 'Forest') return <path d="M-25 13 -17 0 -21 0 -12-16 -3 0 -7 0 0 13Z M-3 13 6-2 1-2 12-23 23-2 18-2 27 13Z" fill="#71805b" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
  if (tool === 'Town') return <path d="M-16 11V-4L-8-13 0-4V11 M0 11V-10L8-18 16-10V11Z M-5 11V4H4V11" fill="#c29662" stroke={ink} strokeWidth="2" />
  return null
}

function BrushShape({ feature, color, filters, opacity = 1 }: { feature: Feature; color: string; filters: string; opacity?: number }) {
  const { points, brush } = feature
  if (!brush) return null

  const filterId = `${filters}-${feature.id}`
  const padding = brush.diameter / 2 + brush.roughness * 2.5
  const xs = points.map(xAt)
  const ys = points.map(yAt)
  const left = Math.min(...xs) - padding
  const top = Math.min(...ys) - padding
  const width = Math.max(1, Math.max(...xs) - Math.min(...xs))
  const height = Math.max(1, Math.max(...ys) - Math.min(...ys))
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  let geometry
  if (brush.shape === 'Fill') geometry = <rect width={mapWidth} height={mapHeight} fill={color} />
  else if (brush.shape === 'Rectangle') geometry = <rect x={x} y={y} width={width} height={height} fill={color} />
  else if (brush.shape === 'Ellipse') geometry = <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} fill={color} />
  else if (brush.shape === 'Diamond') geometry = <polygon points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} fill={color} />
  else if (points.length === 1) geometry = <circle cx={xs[0]} cy={ys[0]} r={brush.diameter / 2} fill={color} />
  else geometry = <path d={brushPath(points, brush.smooth)} stroke={color} strokeWidth={brush.diameter} fill="none"
    strokeLinecap="round" strokeLinejoin={brush.smooth ? 'round' : 'bevel'} />

  const rough = brush.roughness > 0 && brush.shape !== 'Fill'
  return (
    <g opacity={opacity} filter={rough ? `url(#${filterId})` : undefined}>
      {rough && <defs>
        <filter id={filterId} filterUnits="userSpaceOnUse" x={left} y={top}
          width={Math.max(...xs) - left + padding} height={Math.max(...ys) - top + padding}>
          <feTurbulence baseFrequency=".042" numOctaves="2" seed="6" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={brush.roughness * 2.5}
            xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>}
      {geometry}
    </g>
  )
}

function strokeContains(points: Point[], diameter: number, point: Point) {
  return points.some((start, index) => {
    const end = points[index + 1]
    if (!end) return distance(point, start) <= diameter / 2
    const dx = xAt(end) - xAt(start)
    const dy = yAt(end) - yAt(start)
    const projection = ((xAt(point) - xAt(start)) * dx + (yAt(point) - yAt(start)) * dy) / (dx * dx + dy * dy)
    const t = Math.max(0, Math.min(1, projection || 0))
    return distance(point, { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }) <= diameter / 2
  })
}

function touchesPoint(feature: Feature, point: Point) {
  const { points, brush } = feature
  if (feature.erasures?.some(eraser => strokeContains(eraser.points, eraser.diameter, point))) return false
  if (brush?.shape === 'Fill') return true
  if (brush?.shape && points.length === 2) {
    const [first, last] = points
    const x = Math.abs(2 * (point.x - (first.x + last.x) / 2) / (last.x - first.x))
    const y = Math.abs(2 * (point.y - (first.y + last.y) / 2) / (last.y - first.y))
    if (brush.shape === 'Ellipse') return x * x + y * y <= 1
    if (brush.shape === 'Diamond') return x + y <= 1
    return x <= 1 && y <= 1
  }
  if (brush) return strokeContains(points, brush.diameter, point)
  return points.reduce((inside, a, index) => {
    const b = points[(index + 1) % points.length]
    const crosses = (a.y > point.y) !== (b.y > point.y) &&
      point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
    return crosses ? !inside : inside
  }, false)
}

function nearCoast(point: Point, diameter: number, terrain: Feature[]) {
  const probes = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4
    return { x: point.x + Math.cos(angle) * diameter / (2 * mapWidth), y: point.y + Math.sin(angle) * diameter / (2 * mapHeight) }
  })
  const surfaces = [point, ...probes].map(probe =>
    terrain.find(feature => touchesPoint(feature, probe))
  )
  return surfaces.some(feature => feature && !feature.brush?.subtract) &&
    surfaces.some(feature => !feature || feature.brush?.subtract)
}

type CanvasOptions = Pick<ComponentProps<typeof MapCanvas>, 'overlay' | 'brush' | 'placementPreview'> & {
  onEditPoint?: (point: Point) => void
  hideImage: boolean
  hidePins: boolean
}

export default function ParchmentMapTools({ mapId, hasImage, focused, mapName, onExit, onEdit, beforeDrawing, viewerControls, children }: {
  mapId: string
  hasImage: boolean
  focused: boolean
  mapName: string
  onExit: () => void
  onEdit: () => void
  beforeDrawing: () => void
  viewerControls?: ReactNode
  children: (options: CanvasOptions) => ReactNode
}) {
  const [features, setFeatures] = useState<Feature[] | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey(mapId))
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [tool, setTool] = useState<Tool | BrushTool | ''>('')
  const [brushSize, setBrushSize] = useState(100)
  const [forestDensity, setForestDensity] = useState(50)
  const [forestVariation, setForestVariation] = useState(40)
  const [roughness, setRoughness] = useState(3)
  const [smooth, setSmooth] = useState(true)
  const [opacity, setOpacity] = useState(100)
  const [terrainName, setTerrainName] = useState(defaultTerrain)
  const [textureScale, setTextureScale] = useState(100)
  const [smartTextureScale, setSmartTextureScale] = useState(100)
  const [smartTerrain, setSmartTerrain] = useState(true)
  const [terrainBlend, setTerrainBlend] = useState(defaultTerrainBlend)
  const [rotation, setRotation] = useState(0)
  const [generateTerrain, setGenerateTerrain] = useState(true)
  const [shape, setShape] = useState<Exclude<Shape, 'Fill'>>('Ellipse')
  const [subtract, setSubtract] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [brushHint, setBrushHint] = useState('')
  const [points, setPoints] = useState<Point[]>([])
  const [pathMode, setPathMode] = useState<'points' | 'freehand'>('points')
  const [pathStyles, setPathStyles] = useState(() => ({
    River: pathDefaults('River'), Route: pathDefaults('Route'), Border: pathDefaults('Border'),
  }))
  const [insertingPoint, setInsertingPoint] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [moving, setMoving] = useState(false)
  const [stampId, setStampId] = useState('')
  const [stampScale, setStampScale] = useState(1)
  const [stampOpacity, setStampOpacity] = useState(100)
  const [stampOrder, setStampOrder] = useState<NonNullable<Feature['stampOrder']>>('auto')
  const [vertex, setVertex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [hideImage, setHideImage] = useState(false)
  const [hidePins, setHidePins] = useState(false)
  const [layersOpen, setLayersOpen] = useState(true)
  const [past, setPast] = useState<Feature[][]>([])
  const [future, setFuture] = useState<Feature[][]>([])
  const [draft, setDraft] = useState<Feature | null>(null)
  const [seamlessTiles, setSeamlessTiles] = useState<TerrainTextures>({})
  const [surfaces, setSurfaces] = useState<TerrainTextures>({})
  const surfaceCache = useRef(new Map<string, TerrainTile>())
  const stroke = useRef<Feature | null>(null)
  const draftFrame = useRef<number | null>(null)
  const pathStroke = useRef<Point[] | null>(null)
  const exitButton = useRef<HTMLButtonElement>(null)
  const enterButton = useRef<HTMLButtonElement>(null)
  const editorWasOpen = useRef(false)
  const elementId = useId()
  const mask = `${elementId}-coast`
  const texture = `${elementId}-grain`
  const filters = `${elementId}-brush`
  const feather = `${elementId}-biome-blend`
  const selected = features?.find(feature => feature.id === selectedId)
  const selectedPath = selected && isAtlasPath(selected.tool) ? selected : undefined
  const atlasTool = isAtlasPath(tool) ? tool : null
  const atlasStyle = atlasTool ? pathStyles[atlasTool] : undefined
  const freehand = atlasTool !== null && pathMode === 'freehand'
  const stampCategory = tool === 'Mountain' ? 'mountains' : (tool === 'Forest' || tool === 'Forest scatter') ? 'forests' : tool === 'Town' ? 'settlements' : null
  const activeStampCategory = stampCategories.find(category => category.id === stampCategory)
  const isPainting = isBrush(tool)
  const isScattering = tool === 'Forest scatter'
  const isErasing = tool === 'Eraser brush'
  const isSmartBrush = tool === 'Land brush' && smartTerrain
  const paintsWater = isErasing || tool === 'Water brush' || (tool !== 'Land brush' && subtract)
  const terrainTexture = terrainTextures.find(texture => texture.name === terrainName)
  const recentTextures = [...new Set((features ?? []).flatMap(feature => feature.brush?.terrain ? [feature.brush.terrain] : []).reverse())].slice(0, 5)
  const hasTerrain = features !== null
  const textureKeys = JSON.stringify([...new Set([terrainName, ...(features ?? []).flatMap(feature =>
    feature.hidden || !feature.brush?.terrain ? [] : [feature.brush.terrain])])].sort())
  const surfaceKeys = JSON.stringify([...new Set((features ?? []).flatMap(feature => {
    const settings = surfaceSettings(feature.brush)
    return settings && !feature.hidden ? [terrainSurfaceKey(settings)] : []
  }))].sort())

  useEffect(() => {
    let cancelled = false
    const cache = surfaceCache.current
    const keys = JSON.parse(surfaceKeys) as string[]
    // Keep active fields and a few recent ones so undo/redo can reuse them.
    for (const key of cache.keys()) {
      if (cache.size <= keys.length + 6) break
      if (!keys.includes(key)) cache.delete(key)
    }
    setSurfaces(Object.fromEntries(cache))
    async function generate() {
      for (const key of keys) {
        if (cancelled) return
        if (cache.has(key)) continue
        const [terrain, scale, rotation] = JSON.parse(key) as [string, number, number]
        const image = await makeTerrainSurface({ terrain, scale, rotation }, () => cancelled)
        if (cancelled || !image) return
        cache.set(key, image)
        setSurfaces(current => ({ ...current, [key]: image }))
      }
    }
    void generate().catch(error => {
      if (!cancelled) {
        console.error('Could not generate terrain relief', error)
        setError('Could not generate relief. The terrain texture will be used instead.')
      }
    })
    return () => { cancelled = true }
  }, [surfaceKeys])

  useEffect(() => {
    if (!hasTerrain) return
    let active = true
    const needed = new Set<string>(JSON.parse(textureKeys))
    for (const { name, url } of terrainTextures) {
      if (!needed.has(name)) continue
      getSeamlessTerrain(url).then(tile => {
        if (active) setSeamlessTiles(current => current[name] === tile ? current : { ...current, [name]: tile })
      }).catch(error => console.error('Could not prepare terrain texture:', name, error))
    }
    return () => { active = false }
  }, [hasTerrain, textureKeys])

  useEffect(() => () => {
    if (draftFrame.current !== null) cancelAnimationFrame(draftFrame.current)
  }, [])

  function persist(next: Feature[]) {
    try {
      localStorage.setItem(storageKey(mapId), JSON.stringify(next))
      setFeatures(next)
      setError('')
      return true
    } catch {
      setError('Could not save the map layers on this device.')
      return false
    }
  }

  function save(next: Feature[]) {
    // Older maps have only a draw order. Keep it as their initial ordering.
    const previous = (features ?? []).map((feature, index) =>
      feature.addedOrder === undefined ? { ...feature, addedOrder: index } : feature
    )
    const orderById = new Map(previous.map(feature => [feature.id, feature.addedOrder!]))
    let latestOrder = previous.reduce((latest, feature) => Math.max(latest, feature.addedOrder!), -1)
    const ordered = next.map(feature => {
      const addedOrder = orderById.get(feature.id) ?? ++latestOrder
      return feature.addedOrder === addedOrder ? feature : { ...feature, addedOrder }
    })
    if (!persist(ordered)) return false
    setPast(current => [...current, previous].slice(-historyLimit))
    setFuture([])
    return true
  }

  function undo() {
    const previous = past[past.length - 1]
    if (!previous || !features || !persist(previous)) return
    setPast(past.slice(0, -1))
    setFuture([features, ...future])
  }

  function redo() {
    const next = future[0]
    if (!next || !features || !persist(next)) return
    setPast([...past, features])
    setFuture(future.slice(1))
  }

  function cancelStroke() {
    if (draftFrame.current !== null) {
      cancelAnimationFrame(draftFrame.current)
      draftFrame.current = null
    }
    stroke.current = null
    setDraft(null)
  }

  function chooseTool(next: typeof tool) {
    beforeDrawing()
    cancelStroke()
    setTool(next)
    setStampId('')
    setBrushHint('')
    setPickerOpen(false)
    if (next === 'Edge brush') setBrushSize(60)
    setPoints([])
    pathStroke.current = null
    setInsertingPoint(false)
    setMoving(false)
    setVertex(null)
  }

  function selectLayer(id: string) {
    chooseTool('')
    setSelectedId(id)
  }

  function saveStamp(assetId: string, point: Point, original?: Feature) {
    const asset = stampsById.get(assetId)
    if (!features || !asset) return
    const id = crypto.randomUUID()
    const stamp: Feature = original
      ? { ...original, id, points: [point], hidden: false }
      : { id, tool: 'Stamp', stampId: assetId, name: asset.label, points: [point],
          size: stampScale, angle: 0, opacity: stampOpacity / 100, stampOrder }
    const next = !original && stampOrder === 'back' ? [stamp, ...features] : [...features, stamp]
    if (save(next)) setSelectedId(id)
  }

  function reorderStamp(direction: NonNullable<Feature['stampOrder']>) {
    if (!features || selected?.tool !== 'Stamp') return
    if (direction === 'auto') {
      update({ stampOrder: 'auto' })
      return
    }
    const remaining = features.filter(feature => feature.id !== selected.id)
    const stamp = { ...selected, stampOrder: direction }
    save(direction === 'front' ? [...remaining, stamp] : [stamp, ...remaining])
  }

  function selectStamp(id: string) {
    selectLayer(id)
    setLayersOpen(true)
  }

  function moveStamp(id: string, point: Point) {
    if (!features) return
    save(features.map(feature => feature.id === id ? { ...feature, points: [point] } : feature))
  }

  function deleteLayer(id: string) {
    if (!features || stroke.current) return
    if (save(features.filter(feature => feature.id !== id)) && selectedId === id) {
      selectLayer('')
    }
  }

  function exit() {
    chooseTool('')
    onExit()
  }

  useEffect(() => {
    if (focused) {
      exitButton.current?.focus()
      editorWasOpen.current = true
    } else if (editorWasOpen.current) {
      enterButton.current?.focus()
    }
  }, [focused])

  useEffect(() => {
    if (!focused) return
    function handleShortcut(event: globalThis.KeyboardEvent) {
      const target = event.target
      if (event.defaultPrevented || (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]'))) return
      if (event.key === 'Escape') {
        if (tool || moving || stampId) chooseTool('')
        else exit()
      } else if ((event.ctrlKey || event.metaKey) && !event.altKey && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        if (stroke.current || pathStroke.current) return
        if (event.shiftKey || event.key.toLowerCase() === 'y') redo()
        else undo()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  })

  function update(patch: Partial<Feature>) {
    if (selected && features) save(features.map(feature => feature.id === selected.id ? { ...feature, ...patch } : feature))
  }

  function snapEndpoint(type: AtlasPathTool, input: Point, settings: AtlasPathSettings, excludeId?: string): Point {
    if (type === 'Border') return input
    const world = toWorld(input)
    let nearest: { distance: number; point: WorldPoint } | undefined
    for (const feature of shown) {
      if (feature.id === excludeId || !feature.points.length) continue
      if (type === 'Route' && isSettlement(feature)) {
        const { point, radius } = stampEntrance(feature)
        const offset = Math.hypot(world.x - point.x, world.y - point.y)
        if (offset < Math.max(24, radius + 10) && (!nearest || offset < nearest.distance)) nearest = { point, distance: offset }
      } else if (feature.tool === type) {
        const other = pathSettings(feature)
        const tolerance = Math.max(12, Math.min(32, (settings.width + other.width) * .52))
        const candidate = nearestOnPath(world, spline(feature.points))
        if (candidate && candidate.distance < tolerance && (!nearest || candidate.distance < nearest.distance)) nearest = candidate
      }
    }
    return nearest ? toMap(nearest.point) : input
  }

  function addFeature(type: Tool, geometry: Point[]) {
    if (!features) return
    const id = crypto.randomUUID()
    const path = isAtlasPath(type) ? { ...pathStyles[type], layerOrder: features.length
      ? Math.max(...features.map((feature, index) => feature.path?.layerOrder ?? index)) + 1 : 0 } : undefined
    if (path && isAtlasPath(type)) {
      const minimum = type === 'Border' && (path.closed || path.fill) ? 3 : 2
      if (geometry.length < minimum) return
      const last = geometry.length - 1
      const snapped = geometry.map((point, index) => index === 0 || index === last ? snapEndpoint(type, point, path) : point)
      if (spline(snapped).length > 1) geometry = snapped
      else if (spline(geometry).length <= 1) return
    }
    const name = type === 'Label' ? 'New label' : type === 'Route' ? 'Road / route' : path ? type : ''
    if (save([...features, { id, tool: type, points: geometry, name, size: 1, angle: 0, path }])) {
      chooseTool('')
      setSelectedId(id)
      if (path) setLayersOpen(true)
    }
  }

  function cancelPathStroke() {
    pathStroke.current = null
    setPoints([])
  }

  function extendPathStroke(point: Point) {
    const current = pathStroke.current
    if (!current || current.length >= brushPointLimit || distance(current[current.length - 1], point) < 3) return
    pathStroke.current = [...current, point]
    setPoints(pathStroke.current)
  }

  function finishPathStroke() {
    const current = pathStroke.current
    cancelPathStroke()
    if (atlasTool && current) addFeature(atlasTool, simplifyPath(current))
  }

  function makeStroke(point: Point, strokeShape?: Shape): Feature {
    return {
      id: crypto.randomUUID(), tool: 'Land', points: [point],
      name: isErasing ? 'Background stroke' : strokeShape === 'Fill' ? 'Map fill' : tool === 'Edge brush' ? 'Coastline stroke' : paintsWater ? 'Water stroke' : terrainName,
      size: 1, angle: 0,
      brush: { diameter: brushSize, roughness: isErasing ? 0 : roughness, smooth: isErasing || smooth,
        subtract: paintsWater, opacity: isErasing ? 1 : (isSmartBrush ? opacity : Math.max(5, opacity)) / 100,
        terrain: paintsWater ? undefined : terrainName, generated: !isSmartBrush && !paintsWater && generateTerrain,
        textureScale: isSmartBrush ? smartTextureScale : textureScale, rotation, shape: strokeShape,
        blend: isSmartBrush ? { ...terrainBlend } : undefined },
    }
  }

  function startStroke(point: Point) {
    if (!features || (isSmartBrush && opacity === 0)) return
    if (tool === 'Edge brush' && !nearCoast(point, brushSize, terrainForHitTest)) {
      setBrushHint('Start where the brush overlaps land and water.')
      return
    }
    setBrushHint('')
    const next = makeStroke(point, tool === 'Shape brush' ? shape : undefined)
    stroke.current = next
    setDraft(next)
  }

  function extendStroke(point: Point) {
    const current = stroke.current
    if (!current) return

    let nextPoints: Point[]
    if (current.brush?.shape) nextPoints = [current.points[0], point]
    else {
      if (current.points.length >= brushPointLimit ||
          distance(current.points[current.points.length - 1], point) < 3) return
      nextPoints = [...current.points, point]
    }
    const next = { ...current, points: nextPoints }
    stroke.current = next
    if (draftFrame.current === null) draftFrame.current = requestAnimationFrame(() => {
      draftFrame.current = null
      setDraft(stroke.current)
    })
  }

  function finishStroke() {
    const current = stroke.current
    cancelStroke()
    if (!current || !features) return
    if (isScattering) {
      scatterForest(current)
      return
    }
    if (current.brush?.shape) {
      const [first, last] = current.points
      if (!last || Math.abs(xAt(first) - xAt(last)) < 2 || Math.abs(yAt(first) - yAt(last)) < 2) return
    }
    if (save([...features, current])) setSelectedId(current.id)
  }

  function scatterForest(stroke: Feature) {
    if (!features) return
    const forests = stampAssets.filter(asset => asset.category === 'forests')
    if (!forests.length) return
    const radius = (stroke.brush?.diameter ?? brushSize) / 2
    const spacing = 46 - forestDensity * .32
    const rivers = shown.filter(feature => feature.tool === 'River').map(feature => {
      const settings = pathSettings(feature)
      return { samples: spline(feature.points), width: Math.max(settings.width, settings.mouthWidth) }
    })
    const visited = new Set<number>()
    const stamps: Feature[] = []
    const columns = Math.ceil(mapWidth / spacing)
    const rows = Math.ceil(mapHeight / spacing)

    function scatterAt(center: Point) {
      const cx = xAt(center)
      const cy = yAt(center)
      for (let row = Math.max(0, Math.floor((cy - radius) / spacing)); row < Math.min(rows, Math.ceil((cy + radius) / spacing)); row++) {
        for (let col = Math.max(0, Math.floor((cx - radius) / spacing)); col < Math.min(columns, Math.ceil((cx + radius) / spacing)); col++) {
          const key = row * columns + col
          if (visited.has(key) || stamps.length >= 250) continue
          // Stable jitter per cell avoids a visible grid and duplicate placements within a stroke.
          const random = (salt: number) => (Math.imul(key + salt, 2654435761) >>> 0) / 4294967296
          const point = { x: (col + .2 + random(1) * .6) * spacing / mapWidth,
            y: (row + .2 + random(7) * .6) * spacing / mapHeight }
          if (point.x > 1 || point.y > 1 || distance(point, center) > radius) continue
          visited.add(key)
          const land = terrainForHitTest.find(feature => touchesPoint(feature, point))
          if (!land || land.brush?.subtract || rivers.some(({ samples, width }) =>
            (nearestOnPath(toWorld(point), samples)?.distance ?? Infinity) < width / 2 + 4)) continue
          const asset = forests[Math.floor(random(13) * forests.length)]
          const size = .42 * (1 + (random(19) * 2 - 1) * forestVariation / 100)
          stamps.push({ id: crypto.randomUUID(), tool: 'Stamp', stampId: asset.id, name: asset.label,
            points: [point], size, angle: 0, opacity: 1, stampOrder: 'auto' })
        }
      }
    }

    scatterAt(stroke.points[0])
    for (let index = 1; index < stroke.points.length && stamps.length < 250; index++) {
      const from = stroke.points[index - 1]
      const to = stroke.points[index]
      const steps = Math.max(1, Math.ceil(distance(from, to) / Math.max(2, Math.min(spacing, radius) / 2)))
      for (let step = 1; step <= steps && stamps.length < 250; step++) {
        const t = step / steps
        scatterAt({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
      }
    }
    if (stamps.length) save([...features, ...stamps])
    else setBrushHint('Drag over painted land to scatter trees.')
  }

  function fillMap() {
    if (!features) return
    const fill = makeStroke({ x: 0, y: 0 }, 'Fill')
    if (save([...features, fill])) setSelectedId(fill.id)
  }

  const shown = useMemo(() => features?.filter(feature => !feature.hidden) ?? [], [features])
  const committedTerrain = useMemo(() => shown.filter(feature => feature.tool === 'Land'), [shown])
  const terrainForHitTest = useMemo(() => [...committedTerrain].reverse(), [committedTerrain])
  const atlasPaths = useMemo(() => shown.filter(feature => isAtlasPath(feature.tool)), [shown])
  const terrainAt = useMemo(() => {
    const settlements = shown.filter(isSettlement).map(stampEntrance)
    const surroundings = shown.filter(feature => feature.tool === 'Mountain' || feature.tool === 'Forest' ||
      (!!feature.stampId && ['forests', 'mountains'].includes(stampsById.get(feature.stampId)?.category ?? '')))
      .map(feature => ({ point: toWorld(feature.points[0]), radius: 30 * feature.size,
        style: feature.tool === 'Mountain' || (feature.stampId && stampsById.get(feature.stampId)?.category === 'mountains')
          ? 'stone' as const : 'forest_trail' as const }))
    const cache = new Map<number, AtlasTerrain>()
    return (world: WorldPoint): AtlasTerrain => {
      const x = Math.round(world.x / 4)
      const y = Math.round(world.y / 4)
      const key = y * (mapWidth + 1) + x
      const cached = cache.get(key)
      if (cached) return cached
      const distanceFrom = ({ x, y }: WorldPoint) => Math.hypot(world.x - x, world.y - y)
      const terrain = terrainForHitTest.find(feature => touchesPoint(feature, toMap(world)))
      let style: AtlasTerrain = 'dirt'
      if (terrain?.brush?.subtract || (!terrain && (!hasImage || (focused && hideImage)))) style = 'water'
      else if (settlements.some(({ point, radius }) => distanceFrom(point) < Math.max(27, radius))) style = 'cobblestone'
      else {
        style = terrainFromName(terrain?.brush?.terrain)
        if (style === 'dirt' || style === 'gravel') {
          const nearby = surroundings.find(({ point, radius }) => distanceFrom(point) < radius)
          if (nearby) style = nearby.style
        }
      }
      cache.set(key, style)
      return style
    }
  }, [shown, terrainForHitTest, hasImage, focused, hideImage])
  const terrainDraft = draft && !isScattering && (!draft.brush?.shape || draft.points.length > 1) ? draft : null
  const smartCompositing = Boolean(terrainDraft?.brush?.blend) || committedTerrain.some(feature => feature.brush?.blend)
  const terrain = terrainDraft
    ? [...committedTerrain, terrainDraft]
    : committedTerrain
  const paintedTerrain = smartCompositing ? [] : terrain.flatMap(feature => {
    const asset = terrainTextures.find(texture => texture.name === feature.brush?.terrain)
    return asset && feature.brush ? [{ feature, asset, brush: feature.brush }] : []
  })
  const showWater = !hasImage || (focused && hideImage)
  const showRelief = showWater && committedTerrain.length > 0
  const reliefMask = `${elementId}-committed-coast`
  const reliefFilter = `${elementId}-coastal-relief`
  const eraseMask = (feature: Feature, prefix: string) =>
    feature.erasures?.length ? `url(#${prefix}-erase-${feature.id})` : undefined
  const erasureMasks = (items: Feature[], prefix: string) => items.map(feature => feature.erasures?.length ? (
    <mask key={feature.id} id={`${prefix}-erase-${feature.id}`} maskUnits="userSpaceOnUse" x="0" y="0"
      width={mapWidth} height={mapHeight} style={{ maskType: 'luminance' }}>
      <rect width={mapWidth} height={mapHeight} fill="white" />
      {feature.erasures.map(erasure => erasure.points.length === 1
        ? <circle key={erasure.id} cx={xAt(erasure.points[0])} cy={yAt(erasure.points[0])} r={erasure.diameter / 2} fill="black" />
        : <path key={erasure.id} d={brushPath(erasure.points, true)} stroke="black" strokeWidth={erasure.diameter}
            strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
    </mask>
  ) : null)
  const terrainGeometry = (feature: Feature, filterPrefix: string) => (
    <g key={feature.id} mask={eraseMask(feature, filterPrefix)}>
      {feature.brush
        ? <BrushShape feature={feature} filters={filterPrefix}
            color={feature.brush.subtract ? 'black' : 'white'}
            opacity={feature.brush.subtract ? (feature.brush.opacity ?? 1) : 1} />
        : <polygon points={coordinatesFor(feature.points)} fill="white" />}
    </g>
  )

  const activeVertex = moving && vertex !== null ? selected?.points[vertex] : undefined
  const previewPoints = freehand ? simplifyPath(points) : points
  const preview = atlasTool ? spline(previewPoints, atlasTool === 'Border' && Boolean(atlasStyle?.closed || atlasStyle?.fill)) : []
  const overlay = features && (
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${mapWidth} ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${elementId}-land`}>
          <stop stopColor="#ead8a9" />
          <stop offset="1" stopColor="#c2ab74" />
        </radialGradient>
        <radialGradient id={`${elementId}-water`}>
          <stop stopColor="#9db6aa" />
          <stop offset="1" stopColor="#638983" />
        </radialGradient>
        <filter id={texture} x="0" y="0" width="100%" height="100%">
          <feTurbulence baseFrequency=".024" numOctaves="3" seed="8" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <filter id={feather} filterUnits="userSpaceOnUse" x="-30" y="-30" width={mapWidth + 60} height={mapHeight + 60}>
          {/* Break up the transition at several scales, then soften the small edges. */}
          <feTurbulence type="fractalNoise" baseFrequency=".041 .055" numOctaves="3" seed="19" result="edgeGrain" />
          <feDisplacementMap in="SourceGraphic" in2="edgeGrain" scale="24" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="2.5" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="1.55" intercept="-.275" />
          </feComponentTransfer>
        </filter>
        {erasureMasks(terrain, filters)}
        {showRelief && terrain !== committedTerrain && erasureMasks(committedTerrain, `${filters}-committed`)}
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width={mapWidth} height={mapHeight} style={{ maskType: 'luminance' }}>
          {terrain.map(feature => terrainGeometry(feature, filters))}
        </mask>
        {showRelief && <>
          {terrain !== committedTerrain && (
            <mask id={reliefMask} maskUnits="userSpaceOnUse" x="0" y="0" width={mapWidth} height={mapHeight} style={{ maskType: 'luminance' }}>
              {committedTerrain.map(feature => terrainGeometry(feature, `${filters}-committed`))}
            </mask>
          )}
          <filter id={reliefFilter} filterUnits="userSpaceOnUse" x="-28" y="-28"
            width={mapWidth + 56} height={mapHeight + 56} colorInterpolationFilters="sRGB">
            {/* A shallow-water shelf sits outside the silhouette, including around inland lakes. */}
            <feMorphology in="SourceAlpha" operator="dilate" radius="8" result="shelf" />
            <feGaussianBlur in="shelf" stdDeviation="4.5" result="softShelf" />
            <feComposite in="softShelf" in2="SourceAlpha" operator="out" result="coastalWater" />
            <feFlood floodColor="#a7cfbe" floodOpacity=".56" result="waterColor" />
            <feComposite in="waterColor" in2="coastalWater" operator="in" result="shallows" />

            {/* Two opposing inset edges give the land a consistent upper-left light source. */}
            <feOffset in="SourceAlpha" dx="4" dy="5" result="highlightOffset" />
            <feGaussianBlur in="highlightOffset" stdDeviation="1.4" result="softHighlight" />
            <feComposite in="SourceAlpha" in2="softHighlight" operator="out" result="highlightEdge" />
            <feFlood floodColor="#f4dfa4" floodOpacity=".58" result="lightColor" />
            <feComposite in="lightColor" in2="highlightEdge" operator="in" result="highlight" />
            <feOffset in="SourceAlpha" dx="-5" dy="-6" result="shadowOffset" />
            <feGaussianBlur in="shadowOffset" stdDeviation="2.8" result="softShadow" />
            <feComposite in="SourceAlpha" in2="softShadow" operator="out" result="shadowEdge" />
            <feFlood floodColor="#453a27" floodOpacity=".56" result="shadowColor" />
            <feComposite in="shadowColor" in2="shadowEdge" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shallows" />
              <feMergeNode in="shadow" />
              <feMergeNode in="highlight" />
            </feMerge>
          </filter>
        </>}
        {paintedTerrain.map(({ feature, asset, brush }) => {
          const settings = surfaceSettings(brush)
          const surface = settings && surfaces[terrainSurfaceKey(settings)]
          const width = surface ? mapWidth : 360 * (brush.textureScale ?? 100) / 100
          const tile = seamlessTiles[asset.name]
          const height = surface ? mapHeight : width * (tile ? tile.pixels.height / tile.pixels.width : 768 / 1408)
          return <g key={feature.id}>
            <pattern id={`${elementId}-texture-${feature.id}`} width={width} height={height}
              patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse"
              patternTransform={surface ? undefined : `rotate(${brush.rotation ?? 0})`}>
              <image href={surface?.url || tile?.url} width={width} height={height} preserveAspectRatio="none" />
            </pattern>
            <g id={`${elementId}-shape-${feature.id}`}>
              <BrushShape feature={feature} filters={`${filters}-paint`} color="white" />
            </g>
            <mask id={`${elementId}-paint-${feature.id}`} maskUnits="userSpaceOnUse" x="0" y="0"
              width={mapWidth} height={mapHeight} style={{ maskType: 'alpha' }}>
              <use href={`#${elementId}-shape-${feature.id}`} mask={eraseMask(feature, filters)} />
            </mask>
            <mask id={`${elementId}-blend-${feature.id}`} maskUnits="userSpaceOnUse" x="0" y="0"
              width={mapWidth} height={mapHeight} style={{ maskType: 'alpha' }}>
              <g mask={eraseMask(feature, filters)}>
                <use href={`#${elementId}-shape-${feature.id}`} filter={`url(#${feather})`} />
              </g>
            </mask>
          </g>
        })}
      </defs>
      {showWater && <>
        <rect width={mapWidth} height={mapHeight} fill={`url(#${elementId}-water)`} />
        <rect width={mapWidth} height={mapHeight} filter={`url(#${texture})`} opacity=".22" style={{ mixBlendMode: 'multiply' }} />
      </>}
      <g mask={`url(#${mask})`} opacity={showWater ? 1 : .38}>
        <rect width={mapWidth} height={mapHeight} fill={`url(#${elementId}-land)`} />
        <rect width={mapWidth} height={mapHeight} filter={`url(#${texture})`} opacity=".27" style={{ mixBlendMode: 'multiply' }} />
        {/* Give newly painted shorelines full texture coverage. Overlapping strokes blend over this base in paint order. */}
        {[...paintedTerrain].reverse().filter(({ brush }) => (brush.opacity ?? 1) === 1).map(({ feature }) => (
          <rect key={feature.id} width={mapWidth} height={mapHeight}
            fill={`url(#${elementId}-texture-${feature.id})`} mask={`url(#${elementId}-paint-${feature.id})`} />
        ))}
        {paintedTerrain.map(({ feature, brush }) => (
          <rect key={feature.id} width={mapWidth} height={mapHeight}
            fill={`url(#${elementId}-texture-${feature.id})`}
            mask={`url(#${elementId}-blend-${feature.id})`} opacity={brush.opacity ?? 1} />
        ))}
        {smartCompositing && <TerrainBlendLayer features={committedTerrain} draft={terrainDraft}
          textures={seamlessTiles} surfaces={surfaces} />}
      </g>
      {showRelief && <g filter={`url(#${reliefFilter})`}>
        <rect width={mapWidth} height={mapHeight} fill="white"
          mask={`url(#${terrain === committedTerrain ? mask : reliefMask})`} />
      </g>}
    </svg>
  )

  const pathTool = tool && !isBrush(tool) && isPath(tool) ? tool : null
  const onEditPoint = moving && selected ? (point: Point) => {
    const origin = selected.points[0]
    if (insertingPoint) {
      const world = toWorld(point)
      let index = 1
      let least = Infinity
      const settings = pathSettings(selected)
      const closed = selected.tool === 'Border' && (settings.closed || settings.fill)
      for (let i = 1; i < selected.points.length + Number(closed); i++) {
        const segment = selected.points.slice(i - 1, i + 1)
        if (segment.length === 1) segment.push(selected.points[0])
        const offset = nearestOnPath(world, spline(segment))?.distance ?? Infinity
        if (offset < least) {
          least = offset
          index = i
        }
      }
      update({ points: [...selected.points.slice(0, index), point, ...selected.points.slice(index)] })
    } else if (vertex !== null) {
      const next = isAtlasPath(selected.tool) && (vertex === 0 || vertex === selected.points.length - 1)
        ? snapEndpoint(selected.tool, point, pathSettings(selected), selected.id) : point
      update({ points: selected.points.map((value, index) => index === vertex ? next : value) })
    }
    else {
      const dx = Math.max(-Math.min(...selected.points.map(p => p.x)), Math.min(1 - Math.max(...selected.points.map(p => p.x)), point.x - origin.x))
      const dy = Math.max(-Math.min(...selected.points.map(p => p.y)), Math.min(1 - Math.max(...selected.points.map(p => p.y)), point.y - origin.y))
      const translate = (p: Point) => ({ x: p.x + dx, y: p.y + dy })
      update({
        points: selected.points.map(translate),
        erasures: selected.erasures?.map(erase => ({ ...erase, points: erase.points.map(translate) })),
      })
    }
    setMoving(false)
    setInsertingPoint(false)
    setVertex(null)
  } : stampId ? (point: Point) => saveStamp(stampId, point)
    : tool && !stampCategory && !isBrush(tool) && !freehand ? (point: Point) => {
    if (pathTool) setPoints(current => [...current, point])
    else addFeature(tool, [point])
  } : undefined

  const svgLayer = 'pointer-events-none absolute inset-0 h-full w-full'
  const legacyStamps = shown.filter(feature => ['Mountain', 'Forest', 'Town'].includes(feature.tool))
  const legacyStampLayer = (settlement: boolean) => (
    <svg className={svgLayer} viewBox={`0 0 ${mapWidth} ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
      {legacyStamps.filter(feature => isSettlement(feature) === settlement).map(feature =>
        <g key={feature.id} transform={`translate(${xAt(feature.points[0])},${yAt(feature.points[0])}) rotate(${feature.angle}) scale(${feature.size})`}>
          {focused && feature.id === selectedId && <circle r="32" fill="none" stroke={ink} strokeDasharray="4 4" />}
          <Stamp tool={feature.tool} />
        </g>
      )}
    </svg>
  )
  const selectedSettings = selectedPath && pathSettings(selectedPath, features?.indexOf(selectedPath))
  const previewAsset = focused && stampId ? stampsById.get(stampId) : undefined
  const canvas = children({
    overlay: aspectRatio => <>
      {overlay}
      <AtlasPathLayer paths={atlasPaths} terrainAt={terrainAt} />
      {isScattering && draft && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          preserveAspectRatio="none" aria-hidden="true">
          <BrushShape feature={{ ...draft, brush: draft.brush && { ...draft.brush, roughness: 0 } }}
            color="#65854b" filters={filters} opacity={.32} />
        </svg>
      )}
      {[false, true].map(settlement => <div key={String(settlement)} className="pointer-events-none absolute inset-0">
        {legacyStampLayer(settlement)}
        {shown.filter(feature => isSettlement(feature) === settlement).flatMap(feature => {
          const asset = feature.stampId && stampsById.get(feature.stampId)
          if (!asset) return []
          const angle = feature.angle * Math.PI / 180
          const width = stampWidthFraction(asset, feature.size) * aspectRatio
          const bottom = feature.points[0].y + width / 2 * (
            Math.abs(Math.sin(angle)) + asset.height / asset.width * Math.abs(Math.cos(angle))
          )
          const order = feature.stampOrder === 'front' ? 1 : feature.stampOrder === 'back' ? -1 : 0
          return [{ feature, asset, bottom, order }]
        }).sort((a, b) => a.order - b.order || (a.order === 0 ? a.bottom - b.bottom : 0))
          .map(({ feature, asset }) => {
          return <MapStamp key={feature.id} asset={asset} point={feature.points[0]} size={feature.size}
            angle={feature.angle} opacity={feature.opacity ?? 1} selected={selectedId === feature.id}
            editable={focused && !stampId && !tool && !moving}
            onSelect={() => selectStamp(feature.id)} onMove={point => moveStamp(feature.id, point)} />
        })}
      </div>)}
      <svg className={svgLayer} viewBox={`0 0 ${mapWidth} ${mapHeight}`} preserveAspectRatio="none" aria-hidden="true">
        {[...legacyStamps, ...shown.filter(feature => feature.tool === 'Label')].map(feature => feature.name &&
          <g key={feature.id}
            transform={`translate(${xAt(feature.points[0])},${yAt(feature.points[0])}) rotate(${feature.angle}) scale(${feature.size})`}>
            {focused && feature.tool === 'Label' && feature.id === selectedId && <circle r="32" fill="none" stroke={ink} strokeDasharray="4 4" />}
            <text y={feature.tool === 'Label' ? 0 : 33} textAnchor="middle" fontFamily="Georgia" fontSize="22"
              fill={ink} stroke="#ede0b8" strokeWidth="2.5" paintOrder="stroke">{feature.name}</text>
          </g>)}
        {focused && preview.length > 0 && <polyline points={preview.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none"
          stroke={atlasTool === 'River' ? '#4e849b' : atlasTool === 'Border' ? atlasStyle?.color : '#a3693d'}
          strokeWidth={atlasStyle?.width} opacity={Math.max(.35, atlasStyle?.opacity ?? 1)} strokeLinecap="round" strokeLinejoin="round" />}
        {focused && pathTool === 'Land' && points.length > 0 &&
          <polyline points={coordinatesFor(points)} fill="none" stroke={ink} strokeWidth="4" strokeDasharray="7 5" />}
        {focused && !freehand && points.map((point, index) => <circle key={index} cx={xAt(point)} cy={yAt(point)} r="4" fill={ink} />)}
        {focused && !tool && selectedPath?.points.map((point, index) => <circle key={index} cx={xAt(point)} cy={yAt(point)}
          r="3.5" fill="#f9eed7" stroke={ink} strokeWidth="1.25" />)}
        {focused && activeVertex && <circle cx={xAt(activeVertex)} cy={yAt(activeVertex)} r="8" fill="white" stroke={ink} strokeWidth="3" />}
      </svg>
    </>,
    placementPreview: previewAsset ? point => (
      <img src={previewAsset.url} alt="" draggable={false}
        className="absolute h-auto -translate-x-1/2 -translate-y-1/2 drop-shadow-sm"
        style={{
          left: `${point.x * 100}%`,
          top: `${point.y * 100}%`,
          width: `${stampWidthFraction(previewAsset, stampScale) * 100}%`,
          opacity: Math.max(.25, stampOpacity / 100 * .65),
        }} />
    ) : undefined,
    onEditPoint: focused ? onEditPoint : undefined,
    brush: focused && isPainting
      ? { diameter: tool === 'Shape brush' ? 0 : brushSize, start: startStroke, move: extendStroke, finish: finishStroke, cancel: cancelStroke }
      : focused && freehand ? { diameter: 0, start: point => {
        pathStroke.current = [point]
        setPoints([point])
      }, move: extendPathStroke, finish: finishPathStroke, cancel: cancelPathStroke } : undefined,
    hideImage: focused && hideImage,
    hidePins: focused && hidePins,
  })

  return <>
    <div className="studio-chapter-toolbar flex shrink-0 flex-wrap items-center gap-2 px-3 py-1.5">
      {focused ? <>
        <button ref={exitButton} type="button" className={control} onClick={exit}>Back to Maps</button>
        <h2 className="mr-auto truncate font-serif text-sm font-semibold">{mapName}</h2>
        <button type="button" className={control} disabled={!past.length || !!draft || !!pathStroke.current} onClick={undo}><Undo2 className="mr-1 inline h-3.5 w-3.5" />Undo</button>
        <button type="button" className={control} disabled={!future.length || !!draft || !!pathStroke.current} onClick={redo}><Redo2 className="mr-1 inline h-3.5 w-3.5" />Redo</button>
        <button type="button" className={control} aria-pressed={layersOpen && !stampCategory} onClick={() => {
          if (stampCategory) {
            chooseTool('')
            setLayersOpen(true)
          } else setLayersOpen(current => !current)
        }}>Layers</button>
        <span role="status" className="text-xs text-surface-400">{error ? 'Changes could not save' : 'Saved on this device'}</span>
      </> : (
        <>
          {viewerControls}
          <button ref={enterButton} type="button" className={`${control} !bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]`}
            onClick={() => { if (features || persist([])) { chooseTool(''); onEdit() } }}>Edit map</button>
        </>
      )}
      {error && <span role="alert" className="text-xs text-danger-500">{error}</span>}
    </div>

    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {focused && (
        <nav aria-label="Map tools" className="studio-chapter-toolbar flex w-36 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[hsl(var(--studio-edge))] p-2">
          {toolButtons.map(([value, label, Icon]) => (
            <button key={label} type="button" onClick={() => chooseTool(value)} aria-pressed={(tool === value || (value === 'Forest' && isScattering)) && !moving}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-850 ${(tool === value || (value === 'Forest' && isScattering)) && !moving ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]' : ''}`}>
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}
            </button>
          ))}
        </nav>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {focused && (pathTool || (tool && !stampCategory) || moving) && (
          <div className="studio-chapter-toolbar flex shrink-0 flex-wrap items-center gap-3 px-3 py-2 text-xs">
            {isPainting && !isScattering && <>
              {(tool === 'Shape brush' || tool === 'Edge brush') && (
                <select aria-label="Brush action" className={control} value={subtract ? 'subtract' : 'add'}
                  onChange={event => setSubtract(event.target.value === 'subtract')}>
                  <option value="add">Add land</option>
                  <option value="subtract">Carve water</option>
                </select>
              )}
              {tool === 'Shape brush' ? (
                <select aria-label="Brush shape" className={control} value={shape}
                  onChange={event => setShape(event.target.value as Exclude<Shape, 'Fill'>)}>
                  <option>Ellipse</option><option>Rectangle</option><option>Diamond</option>
                </select>
              ) : (
                <label className="flex items-center gap-2">Brush size
                  <input type="range" min="20" max="480" value={brushSize} onChange={event => setBrushSize(Number(event.target.value))} />
                  <output>{brushSize}</output>
                </label>
              )}
              {!isErasing && <>
                <label className="flex items-center gap-2">Opacity
                  <input type="range" min={isSmartBrush ? 0 : 5} max="100" value={isSmartBrush ? opacity : Math.max(5, opacity)}
                    onChange={event => setOpacity(event.target.valueAsNumber)} />
                  <output>{isSmartBrush ? opacity : Math.max(5, opacity)}%</output>
                </label>
                {!isSmartBrush && <label className="flex items-center gap-2">Roughness
                  <input type="range" min="0" max="8" value={roughness} onChange={event => setRoughness(Number(event.target.value))} />
                  <output>{roughness}</output>
                </label>}
                {tool !== 'Shape brush' && <label className="flex items-center gap-1"><input type="checkbox" checked={smooth} onChange={event => setSmooth(event.target.checked)} /> Smooth stroke</label>}
              </>}
              {tool === 'Shape brush' && <button type="button" className={control} onClick={fillMap}>Fill map</button>}
              {!isErasing && !paintsWater && terrainTexture && <>
                <button type="button" className={`${control} flex items-center gap-2`} aria-expanded={pickerOpen} onClick={() => setPickerOpen(open => !open)}>
                  <img src={terrainTexture.url} alt="" className="h-5 w-7 rounded object-cover" />
                  {terrainTexture.name}
                </button>
                {tool === 'Land brush' && <label className="flex items-center gap-1">
                  <input type="checkbox" checked={smartTerrain} onChange={event => setSmartTerrain(event.target.checked)} /> Smart Terrain Blending
                </label>}
                {!isSmartBrush && <label className="flex items-center gap-1"><input type="checkbox" checked={generateTerrain}
                  onChange={event => setGenerateTerrain(event.target.checked)} /> Generate relief</label>}
                <label className="flex items-center gap-2">{!isSmartBrush && generateTerrain ? 'Terrain scale' : 'Texture scale'}
                  <input type="range" min="25" max={isSmartBrush ? 400 : 250} value={isSmartBrush ? smartTextureScale : textureScale}
                    onChange={event => (isSmartBrush ? setSmartTextureScale : setTextureScale)(event.target.valueAsNumber)} />
                  <output>{isSmartBrush ? `${(smartTextureScale / 100).toFixed(2)}×` : `${textureScale}%`}</output>
                </label>
                {isSmartBrush && <>
                  {([['Hardness', 'hardness'], ['Blend Strength', 'strength'], ['Edge Noise', 'noise']] as const).map(([label, key]) => (
                    <label key={key} className="flex items-center gap-2">{label}
                      <input type="range" min="0" max="100" value={terrainBlend[key]}
                        onChange={event => setTerrainBlend({ ...terrainBlend, [key]: event.target.valueAsNumber })} />
                      <output>{terrainBlend[key]}%</output>
                    </label>
                  ))}
                  {([['Color Harmonization', 'harmonize'], ['Blend Relief', 'relief']] as const).map(([label, key]) => (
                    <label key={key} className="flex items-center gap-1">
                      <input type="checkbox" checked={terrainBlend[key]}
                        onChange={event => setTerrainBlend({ ...terrainBlend, [key]: event.target.checked })} /> {label}
                    </label>
                  ))}
                </>}
                <label className="flex items-center gap-2">Rotation
                  <input type="range" min="0" max="359" value={rotation} onChange={event => setRotation(Number(event.target.value))} />
                  <output>{rotation}°</output>
                </label>
              </>}
            </>}
            {atlasTool && atlasStyle && <>
              <label className="flex items-center gap-1">Draw
                <select className={control} value={pathMode} onChange={event => {
                  cancelPathStroke()
                  setPathMode(event.target.value === 'freehand' ? 'freehand' : 'points')
                }}>
                  <option value="points">Point to point</option>
                  <option value="freehand">Freehand</option>
                </select>
              </label>
              <AtlasPathControls key={atlasTool} id={atlasTool} control={control} tool={atlasTool} settings={atlasStyle}
                update={patch => setPathStyles(current => ({ ...current, [atlasTool]: { ...current[atlasTool], ...patch } }))} />
            </>}
            {pathTool && !freehand && <button type="button" className={control}
              disabled={points.length < (pathTool === 'Land' || (pathTool === 'Border' && (atlasStyle?.closed || atlasStyle?.fill)) ? 3 : 2)}
              onClick={() => addFeature(pathTool, points)}>Finish {pathTool.toLowerCase()}</button>}
            <span role="status" className="text-surface-400">{moving ? insertingPoint ? 'Click to insert a point in the closest segment.' : 'Click a new position.' : isErasing
              ? 'Drag to paint the map background over terrain.'
              : isPainting ? brushHint || (tool === 'Edge brush' ? 'Start at the shoreline and drag to refine it.' : tool === 'Shape brush' ? 'Drag to size your shape.' : paintsWater ? 'Drag over land to carve water.' : 'Drag to paint land.')
                : pathTool ? freehand ? 'Drag to draw the path.' : 'Click to place points.' : 'Click to place.'}</span>
            <button type="button" className={control} onClick={() => chooseTool('')}>Cancel</button>
          </div>
        )}
        {focused && isPainting && !paintsWater && pickerOpen && (
          <section aria-label="Terrain textures" className="studio-chapter-toolbar max-h-56 shrink-0 overflow-y-auto px-3 py-2">
            {recentTextures.length > 0 && <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold">Recent terrain</span>
              {recentTextures.map(name => <button key={name} type="button" className={control} onClick={() => { setTerrainName(name); setPickerOpen(false) }}>{name}</button>)}
            </div>}
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(8rem,1fr))]">
              {terrainTextures.map(({ name, url }) => (
                <button key={name} type="button" aria-pressed={terrainName === name}
                  onClick={() => { setTerrainName(name); setPickerOpen(false) }}
                  className={`${control} space-y-1 text-left ${terrainName === name ? '!border-current !text-[hsl(var(--brand-green))]' : ''}`}>
                  <img src={url} alt="" className="h-10 w-full rounded object-cover" />
                  <span className="block">{name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {canvas}
      </div>
      {focused && activeStampCategory && (
        <aside aria-label="Stamp assets" className="studio-chapter-toolbar flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-l border-[hsl(var(--studio-edge))] p-3">
          <h3 className="font-serif text-sm font-semibold">{activeStampCategory.label}</h3>
          {stampCategory === 'forests' && (
            <label className="grid gap-1 text-xs">Placement mode
              <select className={control} value={isScattering ? 'scatter' : 'single'}
                onChange={event => chooseTool(event.target.value === 'scatter' ? 'Forest scatter' : 'Forest')}>
                <option value="single">Single stamp</option>
                <option value="scatter">Forest scatter</option>
              </select>
            </label>
          )}
          {isScattering ? (
            <>
              <label className="flex items-center gap-2">Brush size
                <input type="range" min="20" max="480" value={brushSize} onChange={event => setBrushSize(event.target.valueAsNumber)} />
                <output>{brushSize}</output>
              </label>
              <label className="flex items-center gap-2">Density
                <input type="range" min="0" max="100" value={forestDensity} onChange={event => setForestDensity(event.target.valueAsNumber)} />
                <output>{forestDensity}%</output>
              </label>
              <label className="flex items-center gap-2">Size variation
                <input type="range" min="0" max="60" value={forestVariation} onChange={event => setForestVariation(event.target.valueAsNumber)} />
                <output>{forestVariation}%</output>
              </label>
              <p role="status" className="text-xs text-surface-400">{brushHint || 'Drag over land to scatter tree clusters.'}</p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {stampAssets.filter(asset => asset.category === stampCategory).map(asset => (
                  <button key={asset.id} type="button" aria-pressed={stampId === asset.id}
                    className={`${control} min-w-0 !bg-[#efe3c8] !text-[#392e1d] ${stampId === asset.id ? '!border-accent-600 ring-1 ring-accent-600' : ''}`}
                    onClick={() => setStampId(asset.id)}>
                    <img src={asset.url} alt="" className="mb-1 h-12 w-full object-contain" />
                    <span className="block text-left">{asset.label}</span>
                  </button>
                ))}
              </div>
              <label className="grid gap-1 text-xs">Stamp scale · {Math.round(stampScale * 100)}%
                <input type="range" min=".25" max="4" step=".05" value={stampScale} onChange={event => setStampScale(event.target.valueAsNumber)} />
              </label>
              <label className="grid gap-1 text-xs">Stamp opacity · {stampOpacity}%
                <input type="range" min="0" max="100" value={stampOpacity} onChange={event => setStampOpacity(event.target.valueAsNumber)} />
              </label>
              <label className="grid gap-1 text-xs">Place new stamps
                <select className={control} value={stampOrder}
                  onChange={event => setStampOrder(event.target.value as typeof stampOrder)}>
                  <option value="auto">Automatic by frame bottom</option>
                  <option value="front">In front of stamps</option>
                  <option value="back">Behind stamps</option>
                </select>
              </label>
              <p className="text-xs text-surface-400">{stampId ? 'Click the map to place copies. Press Esc to stop.' : 'Choose a stamp to place on the map.'}</p>
            </>
          )}
          <div className="flex flex-wrap gap-x-2 gap-y-1 border-t border-[hsl(var(--studio-edge))] pt-2 text-xs text-surface-400">
            <a className="underline" href={stampCredits.licenses} download="LICENSES.md">CC0 credits</a>
            <a className="underline" href={stampCredits.originalReadme} download="ORIGINAL_README.txt">Original README</a>
          </div>
        </aside>
      )}
      {focused && layersOpen && !stampCategory && (
        <aside className="studio-chapter-toolbar flex w-52 shrink-0 flex-col overflow-y-auto border-l border-[hsl(var(--studio-edge))] p-3" aria-label="Map layers">
          <h3 className="mb-3 font-serif text-sm font-semibold">Layers</h3>
          <div className="mb-3 grid gap-2 border-b border-[hsl(var(--studio-edge))] pb-3 text-xs">
            {hasImage && <label className="flex items-center gap-2"><input type="checkbox" checked={!hideImage} onChange={event => setHideImage(!event.target.checked)} /> Reference artwork</label>}
            <label className="flex items-center gap-2"><input type="checkbox" checked={!hidePins} onChange={event => setHidePins(!event.target.checked)} /> Location pins</label>
          </div>
          {selected && features && !atlasTool && (
            <div className="mb-3 grid gap-2 border-b border-[hsl(var(--studio-edge))] pb-3">
              <input key={`${selected.id}:${selected.name}`} aria-label="Layer item name" placeholder="Name" className={control} defaultValue={selected.name}
                onBlur={event => { if (event.target.value !== selected.name) update({ name: event.target.value }) }} maxLength={80}
                onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
              <button type="button" className={`${control} justify-self-start`} onClick={() => { chooseTool(''); setMoving(true) }}>Move</button>
              {selected.brush?.terrain && !selected.brush.subtract && !selected.brush.blend && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={Boolean(selected.brush.generated)} onChange={event => {
                    if (selected.brush) update({ brush: { ...selected.brush, generated: event.target.checked } })
                  }} />
                  Generate relief for layer
                </label>
              )}
              {isPath(selected.tool) && !selected.brush && (
                <select aria-label="Reshape point" className={control} value={vertex ?? ''} onChange={event => {
                  const value = event.target.value
                  chooseTool('')
                  setVertex(value === '' ? null : Number(value))
                  setMoving(value !== '')
                }}>
                  <option value="">Reshape point</option>
                  {selected.points.map((_, index) => <option key={index} value={index}>Point {index + 1}</option>)}
                </select>
              )}
              {selectedPath && selectedSettings && isAtlasPath(selectedPath.tool) && <>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={control} onClick={() => {
                    chooseTool('')
                    setInsertingPoint(true)
                    setMoving(true)
                  }}>Insert point</button>
                  {vertex !== null && <button type="button" className={control}
                    disabled={selectedPath.points.length <= (selectedPath.tool === 'Border' && (selectedSettings.closed || selectedSettings.fill) ? 3 : 2)}
                    onClick={() => {
                      update({ points: selectedPath.points.filter((_, index) => index !== vertex) })
                      setVertex(null)
                      setMoving(false)
                    }}>Delete point</button>}
                </div>
                <AtlasPathControls id={selectedPath.id} tool={selectedPath.tool} settings={selectedSettings}
                  canClose={selectedPath.points.length >= 3} control={control}
                  update={patch => update({ path: { ...selectedSettings, ...patch } })} />
              </>}
              {selected.tool === 'Stamp' && <>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className={control} onClick={() => reorderStamp('front')}>Bring to front</button>
                  <button type="button" className={control} onClick={() => reorderStamp('back')}>Send to back</button>
                  <button type="button" className={control} onClick={() => reorderStamp('auto')}>Automatic depth</button>
                </div>
                {([
                  ['Scale (%)', selected.size * 100, 25, 400, (value: number) => ({ size: value / 100 })],
                  ['Rotation (°)', selected.angle, -360, 360, (value: number) => ({ angle: value })],
                  ['Opacity (%)', (selected.opacity ?? 1) * 100, 0, 100, (value: number) => ({ opacity: value / 100 })],
                ] as const).map(([label, value, min, max, patch]) => (
                  <label key={label} className="flex items-center justify-between gap-2 text-xs">{label}
                    <input key={`${selected.id}:${value}`} className={`${control} w-20`} type="number" min={min} max={max}
                      defaultValue={Math.round(value)}
                      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
                      onBlur={event => {
                        const input = event.currentTarget
                        const next = Number.isFinite(input.valueAsNumber) ? Math.max(min, Math.min(max, input.valueAsNumber)) : value
                        input.value = String(next)
                        if (next !== value) update(patch(next))
                      }} />
                  </label>
                ))}
                <button type="button" className={`${control} justify-self-start`} onClick={() => {
                  const { x, y } = selected.points[0]
                  if (selected.stampId) saveStamp(selected.stampId, { x: x > .95 ? x - .025 : x + .025, y: y > .95 ? y - .025 : y + .025 }, selected)
                }}>Duplicate stamp</button>
              </>}
              {selected.tool !== 'Stamp' && !isPath(selected.tool) && <>
                <label className="text-xs">Size <input className={`${control} w-20`} type="number" min=".5" max="4" step=".25" value={selected.size}
                  onChange={event => {
                    if (Number.isFinite(event.target.valueAsNumber)) update({ size: Math.min(4, Math.max(.5, event.target.valueAsNumber)) })
                  }} /></label>
                <button type="button" className={control} onClick={() => update({ angle: (selected.angle + 15) % 360 })}>Rotate</button>
              </>}
            </div>
          )}
          {features?.length ? (
            <ul className="space-y-1">
              {features.map((feature, index) => ({ feature, index }))
                .sort((a, b) => (b.feature.addedOrder ?? b.index) - (a.feature.addedOrder ?? a.index))
                .map(({ feature, index }) => {
                const label = feature.name || `${feature.tool} ${index + 1}`
                return <li key={feature.id} className={`flex items-center gap-1 rounded-md px-1 ${selectedId === feature.id ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]' : ''}`}>
                  <input type="checkbox" aria-label={`Show ${label}`} checked={!feature.hidden}
                    onChange={event => save(features.map(item => item.id === feature.id ? { ...item, hidden: !event.target.checked } : item))} />
                  <button type="button" title={label} aria-pressed={selectedId === feature.id} className="min-w-0 flex-1 truncate rounded px-1 py-1.5 text-left text-xs"
                    onClick={() => selectLayer(feature.id)}>{label}</button>
                  <button type="button" title={`Delete ${label}`} aria-label={`Delete layer ${index + 1}: ${label}`}
                    className="shrink-0 rounded p-1.5 text-surface-500 hover:bg-danger-500/10 hover:text-danger-500 focus-visible:text-danger-500 disabled:opacity-50"
                    disabled={Boolean(draft)} onClick={() => deleteLayer(feature.id)}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              })}
            </ul>
          ) : <p className="text-xs text-surface-400">Draw or place an item to add a layer.</p>}
        </aside>
      )}
    </div>
  </>
}
