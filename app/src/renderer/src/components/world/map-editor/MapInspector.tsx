import { BoxSelect, Droplets, Eye, EyeOff, Globe, Layers, Mountain, Pentagon, RotateCcw, Route, Ruler, Shapes, Sliders, Trash2, Trees, Type, Warehouse } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../../../utils'
import { Switch } from '../../ui/primitives'
import AtlasPathControls from './AtlasPathControls'
import { isAtlasPath, pathSettings } from './atlasPaths'
import type { AtlasPathSettings, AtlasPathTool } from './atlasPaths'
import { stampAssets, stampCategories, stampCredits, stampsById } from './mapStampAssets'
import { resolveTerrainName, terrainTextures, waterTextures } from './terrainAssets'
import { MAX_ROUGHNESS } from './terrainBlend'
import type { TerrainBlendSettings, TerrainShape as Shape } from './terrainBlend'
import type { MapPoint } from './MapCanvas'
import {
  MAP_SCALE_PRESETS,
  UNIT_LABEL,
  calibrateWidthKm,
  estimateTravelTimes,
  formatDistance,
  formatNumber,
  fromKm,
  measurePathKm,
  toKm,
} from './mapScale'
import type { MapDistanceUnit, MapScaleConfig } from './mapScale'

export type InspectorFeature = {
  id: string
  tool: string
  points: MapPoint[]
  name: string
  size: number
  angle: number
  hidden?: boolean
  brush?: {
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
    shape?: Shape
    blend?: TerrainBlendSettings
  }
  stampId?: string
  opacity?: number
  addedOrder?: number
  stampOrder?: 'auto' | 'front' | 'back'
  path?: Partial<AtlasPathSettings>
}

interface MapInspectorProps {
  inspectorTab: 'tool' | 'layers'
  onTabChange: (tab: 'tool' | 'layers') => void
  tool: string
  chooseTool: (next: any) => void
  isPainting: boolean
  isScattering: boolean
  isErasing: boolean
  isSmartBrush: boolean
  paintsWater: boolean
  moving: boolean
  setMoving: (moving: boolean) => void
  insertingPoint: boolean
  setInsertingPoint: (inserting: boolean) => void
  vertex: number | null
  setVertex: (vertex: number | null) => void
  subtract: boolean
  setSubtract: (subtract: boolean) => void
  biomeLock: boolean
  setBiomeLock: (lock: boolean) => void
  shape: Exclude<Shape, 'Fill' | 'Polygon'>
  setShape: (shape: Exclude<Shape, 'Fill' | 'Polygon'>) => void
  brushSize: number
  setBrushSize: (size: number) => void
  opacity: number
  setOpacity: (opacity: number) => void
  roughness: number
  setRoughness: (roughness: number) => void
  smooth: boolean
  setSmooth: (smooth: boolean) => void
  smartTerrain: boolean
  setSmartTerrain: (smart: boolean) => void
  generateTerrain: boolean
  setGenerateTerrain: (gen: boolean) => void
  smartTextureScale: number
  setSmartTextureScale: (scale: number) => void
  textureScale: number
  setTextureScale: (scale: number) => void
  terrainBlend: TerrainBlendSettings
  setTerrainBlend: (blend: TerrainBlendSettings) => void
  rotation: number
  setRotation: (rotation: number) => void
  terrainName: string
  setTerrainName: (name: string) => void
  waterName: string
  setWaterName: (name: string) => void
  recentTextures: string[]
  fillMap: () => void
  forestDensity: number
  setForestDensity: (density: number) => void
  forestVariation: number
  setForestVariation: (variation: number) => void
  brushHint: string
  stampCategory: string | null
  activeStampCategory?: { id: string; label: string }
  stampId: string
  setStampId: (id: string) => void
  stampScale: number
  setStampScale: (scale: number) => void
  stampOpacity: number
  setStampOpacity: (opacity: number) => void
  stampOrder: 'auto' | 'front' | 'back'
  setStampOrder: (order: 'auto' | 'front' | 'back') => void
  atlasTool: AtlasPathTool | null
  atlasStyle?: AtlasPathSettings
  pathMode: 'points' | 'freehand'
  setPathMode: (mode: 'points' | 'freehand') => void
  cancelPathStroke: () => void
  updatePathStyle: (tool: AtlasPathTool, patch: Partial<AtlasPathSettings>) => void
  hasImage: boolean
  hideImage: boolean
  setHideImage: (hide: boolean) => void
  hidePins: boolean
  setHidePins: (hide: boolean) => void
  features: InspectorFeature[] | null
  selected: InspectorFeature | undefined
  selectedId: string
  selectLayer: (id: string) => void
  toggleLayerVisibility: (id: string, visible: boolean) => void
  deleteLayer: (id: string) => void
  updateFeature: (patch: Partial<InspectorFeature>) => void
  reorderStamp: (direction: 'auto' | 'front' | 'back') => void
  duplicateSelectedStamp: () => void
  draftActive: boolean
  mapScale: MapScaleConfig
  updateMapScale: (patch: Partial<MapScaleConfig>) => void
  measurePoints: MapPoint[]
  onUndoMeasurePoint: () => void
  onClearMeasure: () => void
}

const controlClass =
  'rounded-md border border-[hsl(var(--studio-edge))] bg-surface-950 px-2 py-1 text-xs text-surface-100 focus:border-[hsl(var(--brand-green))] focus:outline-none disabled:opacity-50'

function LayerThumbnail({ feature }: { feature: InspectorFeature }) {
  if (feature.stampId) {
    const asset = stampsById.get(feature.stampId)
    if (asset) {
      return <img src={asset.url} alt="" className="h-4 w-4 shrink-0 rounded-sm bg-[#efe3c8] object-contain p-0.5" />
    }
  }
  if (feature.brush) {
    if (feature.brush.subtract) {
      const waterTile = feature.brush.water ? waterTextures.find(t => t.name === feature.brush?.water) : undefined
      if (waterTile) {
        return <img src={waterTile.url} alt="" className="h-4 w-4 shrink-0 rounded-sm border border-[hsl(var(--studio-edge))] object-cover" />
      }
      return <span className="h-4 w-4 shrink-0 rounded-sm border border-[hsl(var(--studio-edge))] bg-[#225b80]" aria-hidden="true" />
    }
    const tile = terrainTextures.find(t => t.name === resolveTerrainName(feature.brush?.terrain))
    if (tile) {
      return <img src={tile.url} alt="" className="h-4 w-4 shrink-0 rounded-sm border border-[hsl(var(--studio-edge))] object-cover" />
    }
    return <span className="h-4 w-4 shrink-0 rounded-sm border border-[hsl(var(--studio-edge))] bg-[#c2ab74]" aria-hidden="true" />
  }
  const Icon =
    feature.tool === 'River' ? Droplets
      : feature.tool === 'Route' ? Route
        : feature.tool === 'Border' ? BoxSelect
          : feature.tool === 'Land' ? Pentagon
            : feature.tool === 'Label' ? Type
              : feature.tool === 'Mountain' ? Mountain
                : feature.tool === 'Forest' ? Trees
                  : feature.tool === 'Town' ? Warehouse
                    : Shapes
  return <Icon className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--brand-green))]" aria-hidden="true" />
}

const brushSizePresets = [
  { label: 'S', value: 48, dot: 'h-1.5 w-1.5' },
  { label: 'M', value: 120, dot: 'h-2.5 w-2.5' },
  { label: 'L', value: 240, dot: 'h-3.5 w-3.5' },
  { label: 'XL', value: 420, dot: 'h-4 w-4' },
] as const

function BrushSizePresets({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-1.5" role="group" aria-label="Brush size presets">
      {brushSizePresets.map(preset => {
        const active = value === preset.value
        return (
          <button
            key={preset.label}
            type="button"
            title={`${preset.label} (${preset.value}px)`}
            aria-label={`Size ${preset.label} (${preset.value})`}
            aria-pressed={active}
            onClick={() => onChange(preset.value)}
            className={cn(
              'flex h-7 flex-1 items-center justify-center rounded-md border transition-colors',
              active
                ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                : 'border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] text-surface-400 hover:bg-surface-850 hover:text-surface-100'
            )}
          >
            <span className={cn('rounded-full bg-current', preset.dot)} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

const roughnessPresets = [
  { label: 'Smooth', value: 0 },
  { label: 'Gentle', value: 8 },
  { label: 'Natural', value: 20 },
  { label: 'Rugged', value: 36 },
] as const

function RoughnessControl({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span>Roughness</span>
        <output className="tabular-nums">{value}</output>
      </div>
      <div className="grid grid-cols-4 gap-1" role="group" aria-label="Roughness presets">
        {roughnessPresets.map(preset => {
          const active = value === preset.value
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(preset.value)}
              className={cn(
                'rounded border py-1 text-[10px] font-medium transition-colors',
                active
                  ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                  : 'border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] text-surface-400 hover:bg-surface-850 hover:text-surface-100'
              )}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
      <input
        type="range"
        min="0"
        max={MAX_ROUGHNESS}
        value={value}
        aria-label="Roughness"
        onChange={event => onChange(Number(event.target.value))}
        className="w-full accent-[hsl(var(--brand-green))]"
      />
    </div>
  )
}

function RulerInspector({
  mapScale,
  updateMapScale,
  measurePoints,
  onUndoMeasurePoint,
  onClearMeasure,
}: {
  mapScale: MapScaleConfig
  updateMapScale: (patch: Partial<MapScaleConfig>) => void
  measurePoints: MapPoint[]
  onUndoMeasurePoint: () => void
  onClearMeasure: () => void
}) {
  const [widthInput, setWidthInput] = useState(() => String(Math.round(fromKm(mapScale.widthKm, mapScale.unit) * 100) / 100))
  const [calibrateInput, setCalibrateInput] = useState('')

  useEffect(() => {
    const val = fromKm(mapScale.widthKm, mapScale.unit)
    setWidthInput(String(val >= 100 ? Math.round(val) : Number(val.toFixed(2))))
  }, [mapScale.widthKm, mapScale.unit])

  const measured = measurePathKm(measurePoints, mapScale.widthKm)
  const secondaryUnit: MapDistanceUnit = mapScale.unit === 'km' ? 'mi' : 'km'
  const travelTimes = estimateTravelTimes(measured.totalKm)
  const mapWidthDisplay = formatNumber(fromKm(mapScale.widthKm, mapScale.unit))
  const mapHeightDisplay = formatNumber(fromKm(mapScale.widthKm / 2, mapScale.unit))

  function commitMapWidth() {
    const num = Number(widthInput)
    if (Number.isFinite(num) && num > 0) {
      updateMapScale({ widthKm: toKm(num, mapScale.unit) })
    } else {
      const val = fromKm(mapScale.widthKm, mapScale.unit)
      setWidthInput(String(val >= 100 ? Math.round(val) : Number(val.toFixed(2))))
    }
  }

  function applyCalibration() {
    const num = Number(calibrateInput)
    const nextWidth = calibrateWidthKm(measurePoints, num, mapScale.unit)
    if (nextWidth) {
      updateMapScale({ widthKm: nextWidth })
      setCalibrateInput('')
    }
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-semibold text-surface-100">
          <Ruler className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" aria-hidden="true" />
          Scale Ruler
        </span>
        {measurePoints.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onUndoMeasurePoint}
              title="Undo last point (Backspace)"
              aria-label="Undo point"
              className="rounded border border-[hsl(var(--studio-edge))] px-1.5 py-0.5 text-[11px] text-surface-300 hover:bg-surface-850 hover:text-surface-100"
            >
              <RotateCcw className="inline h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onClearMeasure}
              title="Clear points (Esc)"
              className="rounded border border-[hsl(var(--studio-edge))] px-1.5 py-0.5 text-[11px] text-surface-300 hover:bg-surface-850 hover:text-surface-100"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Distance Readout Card */}
      <div className="rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-3 space-y-2">
        {measurePoints.length < 2 ? (
          <p className="leading-relaxed text-surface-400">
            {measurePoints.length === 0
              ? 'Click points on the map to measure distance from point to point.'
              : 'Click another point on the map to finish this segment (or keep clicking to trace a route).'}
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-bold tabular-nums text-surface-50">
                {formatDistance(measured.totalKm, mapScale.unit)}
              </span>
              <span className="text-[11px] tabular-nums text-surface-400">
                {formatDistance(measured.totalKm, secondaryUnit)}
              </span>
            </div>
            {measured.segmentsKm.length > 1 && (
              <ul className="space-y-1 border-t border-[hsl(var(--studio-edge))] pt-2 text-[11px] text-surface-400">
                {measured.segmentsKm.map((seg, index) => (
                  <li key={index} className="flex items-center justify-between tabular-nums">
                    <span>Point {index + 1} → {index + 2}</span>
                    <span className="font-medium text-surface-200">{formatDistance(seg, mapScale.unit)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Fantasy Travel Times */}
      {measured.totalKm > 0 && (
        <div className="rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-3 space-y-2">
          <p className="font-semibold text-surface-200">Estimated travel time</p>
          <div className="grid grid-cols-2 gap-1.5">
            {travelTimes.map(item => (
              <div key={item.label} className="rounded-md border border-[hsl(var(--studio-edge))] bg-surface-950/60 px-2 py-1.5">
                <div className="text-[10px] text-surface-400">{item.label}</div>
                <div className="text-xs font-semibold tabular-nums text-surface-100">{item.duration}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* World Scale & Calibration */}
      <div className="rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-semibold text-surface-200">
            <Globe className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" aria-hidden="true" />
            World Scale
          </span>
          <select
            aria-label="Distance unit"
            className={controlClass}
            value={mapScale.unit}
            onChange={event => updateMapScale({ unit: event.target.value as MapDistanceUnit })}
          >
            <option value="km">km</option>
            <option value="mi">mi</option>
            <option value="leagues">leagues</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] text-surface-400">Presets</span>
          <div className="flex flex-wrap gap-1">
            {MAP_SCALE_PRESETS.map(preset => {
              const active = Math.abs(mapScale.widthKm - preset.widthKm) < 0.5
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateMapScale({ widthKm: preset.widthKm })}
                  className={cn(
                    controlClass,
                    'px-2 py-1 text-[11px]',
                    active && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>

        <label className="grid gap-1">
          <div className="flex items-center justify-between">
            <span className="text-surface-400">Map width ({UNIT_LABEL[mapScale.unit]})</span>
          </div>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="0.5"
              step="any"
              aria-label="Map width"
              className={cn(controlClass, 'min-w-0 flex-1 tabular-nums')}
              value={widthInput}
              onChange={event => setWidthInput(event.target.value)}
              onBlur={commitMapWidth}
              onKeyDown={event => { if (event.key === 'Enter') { commitMapWidth(); event.currentTarget.blur() } }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-surface-500">
            Canvas area: {mapWidthDisplay} × {mapHeightDisplay} {UNIT_LABEL[mapScale.unit]}
          </span>
        </label>

        <div className="space-y-1.5 border-t border-[hsl(var(--studio-edge))] pt-2.5">
          <span className="text-[11px] text-surface-400">Set scale from measured line</span>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="0.1"
              step="any"
              placeholder={measurePoints.length >= 2 ? `Known ${UNIT_LABEL[mapScale.unit]}` : 'Draw 2+ points'}
              aria-label="Known line distance"
              disabled={measurePoints.length < 2}
              className={cn(controlClass, 'min-w-0 flex-1 tabular-nums')}
              value={calibrateInput}
              onChange={event => setCalibrateInput(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') applyCalibration() }}
            />
            <button
              type="button"
              disabled={measurePoints.length < 2 || !Number.isFinite(Number(calibrateInput)) || Number(calibrateInput) <= 0}
              onClick={applyCalibration}
              className={controlClass}
            >
              Apply
            </button>
          </div>
        </div>

        <label className="flex items-center justify-between border-t border-[hsl(var(--studio-edge))] pt-2.5">
          <span className="text-surface-300">Show scale bar</span>
          <Switch
            checked={mapScale.showScaleBar}
            onCheckedChange={showScaleBar => updateMapScale({ showScaleBar })}
            aria-label="Show map scale bar"
          />
        </label>
      </div>
    </div>
  )
}

export default function MapInspector(props: MapInspectorProps) {
  const {
    inspectorTab, onTabChange, tool, chooseTool,
    isPainting, isScattering, isErasing, isSmartBrush, paintsWater,
    moving, setMoving, insertingPoint, setInsertingPoint, vertex, setVertex,
    subtract, setSubtract, biomeLock, setBiomeLock, shape, setShape, brushSize, setBrushSize, opacity, setOpacity,
    roughness, setRoughness, smooth, setSmooth, smartTerrain, setSmartTerrain,
    generateTerrain, setGenerateTerrain, smartTextureScale, setSmartTextureScale,
    textureScale, setTextureScale, terrainBlend, setTerrainBlend, rotation, setRotation,
    terrainName, setTerrainName, waterName, setWaterName, recentTextures, fillMap,
    forestDensity, setForestDensity, forestVariation, setForestVariation, brushHint,
    stampCategory, activeStampCategory, stampId, setStampId, stampScale, setStampScale,
    stampOpacity, setStampOpacity, stampOrder, setStampOrder,
    atlasTool, atlasStyle, pathMode, setPathMode, cancelPathStroke, updatePathStyle,
    hasImage, hideImage, setHideImage, hidePins, setHidePins,
    features, selected, selectedId, selectLayer, toggleLayerVisibility, deleteLayer,
    updateFeature, reorderStamp, duplicateSelectedStamp, draftActive,
    mapScale, updateMapScale, measurePoints, onUndoMeasurePoint, onClearMeasure,
  } = props

  const activeTerrain = resolveTerrainName(terrainName)
  const waterTexture = waterTextures.find(t => t.name === waterName)
  const selectedPath = selected && isAtlasPath(selected.tool) ? selected : undefined
  const selectedSettings = selectedPath && pathSettings(selectedPath, features?.indexOf(selectedPath))
  const isPathTool = (t: string) => ['Land', 'River', 'Border', 'Route'].includes(t)

  return (
    <aside
      aria-label="Map inspector"
      className="studio-chapter-toolbar flex w-64 shrink-0 flex-col border-l border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-toolbar))]"
    >
      {/* Inspector Tabs */}
      <div role="tablist" aria-label="Inspector sections" className="grid grid-cols-2 border-b border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-header))] shrink-0">
        <button
          type="button"
          role="tab"
          aria-selected={inspectorTab === 'tool'}
          onClick={() => onTabChange('tool')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors border-b-2',
            inspectorTab === 'tool'
              ? 'border-[hsl(var(--brand-green))] text-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg)/0.5)]'
              : 'border-transparent text-surface-400 hover:text-surface-100'
          )}
        >
          <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
          Tool
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={inspectorTab === 'layers'}
          onClick={() => onTabChange('layers')}
          className={cn(
            'flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors border-b-2',
            inspectorTab === 'layers'
              ? 'border-[hsl(var(--brand-green))] text-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg)/0.5)]'
              : 'border-transparent text-surface-400 hover:text-surface-100'
          )}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          Layers ({features?.length ?? 0})
        </button>
      </div>

      {/* Inspector Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4">
        {inspectorTab === 'tool' ? (
          <>
            {!tool && !stampCategory && (
              <div className="rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-3.5 text-xs text-surface-400 space-y-2">
                <p className="font-semibold text-surface-200">Pan & Select Mode</p>
                <p className="leading-relaxed">Select a brush, path, or stamp on the left rail to start shaping your world.</p>
                <p className="text-[11px] text-surface-500">Tips: Hold <kbd className="rounded border border-[hsl(var(--studio-edge))] px-1">Space</kbd> + drag to pan while painting, or use <kbd className="rounded border border-[hsl(var(--studio-edge))] px-1">[</kbd> / <kbd className="rounded border border-[hsl(var(--studio-edge))] px-1">]</kbd> to resize.</p>
              </div>
            )}

            {tool === 'Ruler' && (
              <RulerInspector
                mapScale={mapScale}
                updateMapScale={updateMapScale}
                measurePoints={measurePoints}
                onUndoMeasurePoint={onUndoMeasurePoint}
                onClearMeasure={onClearMeasure}
              />
            )}

            {isPainting && !isScattering && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-surface-100">{tool}</span>
                  {tool === 'Shape brush' && (
                    <button type="button" className={controlClass} onClick={fillMap}>Fill map</button>
                  )}
                </div>

                {(tool === 'Shape brush' || tool === 'Edge brush') && (
                  <label className="grid gap-1">
                    <span className="text-surface-400">Action</span>
                    <select aria-label="Brush action" className={controlClass} value={subtract ? 'subtract' : 'add'}
                      onChange={event => setSubtract(event.target.value === 'subtract')}>
                      <option value="add">Add land</option>
                      <option value="subtract">Carve water</option>
                    </select>
                  </label>
                )}

                {tool === 'Land brush' && (
                  <div className="space-y-2 rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-2">
                    <div className="grid grid-cols-2 gap-1" role="group" aria-label="Land brush mode">
                      <button
                        type="button"
                        aria-pressed={!biomeLock}
                        onClick={() => setBiomeLock(false)}
                        className={cn(
                          'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                          !biomeLock
                            ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                            : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
                        )}
                      >
                        Sculpt land
                      </button>
                      <button
                        type="button"
                        aria-pressed={biomeLock}
                        onClick={() => { setBiomeLock(true); setSubtract(false) }}
                        className={cn(
                          'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                          biomeLock
                            ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                            : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
                        )}
                      >
                        Paint biome
                      </button>
                    </div>
                    {!biomeLock ? (
                      <div className="grid grid-cols-2 gap-1" role="group" aria-label="Sculpt action">
                        <button
                          type="button"
                          aria-pressed={!subtract}
                          onClick={() => setSubtract(false)}
                          className={cn(
                            'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                            !subtract
                              ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg)/0.6)] text-[hsl(var(--brand-green))]'
                              : 'border-[hsl(var(--studio-edge))] text-surface-400 hover:bg-surface-850 hover:text-surface-100'
                          )}
                        >
                          Add land
                        </button>
                        <button
                          type="button"
                          aria-pressed={subtract}
                          onClick={() => setSubtract(true)}
                          className={cn(
                            'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                            subtract
                              ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg)/0.6)] text-[hsl(var(--brand-green))]'
                              : 'border-[hsl(var(--studio-edge))] text-surface-400 hover:bg-surface-850 hover:text-surface-100'
                          )}
                        >
                          Carve water (X)
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] leading-snug text-surface-400">
                        Clips strictly inside existing coastlines.
                      </p>
                    )}
                  </div>
                )}

                {tool === 'Shape brush' ? (
                  <label className="grid gap-1">
                    <span className="text-surface-400">Shape</span>
                    <select aria-label="Brush shape" className={controlClass} value={shape}
                      onChange={event => setShape(event.target.value as Exclude<Shape, 'Fill' | 'Polygon'>)}>
                      <option>Ellipse</option><option>Rectangle</option><option>Diamond</option>
                    </select>
                  </label>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-surface-400">Brush size</span>
                      <output className="tabular-nums font-medium text-surface-200">{brushSize}</output>
                    </div>
                    <BrushSizePresets value={brushSize} onChange={setBrushSize} />
                    <input type="range" min="20" max="640" value={brushSize}
                      aria-label="Brush size"
                      onChange={event => setBrushSize(Number(event.target.value))}
                      className="w-full accent-[hsl(var(--brand-green))]" />
                  </div>
                )}

                {!isErasing && (
                  <label className="grid gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-surface-400">Opacity</span>
                      <output className="tabular-nums font-medium text-surface-200">{isSmartBrush ? opacity : Math.max(5, opacity)}%</output>
                    </div>
                    <input type="range" min={isSmartBrush ? 0 : 5} max="100" value={isSmartBrush ? opacity : Math.max(5, opacity)}
                      onChange={event => setOpacity(event.target.valueAsNumber)}
                      className="w-full accent-[hsl(var(--brand-green))]" />
                  </label>
                )}

                {!isErasing && !paintsWater && (
                  <div className="space-y-2 border-t border-[hsl(var(--studio-edge))] pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-surface-400 font-medium">Biome material</span>
                      <span className="text-[11px] font-medium text-surface-200">{activeTerrain}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Biome material">
                      {terrainTextures.map(({ name, url }) => {
                        const selectedBiome = activeTerrain === name
                        return (
                          <button
                            key={name}
                            type="button"
                            aria-pressed={selectedBiome}
                            onClick={() => setTerrainName(name)}
                            className={cn(
                              controlClass,
                              'flex items-center gap-1.5 p-1 text-left transition-colors hover:bg-surface-850',
                              selectedBiome && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                            )}
                          >
                            <img src={url} alt="" className="h-5 w-6 shrink-0 rounded-sm object-cover" />
                            <span className="min-w-0 truncate text-[11px] font-medium leading-tight">{name}</span>
                          </button>
                        )
                      })}
                    </div>

                    {tool === 'Land brush' && (
                      <label className="flex items-center justify-between pt-1">
                        <span className="text-surface-300">Smart Terrain Blending</span>
                        <input type="checkbox" checked={smartTerrain} onChange={event => setSmartTerrain(event.target.checked)}
                          className="accent-[hsl(var(--brand-green))]" />
                      </label>
                    )}

                    <details className="rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-2.5">
                      <summary className="cursor-pointer select-none font-medium text-surface-200">
                        Blending & Texture
                      </summary>
                      <div className="mt-3 space-y-2.5">
                        {!(tool === 'Land brush' && biomeLock) && (
                          <RoughnessControl value={roughness} onChange={setRoughness} />
                        )}
                        {!isSmartBrush && (
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={generateTerrain} onChange={event => setGenerateTerrain(event.target.checked)} />
                            Generate relief
                          </label>
                        )}
                        {tool !== 'Shape brush' && (
                          <label className="flex items-center gap-2">
                            <input type="checkbox" checked={smooth} onChange={event => setSmooth(event.target.checked)} />
                            Smooth stroke
                          </label>
                        )}
                        <label className="grid gap-1">
                          <div className="flex items-center justify-between">
                            <span>{!isSmartBrush && generateTerrain ? 'Terrain scale' : 'Texture scale'}</span>
                            <output className="tabular-nums">{isSmartBrush ? `${(smartTextureScale / 100).toFixed(2)}×` : `${textureScale}%`}</output>
                          </div>
                          <input type="range" min="25" max={isSmartBrush ? 400 : 250}
                            value={isSmartBrush ? smartTextureScale : textureScale}
                            onChange={event => (isSmartBrush ? setSmartTextureScale : setTextureScale)(event.target.valueAsNumber)}
                            className="w-full accent-[hsl(var(--brand-green))]" />
                        </label>
                        {isSmartBrush && (
                          <>
                            {([['Hardness', 'hardness'], ['Blend Strength', 'strength'], ['Edge Noise', 'noise']] as const).map(([label, key]) => (
                              <label key={key} className="grid gap-1">
                                <div className="flex items-center justify-between">
                                  <span>{label}</span>
                                  <output className="tabular-nums">{terrainBlend[key]}%</output>
                                </div>
                                <input type="range" min="0" max="100" value={terrainBlend[key]}
                                  onChange={event => setTerrainBlend({ ...terrainBlend, [key]: event.target.valueAsNumber })}
                                  className="w-full accent-[hsl(var(--brand-green))]" />
                              </label>
                            ))}
                            {([['Color Harmonization', 'harmonize'], ['Blend Relief', 'relief']] as const).map(([label, key]) => (
                              <label key={key} className="flex items-center gap-2">
                                <input type="checkbox" checked={terrainBlend[key]}
                                  onChange={event => setTerrainBlend({ ...terrainBlend, [key]: event.target.checked })} />
                                {label}
                              </label>
                            ))}
                          </>
                        )}
                        <label className="grid gap-1">
                          <div className="flex items-center justify-between">
                            <span>Rotation</span>
                            <output className="tabular-nums">{rotation}°</output>
                          </div>
                          <input type="range" min="0" max="359" value={rotation}
                            onChange={event => setRotation(Number(event.target.value))}
                            className="w-full accent-[hsl(var(--brand-green))]" />
                        </label>
                      </div>
                    </details>
                  </div>
                )}

                {!isErasing && paintsWater && tool !== 'Water brush' && (
                  <details className="rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-2.5">
                    <summary className="cursor-pointer select-none font-medium text-surface-200">
                      Blending & Texture
                    </summary>
                    <div className="mt-3 space-y-2.5">
                      <RoughnessControl value={roughness} onChange={setRoughness} />
                      {tool !== 'Shape brush' && (
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={smooth} onChange={event => setSmooth(event.target.checked)} />
                          Smooth stroke
                        </label>
                      )}
                    </div>
                  </details>
                )}

                {tool === 'Water brush' && (
                  <div className="space-y-2 border-t border-[hsl(var(--studio-edge))] pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-surface-400 font-medium">Water material</span>
                      <span className="text-[11px] font-medium text-surface-200">{waterTexture ? waterTexture.name : 'Default ocean'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Water material">
                      {waterTextures.map(({ name, url }) => (
                        <button
                          key={name}
                          type="button"
                          aria-pressed={waterName === name}
                          onClick={() => setWaterName(name)}
                          className={cn(
                            controlClass,
                            'space-y-1 p-1 text-left transition-colors hover:bg-surface-850',
                            waterName === name && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                          )}
                        >
                          <img src={url} alt="" className="h-9 w-full rounded object-cover" />
                          <span className="block truncate text-[10px] leading-tight">{name}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-pressed={waterName === ''}
                        onClick={() => setWaterName('')}
                        className={cn(
                          controlClass,
                          'col-span-2 flex items-center gap-2 p-1.5 text-left transition-colors hover:bg-surface-850',
                          waterName === '' && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                        )}
                      >
                        <span className="h-5 w-7 rounded border border-[hsl(var(--studio-edge))] bg-[#225b80] shrink-0" aria-hidden="true" />
                        <span className="truncate text-[10px] font-medium">Default ocean (carve only)</span>
                      </button>
                    </div>

                    <details className="rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-2.5">
                      <summary className="cursor-pointer select-none font-medium text-surface-200">
                        Blending & Texture
                      </summary>
                      <div className="mt-3 space-y-2.5">
                        <RoughnessControl value={roughness} onChange={setRoughness} />
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={smooth} onChange={event => setSmooth(event.target.checked)} />
                          Smooth stroke
                        </label>
                        {waterTexture && (
                          <>
                            <label className="grid gap-1">
                              <div className="flex items-center justify-between">
                                <span>Texture scale</span>
                                <output className="tabular-nums">{textureScale}%</output>
                              </div>
                              <input type="range" min="25" max="250" value={textureScale}
                                onChange={event => setTextureScale(event.target.valueAsNumber)}
                                className="w-full accent-[hsl(var(--brand-green))]" />
                            </label>
                            <label className="grid gap-1">
                              <div className="flex items-center justify-between">
                                <span>Rotation</span>
                                <output className="tabular-nums">{rotation}°</output>
                              </div>
                              <input type="range" min="0" max="359" value={rotation}
                                onChange={event => setRotation(Number(event.target.value))}
                                className="w-full accent-[hsl(var(--brand-green))]" />
                            </label>
                          </>
                        )}
                      </div>
                    </details>
                  </div>
                )}

                {brushHint && <p role="status" className="text-[11px] text-warning-400">{brushHint}</p>}
              </div>
            )}

            {atlasTool && atlasStyle && (
              <div className="space-y-3 text-xs">
                <p className="font-semibold text-surface-100">{atlasTool}</p>
                <label className="grid gap-1">
                  <span className="text-surface-400">Draw mode</span>
                  <select className={controlClass} value={pathMode} onChange={event => {
                    cancelPathStroke()
                    setPathMode(event.target.value === 'freehand' ? 'freehand' : 'points')
                  }}>
                    <option value="points">Point to point</option>
                    <option value="freehand">Freehand</option>
                  </select>
                </label>
                <div className="flex flex-col gap-2.5">
                  <AtlasPathControls key={atlasTool} id={atlasTool} control={controlClass} tool={atlasTool} settings={atlasStyle}
                    update={patch => updatePathStyle(atlasTool, patch)} />
                </div>
              </div>
            )}

            {activeStampCategory && (
              <div className="space-y-3 text-xs">
                <h3 className="font-serif text-sm font-semibold text-surface-100">{activeStampCategory.label}</h3>
                {stampCategory === 'forests' && (
                  <label className="grid gap-1">
                    <span className="text-surface-400">Placement mode</span>
                    <select className={controlClass} value={isScattering ? 'scatter' : 'single'}
                      onChange={event => chooseTool(event.target.value === 'scatter' ? 'Forest scatter' : 'Forest')}>
                      <option value="single">Single stamp</option>
                      <option value="scatter">Forest scatter</option>
                    </select>
                  </label>
                )}
                {isScattering ? (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between"><span>Brush size</span><output className="tabular-nums">{brushSize}</output></div>
                      <BrushSizePresets value={brushSize} onChange={setBrushSize} />
                      <input type="range" min="20" max="640" value={brushSize} aria-label="Brush size"
                        onChange={event => setBrushSize(event.target.valueAsNumber)}
                        className="w-full accent-[hsl(var(--brand-green))]" />
                    </div>
                    <label className="grid gap-1">
                      <div className="flex justify-between"><span>Density</span><output className="tabular-nums">{forestDensity}%</output></div>
                      <input type="range" min="0" max="100" value={forestDensity} onChange={event => setForestDensity(event.target.valueAsNumber)}
                        className="w-full accent-[hsl(var(--brand-green))]" />
                    </label>
                    <label className="grid gap-1">
                      <div className="flex justify-between"><span>Size variation</span><output className="tabular-nums">{forestVariation}%</output></div>
                      <input type="range" min="0" max="60" value={forestVariation} onChange={event => setForestVariation(event.target.valueAsNumber)}
                        className="w-full accent-[hsl(var(--brand-green))]" />
                    </label>
                    <p role="status" className="text-[11px] text-surface-400">{brushHint || 'Drag over painted land to scatter tree clusters.'}</p>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
                      {stampAssets.filter(asset => asset.category === stampCategory).map(asset => (
                        <button key={asset.id} type="button" aria-pressed={stampId === asset.id}
                          className={cn(
                            controlClass,
                            'min-w-0 !bg-[#efe3c8] !text-[#392e1d] p-1.5',
                            stampId === asset.id && '!border-[hsl(var(--brand-green))] ring-1 ring-[hsl(var(--brand-green))]'
                          )}
                          onClick={() => setStampId(asset.id)}>
                          <img src={asset.url} alt="" className="mb-1 h-11 w-full object-contain" />
                          <span className="block truncate text-left text-[10px]">{asset.label}</span>
                        </button>
                      ))}
                    </div>
                    <label className="grid gap-1">
                      <div className="flex justify-between"><span>Stamp scale</span><span className="tabular-nums">{Math.round(stampScale * 100)}%</span></div>
                      <input type="range" min=".25" max="4" step=".05" value={stampScale} onChange={event => setStampScale(event.target.valueAsNumber)}
                        className="w-full accent-[hsl(var(--brand-green))]" />
                    </label>
                    <label className="grid gap-1">
                      <div className="flex justify-between"><span>Stamp opacity</span><span className="tabular-nums">{stampOpacity}%</span></div>
                      <input type="range" min="0" max="100" value={stampOpacity} onChange={event => setStampOpacity(event.target.valueAsNumber)}
                        className="w-full accent-[hsl(var(--brand-green))]" />
                    </label>
                    <label className="grid gap-1">
                      <span>Place new stamps</span>
                      <select className={controlClass} value={stampOrder}
                        onChange={event => setStampOrder(event.target.value as typeof stampOrder)}>
                        <option value="auto">Automatic by frame bottom</option>
                        <option value="front">In front of stamps</option>
                        <option value="back">Behind stamps</option>
                      </select>
                    </label>
                    <p className="text-[11px] text-surface-400">{stampId ? 'Click the map to place copies. Press Esc to stop.' : 'Choose a stamp to place on the map.'}</p>
                  </>
                )}
                <div className="flex flex-wrap gap-x-2 gap-y-1 border-t border-[hsl(var(--studio-edge))] pt-2 text-[11px] text-surface-400">
                  <a className="underline" href={stampCredits.licenses} download="LICENSES.md">CC0 credits</a>
                  <a className="underline" href={stampCredits.originalReadme} download="ORIGINAL_README.txt">Original README</a>
                </div>
              </div>
            )}

            {tool === 'Land' && (
              <p className="text-xs text-surface-400">Click points on the map to outline a land polygon, then click Finish land.</p>
            )}
            {tool === 'Label' && (
              <p className="text-xs text-surface-400">Click anywhere on the map to add a region or city label.</p>
            )}
          </>
        ) : (
          /* Layers Tab */
          <div className="space-y-3">
            <div className="space-y-2 border-b border-[hsl(var(--studio-edge))] pb-3 text-xs">
              {hasImage && (
                <div className="flex items-center justify-between">
                  <span className="text-surface-200">Reference artwork</span>
                  <Switch checked={!hideImage} onCheckedChange={checked => setHideImage(!checked)} aria-label="Toggle reference artwork" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-surface-200">Location pins</span>
                <Switch checked={!hidePins} onCheckedChange={checked => setHidePins(!checked)} aria-label="Toggle location pins" />
              </div>
            </div>

            {selected && features && !atlasTool && (
              <div className="rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Selected Layer</span>
                  <button type="button" className={controlClass} onClick={() => { chooseTool(''); setMoving(true) }}>
                    Move
                  </button>
                </div>
                <input
                  key={`${selected.id}:${selected.name}`}
                  aria-label="Layer item name"
                  placeholder="Name"
                  className={cn(controlClass, 'w-full')}
                  defaultValue={selected.name}
                  onBlur={event => { if (event.target.value !== selected.name) updateFeature({ name: event.target.value }) }}
                  maxLength={80}
                  onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
                />

                {selected.brush?.terrain && !selected.brush.subtract && !selected.brush.blend && (
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={Boolean(selected.brush.generated)} onChange={event => {
                      if (selected.brush) updateFeature({ brush: { ...selected.brush, generated: event.target.checked } })
                    }} />
                    Generate relief for layer
                  </label>
                )}

                {isPathTool(selected.tool) && !selected.brush && (
                  <select aria-label="Reshape point" className={cn(controlClass, 'w-full')} value={vertex ?? ''} onChange={event => {
                    const value = event.target.value
                    chooseTool('')
                    setVertex(value === '' ? null : Number(value))
                    setMoving(value !== '')
                  }}>
                    <option value="">Reshape point</option>
                    {selected.points.map((_, index) => <option key={index} value={index}>Point {index + 1}</option>)}
                  </select>
                )}

                {selectedPath && selectedSettings && isAtlasPath(selectedPath.tool) && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className={controlClass} onClick={() => {
                        chooseTool('')
                        setInsertingPoint(true)
                        setMoving(true)
                      }}>Insert point</button>
                      {vertex !== null && (
                        <button type="button" className={controlClass}
                          disabled={selectedPath.points.length <= (selectedPath.tool === 'Border' && (selectedSettings.closed || selectedSettings.fill) ? 3 : 2)}
                          onClick={() => {
                            updateFeature({ points: selectedPath.points.filter((_, index) => index !== vertex) })
                            setVertex(null)
                            setMoving(false)
                          }}>Delete point</button>
                      )}
                    </div>
                    <AtlasPathControls id={selectedPath.id} tool={selectedPath.tool} settings={selectedSettings}
                      canClose={selectedPath.points.length >= 3} control={controlClass}
                      update={patch => updateFeature({ path: { ...selectedSettings, ...patch } })} />
                  </div>
                )}

                {selected.tool === 'Stamp' && (
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className={controlClass} onClick={() => reorderStamp('front')}>Front</button>
                      <button type="button" className={controlClass} onClick={() => reorderStamp('back')}>Back</button>
                      <button type="button" className={controlClass} onClick={() => reorderStamp('auto')}>Auto</button>
                    </div>
                    {([
                      ['Scale (%)', selected.size * 100, 25, 400, (value: number) => ({ size: value / 100 })],
                      ['Rotation (°)', selected.angle, -360, 360, (value: number) => ({ angle: value })],
                      ['Opacity (%)', (selected.opacity ?? 1) * 100, 0, 100, (value: number) => ({ opacity: value / 100 })],
                    ] as const).map(([label, value, min, max, patch]) => (
                      <label key={label} className="flex items-center justify-between gap-2 text-xs">{label}
                        <input key={`${selected.id}:${value}`} className={cn(controlClass, 'w-16')} type="number" min={min} max={max}
                          defaultValue={Math.round(value)}
                          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
                          onBlur={event => {
                            const input = event.currentTarget
                            const next = Number.isFinite(input.valueAsNumber) ? Math.max(min, Math.min(max, input.valueAsNumber)) : value
                            input.value = String(next)
                            if (next !== value) updateFeature(patch(next))
                          }} />
                      </label>
                    ))}
                    <button type="button" className={controlClass} onClick={duplicateSelectedStamp}>Duplicate stamp</button>
                  </div>
                )}

                {selected.tool !== 'Stamp' && !isPathTool(selected.tool) && !selected.brush && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">Size
                      <input className={cn(controlClass, 'w-16')} type="number" min=".5" max="4" step=".25" value={selected.size}
                        onChange={event => {
                          if (Number.isFinite(event.target.valueAsNumber)) updateFeature({ size: Math.min(4, Math.max(.5, event.target.valueAsNumber)) })
                        }} />
                    </label>
                    <button type="button" className={controlClass} onClick={() => updateFeature({ angle: (selected.angle + 15) % 360 })}>Rotate</button>
                  </div>
                )}
              </div>
            )}

            {features?.length ? (
              <ul className="space-y-1">
                {features.map((feature, index) => ({ feature, index }))
                  .sort((a, b) => (b.feature.addedOrder ?? b.index) - (a.feature.addedOrder ?? a.index))
                  .map(({ feature, index }) => {
                    const label = feature.name || `${feature.tool} ${index + 1}`
                    const isSelected = selectedId === feature.id
                    return (
                      <li
                        key={feature.id}
                        className={cn(
                          'group flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors',
                          isSelected
                            ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                            : 'hover:bg-surface-850 text-surface-200'
                        )}
                      >
                        <button
                          type="button"
                          aria-label={feature.hidden ? `Show ${label}` : `Hide ${label}`}
                          title={feature.hidden ? 'Show layer' : 'Hide layer'}
                          onClick={() => toggleLayerVisibility(feature.id, Boolean(feature.hidden))}
                          className="shrink-0 rounded p-1 text-surface-400 hover:bg-surface-800 hover:text-surface-100"
                        >
                          {feature.hidden ? <EyeOff className="h-3.5 w-3.5 opacity-60" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <LayerThumbnail feature={feature} />
                        <button
                          type="button"
                          title={label}
                          aria-pressed={isSelected}
                          onClick={() => selectLayer(feature.id)}
                          className={cn('min-w-0 flex-1 truncate text-left text-xs', feature.hidden && 'opacity-50 line-through')}
                        >
                          {label}
                        </button>
                        <button
                          type="button"
                          title={`Delete ${label}`}
                          aria-label={`Delete layer ${index + 1}: ${label}`}
                          className="shrink-0 rounded p-1 text-surface-500 opacity-0 transition-opacity hover:bg-danger-500/10 hover:text-danger-500 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                          disabled={draftActive}
                          onClick={() => deleteLayer(feature.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
              </ul>
            ) : (
              <p className="text-xs text-surface-400">Draw or place an item to add a layer.</p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
