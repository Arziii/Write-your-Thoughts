import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import MapCanvas from './MapCanvas'
import type { MapPoint as Point } from './MapCanvas'
import MapDraftImportModal from './MapDraftImportModal'
import { getSeamlessTerrain } from './seamlessTerrain'
import type { TerrainTile } from './seamlessTerrain'
import { defaultTerrain, defaultWater, terrainTextures, waterTextures } from './terrainAssets'
import { makeProceduralBiomeTile, makeTerrainSurface, resolveTerrainName, terrainSurfaceKey } from './terrainSurface'
import TerrainBlendLayer from './TerrainBlendLayer'
import { coastDisplacementReach, coastDisplacementScale, coastTurbulenceFrequency, defaultTerrainBlend, terrainBrushPath as brushPath } from './terrainBlend'
import type { TerrainBrush as BrushStyle, TerrainShape as Shape, TerrainTextures } from './terrainBlend'
import { MapStamp, stampWidthFraction } from './MapStamp'
import { stampAssets, stampCategories, stampsById } from './mapStampAssets'
import AtlasPathLayer from './AtlasPathLayer'
import { atlasHeight, atlasWidth, clamp, isAtlasPath, nearestOnPath, pathDefaults, pathSettings,
  simplifyPath, spline, terrainFromName, toMap, toWorld } from './atlasPaths'
import type { AtlasPathSettings, AtlasPathTool, AtlasTerrain, WorldPoint } from './atlasPaths'
import MapTopBar from './MapTopBar'
import MapToolRail from './MapToolRail'
import MapInspector from './MapInspector'
import { computeScaleBar, disposeMapScale, formatDistance, loadMapScale, measurePathKm, measureSegmentKm, saveMapScale } from './mapScale'
import type { MapScaleConfig } from './mapScale'

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
export type MapFeature = Feature
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
  disposeMapScale(mapId)
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
  const displacement = coastDisplacementScale(brush.roughness)
  const reach = coastDisplacementReach(brush.roughness)
  const padding = (brush.shape ? 0 : brush.diameter / 2) + reach
  const xs = points.map(xAt)
  const ys = points.map(yAt)
  const filterLeft = Math.max(-32, Math.min(...xs) - padding)
  const filterTop = Math.max(-32, Math.min(...ys) - padding)
  const filterRight = Math.min(mapWidth + 32, Math.max(...xs) + padding)
  const filterBottom = Math.min(mapHeight + 32, Math.max(...ys) + padding)
  const width = Math.max(1, Math.max(...xs) - Math.min(...xs))
  const height = Math.max(1, Math.max(...ys) - Math.min(...ys))
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  let geometry
  if (brush.shape === 'Fill') geometry = <rect width={mapWidth} height={mapHeight} fill={color} />
  else if (brush.shape === 'Rectangle') geometry = <rect x={x} y={y} width={width} height={height} fill={color} />
  else if (brush.shape === 'Ellipse') geometry = <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} fill={color} />
  else if (brush.shape === 'Diamond') geometry = <polygon points={`${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}`} fill={color} />
  else if (brush.shape === 'Polygon') geometry = <polygon points={coordinatesFor(points)} fill={color} />
  else if (points.length === 1) geometry = <circle cx={xs[0]} cy={ys[0]} r={brush.diameter / 2} fill={color} />
  else geometry = <path d={brushPath(points, brush.smooth)} stroke={color} strokeWidth={brush.diameter} fill="none"
    strokeLinecap="round" strokeLinejoin={brush.smooth ? 'round' : 'bevel'} />

  const rough = brush.roughness > 0 && brush.shape !== 'Fill'
  return (
    <g opacity={opacity} filter={rough ? `url(#${filterId})` : undefined}>
      {rough && <defs>
        <filter id={filterId} filterUnits="userSpaceOnUse" x={filterLeft} y={filterTop}
          width={Math.max(1, filterRight - filterLeft)} height={Math.max(1, filterBottom - filterTop)}>
          <feTurbulence type="fractalNoise" baseFrequency={coastTurbulenceFrequency(brush.roughness)} numOctaves="4" seed="6" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={displacement}
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
  if (brush?.shape && brush.shape !== 'Polygon' && points.length === 2) {
    const [first, last] = points
    const x = Math.abs(2 * (point.x - (first.x + last.x) / 2) / (last.x - first.x))
    const y = Math.abs(2 * (point.y - (first.y + last.y) / 2) / (last.y - first.y))
    if (brush.shape === 'Ellipse') return x * x + y * y <= 1
    if (brush.shape === 'Diamond') return x + y <= 1
    return x <= 1 && y <= 1
  }
  if (brush && brush.shape !== 'Polygon') return strokeContains(points, brush.diameter, point)
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

type CanvasOptions = Pick<ComponentProps<typeof MapCanvas>, 'overlay' | 'brush' | 'placementPreview' | 'viewportOverlay'> & {
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
  const [tool, setTool] = useState<Tool | BrushTool | 'Ruler' | ''>('')
  const [mapScale, setMapScale] = useState<MapScaleConfig>(() => loadMapScale(mapId))
  const [measurePoints, setMeasurePoints] = useState<Point[]>([])
  const [brushSize, setBrushSize] = useState(100)
  const [forestDensity, setForestDensity] = useState(50)
  const [forestVariation, setForestVariation] = useState(40)
  const [roughness, setRoughness] = useState(8)
  const [smooth, setSmooth] = useState(true)
  const [opacity, setOpacity] = useState(100)
  const [terrainName, setTerrainName] = useState(defaultTerrain)
  const [waterName, setWaterName] = useState(defaultWater)
  const [textureScale, setTextureScale] = useState(100)
  const [smartTextureScale, setSmartTextureScale] = useState(100)
  const [smartTerrain, setSmartTerrain] = useState(true)
  const [terrainBlend, setTerrainBlend] = useState(defaultTerrainBlend)
  const [rotation, setRotation] = useState(0)
  const [generateTerrain, setGenerateTerrain] = useState(true)
  const [shape, setShape] = useState<Exclude<Shape, 'Fill' | 'Polygon'>>('Ellipse')
  const [subtract, setSubtract] = useState(false)
  const [biomeLock, setBiomeLock] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<'tool' | 'layers'>('layers')
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
  const [draftImportOpen, setDraftImportOpen] = useState(false)
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
  const atlasTool = isAtlasPath(tool) ? tool : null
  const atlasStyle = atlasTool ? pathStyles[atlasTool] : undefined
  const freehand = atlasTool !== null && pathMode === 'freehand'
  const stampCategory = tool === 'Mountain' ? 'mountains' : (tool === 'Forest' || tool === 'Forest scatter') ? 'forests' : tool === 'Town' ? 'settlements' : null
  const activeStampCategory = stampCategories.find(category => category.id === stampCategory)
  const isPainting = isBrush(tool)
  const isScattering = tool === 'Forest scatter'
  const isErasing = tool === 'Eraser brush'
  const paintsWater = isErasing || tool === 'Water brush' || (((tool === 'Land brush' && !biomeLock) || tool === 'Shape brush' || tool === 'Edge brush') && subtract)
  const isSmartBrush = tool === 'Land brush' && !paintsWater && smartTerrain
  const recentTextures = [...new Set((features ?? []).flatMap(feature => feature.brush?.terrain ? [resolveTerrainName(feature.brush.terrain)] : []).reverse())].slice(0, 5)
  const hasTerrain = features !== null
  const textureKeys = JSON.stringify([...new Set([resolveTerrainName(terrainName), waterName, ...(features ?? []).flatMap(feature => [
    ...(!feature.hidden && feature.brush?.terrain ? [resolveTerrainName(feature.brush.terrain)] : []),
    ...(!feature.hidden && feature.brush?.water ? [feature.brush.water] : []),
  ])])].filter(Boolean).sort())
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
    const biomeUpdates: TerrainTextures = {}
    for (const { name } of terrainTextures) {
      if (!needed.has(name)) continue
      biomeUpdates[name] = makeProceduralBiomeTile(name)
    }
    if (Object.keys(biomeUpdates).length) {
      setSeamlessTiles(current => {
        const changed = Object.entries(biomeUpdates).some(([name, tile]) => current[name] !== tile)
        return changed ? { ...current, ...biomeUpdates } : current
      })
    }
    for (const { name, url } of waterTextures) {
      if (!needed.has(name)) continue
      getSeamlessTerrain(url).then(tile => {
        if (active) setSeamlessTiles(current => current[name] === tile ? current : { ...current, [name]: tile })
      }).catch(error => console.error('Could not prepare water texture:', name, error))
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

  function nextNumberedName(base: string) {
    const clean = base.trim()
    const existing = features ?? []
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matcher = new RegExp(`^${escaped}(?: (\\d+))?$`)
    let maxNum = 0
    for (const item of existing) {
      const m = item.name.match(matcher)
      if (m) maxNum = Math.max(maxNum, m[1] ? Number(m[1]) : 1)
    }
    return `${clean} ${maxNum + 1}`
  }

  function updateMapScale(patch: Partial<MapScaleConfig>) {
    setMapScale(current => {
      const next = { ...current, ...patch }
      saveMapScale(mapId, next)
      return next
    })
  }

  useEffect(() => {
    setMapScale(loadMapScale(mapId))
    setMeasurePoints([])
  }, [mapId])

  function chooseTool(next: typeof tool) {
    beforeDrawing()
    cancelStroke()
    setTool(next)
    if (next !== 'Ruler') setMeasurePoints([])
    setStampId('')
    setBrushHint('')
    if (next) {
      setInspectorTab('tool')
      setLayersOpen(true)
    }
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
    if (id) {
      setInspectorTab('layers')
      setLayersOpen(true)
    }
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
      if (draftImportOpen) return
      const target = event.target
      if (event.defaultPrevented || (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]'))) return
      if (event.key === 'Escape') {
        if (tool === 'Ruler' && measurePoints.length > 0) {
          setMeasurePoints([])
        } else if (tool || moving || stampId) {
          chooseTool('')
          setInspectorTab('layers')
        } else exit()
      } else if (event.key === 'Backspace' && tool === 'Ruler' && measurePoints.length > 0) {
        event.preventDefault()
        setMeasurePoints(current => current.slice(0, -1))
      } else if ((event.ctrlKey || event.metaKey) && !event.altKey && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        if (stroke.current || pathStroke.current) return
        if (event.shiftKey || event.key.toLowerCase() === 'y') redo()
        else undo()
      } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const key = event.key.toLowerCase()
        if (key === 'v') { chooseTool(''); setInspectorTab('layers') }
        else if (key === 'r') chooseTool('Ruler')
        else if (key === 'b') chooseTool('Land brush')
        else if (key === 'w') chooseTool('Water brush')
        else if (key === 'e') chooseTool('Eraser brush')
        else if (key === 't') chooseTool('Label')
        else if (key === 'x' && (tool === 'Land brush' || tool === 'Shape brush' || tool === 'Edge brush')) {
          event.preventDefault()
          if (tool === 'Land brush' && biomeLock) {
            setBiomeLock(false)
            setSubtract(true)
          } else {
            setSubtract(current => !current)
          }
        }
        else if (key === '[' || key === ']') {
          const delta = key === '[' ? -20 : 20
          if (isPainting) {
            event.preventDefault()
            setBrushSize(size => Math.max(20, Math.min(640, size + delta)))
          } else if (stampCategory) {
            event.preventDefault()
            setStampScale(scale => Number(Math.max(0.25, Math.min(4, scale + (key === '[' ? -0.15 : 0.15))).toFixed(2)))
          }
        }
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
    const baseName = type === 'Label' ? 'New label' : type === 'Route' ? 'Road / route' : path ? type : type
    const name = type === 'Label' ? baseName : nextNumberedName(baseName)
    if (save([...features, { id, tool: type, points: geometry, name, size: 1, angle: 0, path }])) {
      chooseTool('')
      setSelectedId(id)
      if (path) {
        setInspectorTab('layers')
        setLayersOpen(true)
      }
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
    const isWaterBrush = tool === 'Water brush'
    const activeWater = isWaterBrush && waterName ? waterName : undefined
    const clipLand = tool === 'Land brush' && biomeLock && !paintsWater
    const rawName = isErasing ? 'Background stroke' : strokeShape === 'Fill' ? 'Map fill' : tool === 'Edge brush' ? 'Coastline stroke' : activeWater ? activeWater : paintsWater ? 'Carve water' : terrainName
    return {
      id: crypto.randomUUID(), tool: 'Land', points: [point],
      name: nextNumberedName(rawName),
      size: 1, angle: 0,
      brush: { diameter: brushSize, roughness: isErasing ? 0 : roughness, smooth: isErasing || smooth,
        subtract: paintsWater, clipToLand: clipLand || undefined, water: activeWater, eraser: isErasing || undefined,
        opacity: isErasing ? 1 : (isSmartBrush ? opacity : Math.max(5, opacity)) / 100,
        terrain: paintsWater ? undefined : terrainName, generated: !isSmartBrush && !paintsWater && generateTerrain,
        textureScale: isSmartBrush ? smartTextureScale : textureScale, rotation, shape: strokeShape,
        blend: isSmartBrush ? { ...terrainBlend } : undefined },
    }
  }

  function startStroke(point: Point) {
    if (!features || (isSmartBrush && opacity === 0)) return
    if (tool === 'Edge brush' && !nearCoast(point, brushSize, terrainMaskForHitTest)) {
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
          const land = terrainMaskForHitTest.find(feature => touchesPoint(feature, point))
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
  const committedLandMask = useMemo(() => committedTerrain.filter(feature => !feature.brush?.clipToLand), [committedTerrain])
  const terrainMaskForHitTest = useMemo(() => [...committedLandMask].reverse(), [committedLandMask])
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
      const mapPoint = toMap(world)
      const maskLand = terrainMaskForHitTest.find(feature => touchesPoint(feature, mapPoint))
      let style: AtlasTerrain = 'dirt'
      if (maskLand?.brush?.subtract || (!maskLand && (!hasImage || (focused && hideImage)))) style = 'water'
      else if (settlements.some(({ point, radius }) => distanceFrom(point) < Math.max(27, radius))) style = 'cobblestone'
      else {
        const terrain = terrainForHitTest.find(feature => !feature.brush?.subtract && touchesPoint(feature, mapPoint))
        style = terrainFromName(terrain?.brush?.terrain)
        if (style === 'dirt' || style === 'gravel') {
          const nearby = surroundings.find(({ point, radius }) => distanceFrom(point) < radius)
          if (nearby) style = nearby.style
        }
      }
      cache.set(key, style)
      return style
    }
  }, [shown, terrainForHitTest, terrainMaskForHitTest, hasImage, focused, hideImage])
  const terrainDraft = draft && !isScattering && (!draft.brush?.shape || draft.points.length > 1) ? draft : null
  const smartCompositing = Boolean(terrainDraft?.brush?.blend) || committedTerrain.some(feature => feature.brush?.blend)
  const terrain = terrainDraft
    ? [...committedTerrain, terrainDraft]
    : committedTerrain
  const paintedTerrain = smartCompositing ? [] : terrain.flatMap(feature => {
    if (!feature.brush?.terrain) return []
    const resolved = resolveTerrainName(feature.brush.terrain)
    const asset = terrainTextures.find(texture => texture.name === resolved)
    return asset ? [{ feature, asset, brush: feature.brush }] : []
  })
  const paintedWater = terrain.flatMap((feature, index) => {
    const asset = waterTextures.find(item => item.name === feature.brush?.water)
    if (!asset || !feature.brush?.subtract) return []
    const erasersAfter = terrain.slice(index + 1).filter(other => other.brush?.eraser)
    return [{ feature, asset, brush: feature.brush, erasersAfter }]
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
  const terrainGeometry = (feature: Feature, filterPrefix: string) => feature.brush?.clipToLand ? null : (
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
          <stop offset="0%" stopColor="#357b9e" />
          <stop offset="55%" stopColor="#225b80" />
          <stop offset="100%" stopColor="#163f5e" />
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
            <feFlood floodColor="#7ad1df" floodOpacity=".58" result="waterColor" />
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
        {paintedWater.map(({ feature, asset, brush, erasersAfter }) => {
          const tile = seamlessTiles[asset.name]
          const width = 360 * (brush.textureScale ?? 100) / 100
          const height = width * (tile ? tile.pixels.height / tile.pixels.width : 1)
          return <g key={`water-def-${feature.id}`}>
            <pattern id={`${elementId}-water-tex-${feature.id}`} width={width} height={height}
              patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse"
              patternTransform={`rotate(${brush.rotation ?? 0})`}>
              <image href={tile?.url ?? asset.url} width={width} height={height} preserveAspectRatio="none" />
            </pattern>
            <mask id={`${elementId}-water-mask-${feature.id}`} maskUnits="userSpaceOnUse" x="0" y="0"
              width={mapWidth} height={mapHeight} style={{ maskType: 'alpha' }}>
              <g mask={eraseMask(feature, filters)}>
                <g filter={`url(#${feather})`}>
                  <BrushShape feature={feature} filters={`${filters}-water`} color="white" />
                </g>
              </g>
            </mask>
            {erasersAfter.length > 0 && (
              <mask id={`${elementId}-water-erase-${feature.id}`} maskUnits="userSpaceOnUse" x="0" y="0"
                width={mapWidth} height={mapHeight} style={{ maskType: 'luminance' }}>
                <rect width={mapWidth} height={mapHeight} fill="white" />
                {erasersAfter.map(eraser => (
                  <BrushShape key={eraser.id} feature={eraser} filters={`${filters}-water-erase`} color="black" />
                ))}
              </mask>
            )}
          </g>
        })}
      </defs>
      {showWater && <>
        <rect width={mapWidth} height={mapHeight} fill={`url(#${elementId}-water)`} />
        <rect width={mapWidth} height={mapHeight} filter={`url(#${texture})`} opacity=".18" style={{ mixBlendMode: 'multiply' }} />
      </>}
      {paintedWater.map(({ feature, brush, erasersAfter }) => (
        <g key={`water-${feature.id}`} mask={erasersAfter.length ? `url(#${elementId}-water-erase-${feature.id})` : undefined}>
          <rect
            width={mapWidth}
            height={mapHeight}
            fill={`url(#${elementId}-water-tex-${feature.id})`}
            mask={`url(#${elementId}-water-mask-${feature.id})`}
            opacity={(brush.opacity ?? 1) * (showWater ? 1 : 0.72)}
          />
        </g>
      ))}
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
  } : tool === 'Ruler' ? (point: Point) => setMeasurePoints(current => [...current, point])
    : stampId ? (point: Point) => saveStamp(stampId, point)
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
  const previewAsset = focused && stampId ? stampsById.get(stampId) : undefined
  const measured = useMemo(() => measurePathKm(measurePoints, mapScale.widthKm, mapWidth / mapHeight), [measurePoints, mapScale.widthKm])
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
        {focused && !tool && selected && isAtlasPath(selected.tool) && selected.points.map((point, index) => <circle key={index} cx={xAt(point)} cy={yAt(point)}
          r="3.5" fill="#f9eed7" stroke={ink} strokeWidth="1.25" />)}
        {focused && activeVertex && <circle cx={xAt(activeVertex)} cy={yAt(activeVertex)} r="8" fill="white" stroke={ink} strokeWidth="3" />}
        {focused && tool === 'Ruler' && measurePoints.length > 0 && (
          <g>
            {measurePoints.length > 1 && (
              <>
                <polyline points={coordinatesFor(measurePoints)} fill="none" stroke="#1f1b16" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity=".75" />
                <polyline points={coordinatesFor(measurePoints)} fill="none" stroke="#f6d365" strokeWidth="4" strokeDasharray="18 10" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
            {measured.segmentsKm.map((segKm, index) => {
              const a = measurePoints[index]
              const b = measurePoints[index + 1]
              const mx = (xAt(a) + xAt(b)) / 2
              const my = (yAt(a) + yAt(b)) / 2
              const text = formatDistance(segKm, mapScale.unit)
              const pillW = Math.max(96, text.length * 14 + 28)
              return (
                <g key={`seg-${index}`} transform={`translate(${mx},${my})`}>
                  <rect x={-pillW / 2} y="-17" width={pillW} height="34" rx="17" fill="#1f1b16" fillOpacity=".86" stroke="#f6d365" strokeWidth="2" />
                  <text y="6" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="20" fontWeight="600" fill="#fef3c7">{text}</text>
                </g>
              )
            })}
            {measurePoints.map((point, index) => (
              <g key={`pt-${index}`} transform={`translate(${xAt(point)},${yAt(point)})`}>
                <circle r="13" fill="#1f1b16" stroke="#f6d365" strokeWidth="3.5" />
                <text y="5" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="16" fontWeight="700" fill="#fef3c7">{index + 1}</text>
              </g>
            ))}
          </g>
        )}
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
    ) : focused && tool === 'Ruler' ? point => {
      const lastPoint = measurePoints[measurePoints.length - 1]
      const liveSegKm = lastPoint ? measureSegmentKm(lastPoint, point, mapScale.widthKm, mapWidth / mapHeight) : 0
      const runningKm = measured.totalKm + liveSegKm
      return (
        <>
          {lastPoint && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${mapWidth} ${mapHeight}`} preserveAspectRatio="none">
              <line
                x1={xAt(lastPoint)} y1={yAt(lastPoint)}
                x2={xAt(point)} y2={yAt(point)}
                stroke="#f6d365" strokeWidth="3.5" strokeDasharray="12 10" strokeLinecap="round" opacity=".9"
              />
            </svg>
          )}
          {lastPoint && (
            <div
              className="pointer-events-none absolute z-30 -translate-x-1/2 translate-y-3 whitespace-nowrap rounded-full border border-[#f6d365]/60 bg-[#1f1b16]/90 px-2.5 py-1 text-[11px] font-medium tabular-nums text-[#fef3c7] shadow-lg"
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            >
              +{formatDistance(liveSegKm, mapScale.unit)}
              {measurePoints.length > 1 ? ` · Total ${formatDistance(runningKm, mapScale.unit)}` : ''}
            </div>
          )}
        </>
      )
    } : undefined,
    viewportOverlay: mapScale.showScaleBar ? metrics => {
      const bar = computeScaleBar(metrics.width, mapScale.widthKm, mapScale.unit)
      return (
        <div
          className="pointer-events-none absolute bottom-4 left-4 flex flex-col gap-1 rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper)/0.92)] px-2.5 py-1.5 shadow-md backdrop-blur-sm"
          aria-label={`Map scale bar: ${bar.label}`}
        >
          <div className="flex items-center justify-between text-[10px] font-medium tabular-nums text-surface-300" style={{ width: bar.pixelWidth }}>
            <span>0</span>
            <span>{bar.halfLabel}</span>
            <span>{bar.label}</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-sm border border-[hsl(var(--studio-edge))]" style={{ width: bar.pixelWidth }}>
            <span className="h-full flex-1 bg-surface-200" />
            <span className="h-full flex-1 bg-surface-950" />
          </div>
        </div>
      )
    } : undefined,
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
    {focused ? (
      <MapTopBar
        exitButtonRef={exitButton}
        mapName={mapName}
        canUndo={Boolean(past.length && !draft && !pathStroke.current)}
        canRedo={Boolean(future.length && !draft && !pathStroke.current)}
        inspectorOpen={layersOpen}
        error={error}
        onExit={exit}
        onUndo={undo}
        onRedo={redo}
        onToggleInspector={() => setLayersOpen(current => !current)}
        onOpenDraftImport={() => setDraftImportOpen(true)}
      />
    ) : (
      <div className="studio-chapter-toolbar flex h-10 shrink-0 flex-wrap items-center gap-2 px-3">
        {viewerControls}
        <button type="button" className={`${control} inline-flex items-center gap-1.5`}
          onClick={() => { if (features || persist([])) setDraftImportOpen(true) }}>
          <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" aria-hidden="true" />
          Draft to Map
        </button>
        <button ref={enterButton} type="button" className={`${control} !bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]`}
          onClick={() => { if (features || persist([])) { chooseTool(''); onEdit() } }}>Edit map</button>
        {error && <span role="alert" className="text-xs text-danger-500">{error}</span>}
      </div>
    )}

    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {focused && (
        <MapToolRail
          activeTool={tool}
          isScattering={isScattering}
          moving={moving}
          onSelectTool={value => {
            chooseTool(value)
            if (value) {
              setLayersOpen(true)
              setInspectorTab('tool')
            }
          }}
        />
      )}

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {focused && (pathTool || moving || tool) && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper)/0.95)] px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
            <span role="status" className="pointer-events-auto truncate text-surface-300">
              {moving
                ? insertingPoint
                  ? 'Click segment to insert point'
                  : 'Click new position'
                : isErasing
                  ? 'Drag to paint background over terrain'
                  : isScattering
                    ? brushHint || 'Drag over land to scatter trees'
                    : isPainting
                      ? brushHint || (tool === 'Edge brush' ? 'Drag from shoreline to refine edge' : tool === 'Shape brush' ? 'Drag to size shape' : paintsWater ? 'Drag to paint water or carve coastline' : biomeLock ? 'Drag over land to paint biome' : 'Drag to paint land')
                      : tool === 'Ruler'
                        ? measurePoints.length > 1
                          ? `Measured: ${formatDistance(measured.totalKm, mapScale.unit)}`
                          : measurePoints.length === 1
                            ? 'Click next point on map'
                            : 'Click point A on map to measure'
                        : pathTool
                          ? freehand
                            ? 'Drag to draw path'
                            : 'Click map to place path points'
                          : stampCategory
                            ? stampId ? 'Click map to place stamp' : 'Select a stamp on the right'
                            : 'Click map to place'}
            </span>
            {tool === 'Ruler' && measurePoints.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setMeasurePoints(current => current.slice(0, -1))}
                  className="pointer-events-auto shrink-0 rounded-full border border-[hsl(var(--studio-edge))] px-2 py-0.5 text-[11px] text-surface-300 hover:bg-surface-850 hover:text-surface-100"
                >
                  Undo point
                </button>
                <button
                  type="button"
                  onClick={() => setMeasurePoints([])}
                  className="pointer-events-auto shrink-0 rounded-full border border-[hsl(var(--studio-edge))] px-2 py-0.5 text-[11px] text-surface-300 hover:bg-surface-850 hover:text-surface-100"
                >
                  Clear
                </button>
              </>
            )}
            {(tool === 'Land brush' || tool === 'Shape brush' || tool === 'Edge brush') && !(tool === 'Land brush' && biomeLock) && (
              <button
                type="button"
                onClick={() => setSubtract(current => !current)}
                title="Toggle Add / Carve (X)"
                className="pointer-events-auto shrink-0 rounded-full border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-2.5 py-0.5 text-[11px] font-medium text-surface-200 hover:bg-surface-850"
              >
                {subtract ? 'Carving water (X)' : 'Adding land (X)'}
              </button>
            )}
            {pathTool && !freehand && (
              <button
                type="button"
                className="pointer-events-auto shrink-0 rounded-full bg-[hsl(var(--brand-green))] px-2.5 py-0.5 text-[11px] font-medium text-white dark:text-surface-950 disabled:opacity-45"
                disabled={points.length < (pathTool === 'Land' || (pathTool === 'Border' && (atlasStyle?.closed || atlasStyle?.fill)) ? 3 : 2)}
                onClick={() => addFeature(pathTool, points)}
              >
                Finish {pathTool.toLowerCase()}
              </button>
            )}
            <button
              type="button"
              className="pointer-events-auto shrink-0 rounded-full border border-[hsl(var(--studio-edge))] px-2 py-0.5 text-[11px] text-surface-300 hover:bg-surface-850 hover:text-surface-100"
              onClick={() => chooseTool('')}
            >
              Done
            </button>
          </div>
        )}
        {canvas}
      </div>

      {focused && layersOpen && (
        <MapInspector
          inspectorTab={inspectorTab}
          onTabChange={setInspectorTab}
          tool={tool}
          chooseTool={chooseTool}
          isPainting={isPainting}
          isScattering={isScattering}
          isErasing={isErasing}
          isSmartBrush={isSmartBrush}
          paintsWater={paintsWater}
          moving={moving}
          setMoving={setMoving}
          insertingPoint={insertingPoint}
          setInsertingPoint={setInsertingPoint}
          vertex={vertex}
          setVertex={setVertex}
          subtract={subtract}
          setSubtract={setSubtract}
          biomeLock={biomeLock}
          setBiomeLock={setBiomeLock}
          shape={shape}
          setShape={setShape}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          opacity={opacity}
          setOpacity={setOpacity}
          roughness={roughness}
          setRoughness={setRoughness}
          smooth={smooth}
          setSmooth={setSmooth}
          smartTerrain={smartTerrain}
          setSmartTerrain={setSmartTerrain}
          generateTerrain={generateTerrain}
          setGenerateTerrain={setGenerateTerrain}
          smartTextureScale={smartTextureScale}
          setSmartTextureScale={setSmartTextureScale}
          textureScale={textureScale}
          setTextureScale={setTextureScale}
          terrainBlend={terrainBlend}
          setTerrainBlend={setTerrainBlend}
          rotation={rotation}
          setRotation={setRotation}
          terrainName={terrainName}
          setTerrainName={setTerrainName}
          waterName={waterName}
          setWaterName={setWaterName}
          recentTextures={recentTextures}
          fillMap={fillMap}
          forestDensity={forestDensity}
          setForestDensity={setForestDensity}
          forestVariation={forestVariation}
          setForestVariation={setForestVariation}
          brushHint={brushHint}
          stampCategory={stampCategory}
          activeStampCategory={activeStampCategory}
          stampId={stampId}
          setStampId={setStampId}
          stampScale={stampScale}
          setStampScale={setStampScale}
          stampOpacity={stampOpacity}
          setStampOpacity={setStampOpacity}
          stampOrder={stampOrder}
          setStampOrder={setStampOrder}
          atlasTool={atlasTool}
          atlasStyle={atlasStyle}
          pathMode={pathMode}
          setPathMode={setPathMode}
          cancelPathStroke={cancelPathStroke}
          updatePathStyle={(targetTool, patch) => setPathStyles(current => ({ ...current, [targetTool]: { ...current[targetTool], ...patch } }))}
          hasImage={hasImage}
          hideImage={hideImage}
          setHideImage={setHideImage}
          hidePins={hidePins}
          setHidePins={setHidePins}
          features={features}
          selected={selected}
          selectedId={selectedId}
          selectLayer={selectLayer}
          toggleLayerVisibility={(id, visible) => {
            if (features) save(features.map(item => item.id === id ? { ...item, hidden: !visible } : item))
          }}
          deleteLayer={deleteLayer}
          updateFeature={update}
          reorderStamp={reorderStamp}
          duplicateSelectedStamp={() => {
            if (!selected || !selected.stampId) return
            const { x, y } = selected.points[0]
            saveStamp(selected.stampId, { x: x > .95 ? x - .025 : x + .025, y: y > .95 ? y - .025 : y + .025 }, selected)
          }}
          draftActive={Boolean(draft)}
          mapScale={mapScale}
          updateMapScale={updateMapScale}
          measurePoints={measurePoints}
          onUndoMeasurePoint={() => setMeasurePoints(current => current.slice(0, -1))}
          onClearMeasure={() => setMeasurePoints([])}
        />
      )}
    </div>

    <MapDraftImportModal
      isOpen={draftImportOpen}
      hasExistingLayers={Boolean(features?.length)}
      onClose={() => setDraftImportOpen(false)}
      onApply={(generated, mode, suggestedWidthKm) => {
        const baseFeatures = features ?? []
        const nextFeatures = mode === 'replace' ? generated : [...baseFeatures, ...generated]
        if (save(nextFeatures)) {
          if (suggestedWidthKm) updateMapScale({ widthKm: suggestedWidthKm })
          chooseTool('')
          setInspectorTab('layers')
          setLayersOpen(true)
          setDraftImportOpen(false)
          if (!focused) onEdit()
        }
      }}
    />
  </>
}
