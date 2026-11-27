import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { AlertCircle, Cpu, ImagePlus, Loader2, RefreshCw, Sparkles, Upload, Wand2 } from 'lucide-react'
import { useUserStore } from '../../../stores/userStore'
import { cn } from '../../../utils'
import Modal from '../../ui/Modal'
import { analyzeMapDraft, detectDraftEngine, prepareDraftImage } from './mapDraftAnalyzer'
import type { MapDraftAnalysis, PreparedDraftImage } from './mapDraftAnalyzer'
import type { DraftDetailLevel } from './mapContourTracer'
import { buildFeaturesFromDraft } from './mapDraftBuilder'
import type { MapFeature } from './ParchmentMapTools'

const ROUGHNESS_PRESETS = [
  { label: 'Smooth', value: 0 },
  { label: 'Gentle', value: 8 },
  { label: 'Natural', value: 20 },
  { label: 'Rugged', value: 36 },
] as const

const controlBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-2.5 py-1.5 text-xs font-medium text-surface-200 transition-colors hover:bg-surface-850 hover:text-surface-100 disabled:opacity-45'

export default function MapDraftImportModal({
  isOpen,
  hasExistingLayers,
  onClose,
  onApply,
}: {
  isOpen: boolean
  hasExistingLayers: boolean
  onClose: () => void
  onApply: (features: MapFeature[], mode: 'replace' | 'append', suggestedWidthKm?: number) => void
}) {
  const settings = useUserStore(state => state.settings)
  const detectedEngine = detectDraftEngine(settings)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const preparedRef = useRef<PreparedDraftImage | null>(null)

  const [prepared, setPrepared] = useState<PreparedDraftImage | null>(null)
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [engineMode, setEngineMode] = useState<'auto' | 'offline'>('auto')
  const [detailLevel, setDetailLevel] = useState<DraftDetailLevel>('high')
  const [userNote, setUserNote] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<MapDraftAnalysis | null>(null)

  // Preview & build toggles
  const [draftOpacity, setDraftOpacity] = useState(55)
  const [includeLandmasses, setIncludeLandmasses] = useState(true)
  const [includeLakes, setIncludeLakes] = useState(true)
  const [includeBiomes, setIncludeBiomes] = useState(true)
  const [includePaths, setIncludePaths] = useState(true)
  const [includeMountains, setIncludeMountains] = useState(true)
  const [includeForests, setIncludeForests] = useState(true)
  const [includeSettlements, setIncludeSettlements] = useState(true)
  const [includeSuggestedNature, setIncludeSuggestedNature] = useState(true)
  const [includeLabels, setIncludeLabels] = useState(true)
  const [applyScale, setApplyScale] = useState(true)
  const [roughness, setRoughness] = useState(8)
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>(hasExistingLayers ? 'replace' : 'replace')

  function releasePrepared(target: PreparedDraftImage | null) {
    if (!target) return
    URL.revokeObjectURL(target.previewUrl)
    target.bitmap.close()
  }

  function resetAll() {
    abortRef.current?.abort()
    abortRef.current = null
    releasePrepared(preparedRef.current)
    preparedRef.current = null
    setPrepared(null)
    setFileName('')
    setAnalysis(null)
    setAnalyzing(false)
    setProgress(null)
    setError('')
    setUserNote('')
  }

  useEffect(() => {
    if (!isOpen) {
      resetAll()
    } else {
      setApplyMode(hasExistingLayers ? 'append' : 'replace')
    }
    return () => {
      abortRef.current?.abort()
      releasePrepared(preparedRef.current)
      preparedRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError('')
    setAnalysis(null)
    try {
      const next = await prepareDraftImage(file)
      releasePrepared(preparedRef.current)
      preparedRef.current = next
      setPrepared(next)
      setFileName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image file.')
    }
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    void handleFile(file)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    void handleFile(file)
  }

  async function runAnalysis() {
    if (!prepared || analyzing) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setAnalyzing(true)
    setProgress({ stage: 'Starting analysis…', percent: 6 })
    setError('')

    try {
      const result = await analyzeMapDraft({
        bitmap: prepared.bitmap,
        visionImageHigh: prepared.visionImageHigh,
        visionImageStandard: prepared.visionImageStandard,
        settings,
        mode: engineMode,
        detail: detailLevel,
        userNote,
        signal: controller.signal,
        onProgress: (stage, percent) => {
          if (!controller.signal.aborted) setProgress({ stage, percent })
        },
      })
      if (controller.signal.aborted) return
      setAnalysis(result)
      setRoughness(result.usedTracedContours ? 8 : 20)
      setApplyScale(Boolean(result.suggestedWidthKm))
      const detectedMtn = result.stamps.filter(s => s.kind === 'mountains').length
      const detectedFor = result.stamps.filter(s => s.kind === 'forests').length
      setIncludeSuggestedNature((detectedMtn === 0 || detectedFor === 0) && result.suggestedStamps.length > 0)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Draft analysis failed. Try again or use Built-in Offline.')
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setAnalyzing(false)
        setProgress(null)
      }
    }
  }

  function handleGenerate() {
    if (!analysis) return
    const generated = buildFeaturesFromDraft(analysis, {
      includeLandmasses,
      includeLakes,
      includeBiomes,
      includePaths,
      includeMountains,
      includeForests,
      includeSettlements,
      includeSuggestedNature,
      includeLabels,
      roughness,
    })
    if (generated.length === 0) {
      setError('Select at least one detected feature group to generate.')
      return
    }
    const widthKm = applyScale ? analysis.suggestedWidthKm : undefined
    onApply(generated, applyMode, widthKm)
  }

  const visibleStamps = analysis
    ? [
        ...analysis.stamps.filter(s =>
          (s.kind === 'mountains' && includeMountains) ||
          (s.kind === 'forests' && includeForests) ||
          (s.kind === 'settlements' && includeSettlements)
        ),
        ...(includeSuggestedNature
          ? analysis.suggestedStamps.filter(s =>
              (s.kind === 'mountains' && includeMountains) ||
              (s.kind === 'forests' && includeForests)
            )
          : []),
      ]
    : []

  const stampCounts = {
    mountains: visibleStamps.filter(s => s.kind === 'mountains').length,
    forests: visibleStamps.filter(s => s.kind === 'forests').length,
    settlements: visibleStamps.filter(s => s.kind === 'settlements').length,
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={analyzing}
      size="4xl"
      title="Draft to Editable Map"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        hidden
        onChange={onFileInputChange}
      />

      {!analysis ? (
        <div className="space-y-4 text-xs">
          <p className="text-sm text-surface-300">
            Import a hand-drawn sketch, scanned notebook draft, or reference map picture. The analyzer inspects it first and builds editable landmasses, biomes, rivers, roads, stamps, and labels inside Fantasy Map Studio.
          </p>

          {/* Drop zone / preview */}
          <div
            onDragOver={event => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-5 text-center transition-colors',
              dragging
                ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg)/0.5)]'
                : 'border-[hsl(var(--studio-edge))] bg-surface-950/40'
            )}
          >
            {prepared ? (
              <div className="w-full space-y-2.5">
                <div className="mx-auto flex max-h-60 items-center justify-center overflow-hidden rounded-lg border border-[hsl(var(--studio-edge))] bg-[#163f5e]">
                  <img
                    src={prepared.previewUrl}
                    alt="Draft preview"
                    className="max-h-60 w-auto object-contain"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-surface-400">
                  <span className="truncate font-medium text-surface-200">
                    {fileName} ({prepared.width} × {prepared.height})
                  </span>
                  <button
                    type="button"
                    className={controlBtn}
                    disabled={analyzing}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Choose different image
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] text-[hsl(var(--brand-green))]">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-surface-100">Drop a draft drawing or map picture here</p>
                  <p className="text-[11px] text-surface-400">PNG, JPEG, or WebP up to 40 MB</p>
                </div>
                <button
                  type="button"
                  className={cn(controlBtn, 'px-3 py-1.5')}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Select image file
                </button>
              </>
            )}
          </div>

          {/* Engine Mode, Detail Quality & Optional Guidance */}
          <div className="grid gap-3 rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-950/35 p-3.5 sm:grid-cols-2">
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <span className="block font-semibold text-surface-200">Analysis Engine</span>
                <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Analysis engine">
                  <button
                    type="button"
                    aria-pressed={engineMode === 'auto'}
                    disabled={analyzing}
                    onClick={() => setEngineMode('auto')}
                    className={cn(
                      controlBtn,
                      'justify-start px-2.5',
                      engineMode === 'auto' && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Auto
                  </button>
                  <button
                    type="button"
                    aria-pressed={engineMode === 'offline'}
                    disabled={analyzing}
                    onClick={() => setEngineMode('offline')}
                    className={cn(
                      controlBtn,
                      'justify-start px-2.5',
                      engineMode === 'offline' && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                    )}
                  >
                    <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Offline Only
                  </button>
                </div>
                <p className="text-[11px] leading-snug text-surface-400">
                  {engineMode === 'offline'
                    ? 'Built-in Offline Analyzer: traces coastlines, lakes, biomes, rivers, and stamps locally with no AI call.'
                    : detectedEngine.kind === 'offline'
                      ? `Built-in Offline Analyzer active (${detectedEngine.reason})`
                      : `Will use ${detectedEngine.label} with automatic offline fallback.`}
                </p>
              </div>

              <div className="space-y-1.5 border-t border-[hsl(var(--studio-edge))] pt-2">
                <span className="block font-semibold text-surface-200">Detail Quality</span>
                <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Detail quality">
                  <button
                    type="button"
                    aria-pressed={detailLevel === 'high'}
                    disabled={analyzing}
                    onClick={() => setDetailLevel('high')}
                    className={cn(
                      controlBtn,
                      'justify-start px-2.5',
                      detailLevel === 'high' && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                    )}
                  >
                    High Detail
                  </button>
                  <button
                    type="button"
                    aria-pressed={detailLevel === 'standard'}
                    disabled={analyzing}
                    onClick={() => setDetailLevel('standard')}
                    className={cn(
                      controlBtn,
                      'justify-start px-2.5',
                      detailLevel === 'standard' && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                    )}
                  >
                    Fast Draft
                  </button>
                </div>
                <p className="text-[11px] leading-snug text-surface-400">
                  {detailLevel === 'high'
                    ? '960px coastline/ridge tracing + 2-pass Vision AI for maximum accuracy.'
                    : 'Quick preview trace for rapid layout tests.'}
                </p>
              </div>
            </div>

            <label className="space-y-1.5">
              <span className="block font-semibold text-surface-200">Author Hint (optional)</span>
              <textarea
                rows={4}
                value={userNote}
                disabled={analyzing}
                onChange={event => setUserNote(event.target.value)}
                placeholder="e.g., Northern continent is icy snow, X marks ruined castles, dashed line is the royal border."
                className="w-full resize-none rounded-md border border-[hsl(var(--studio-edge))] bg-surface-950 px-2.5 py-1.5 text-xs text-surface-100 placeholder:text-surface-500"
              />
            </label>
          </div>

          {analyzing && progress && (
            <div className="space-y-1.5 rounded-lg border border-[hsl(var(--brand-green)/0.3)] bg-[hsl(var(--brand-green-bg)/0.25)] px-3 py-2.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-surface-200">
                <span>{progress.stage}</span>
                <span className="tabular-nums text-[hsl(var(--brand-green))]">{progress.percent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-900">
                <div
                  className="h-full rounded-full bg-[hsl(var(--brand-green))] transition-all duration-200"
                  style={{ width: `${Math.max(4, Math.min(100, progress.percent))}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--studio-edge))] pt-3">
            {analyzing ? (
              <button
                type="button"
                className={controlBtn}
                onClick={() => {
                  abortRef.current?.abort()
                  setAnalyzing(false)
                }}
              >
                Cancel analysis
              </button>
            ) : (
              <button type="button" className={controlBtn} onClick={onClose}>
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={!prepared || analyzing}
              onClick={() => void runAnalysis()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--brand-green))] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45 dark:text-surface-950"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Analyzing draft…
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Analyze Draft
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 text-xs lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* Left: Interactive Inspection Overlay */}
          <div className="flex flex-col gap-2.5">
            <div
              className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl border border-[hsl(var(--studio-edge))] bg-[#1a4969]"
              aria-label="Analyzed draft preview"
            >
              {prepared && (
                <img
                  src={prepared.previewUrl}
                  alt="Imported draft"
                  className="h-full w-full object-fill transition-opacity"
                  style={{ opacity: draftOpacity / 100 }}
                />
              )}
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 1000 500"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {includeLandmasses && analysis.landmasses.map(lm => (
                  <polygon
                    key={lm.id}
                    points={lm.points.map(p => `${p.x * 1000},${p.y * 500}`).join(' ')}
                    fill="#7fb069"
                    fillOpacity="0.28"
                    stroke="#d9f99d"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                ))}
                {includeLakes && analysis.lakes.map(lake => (
                  <polygon
                    key={lake.id}
                    points={lake.points.map(p => `${p.x * 1000},${p.y * 500}`).join(' ')}
                    fill="#225b80"
                    fillOpacity="0.65"
                    stroke="#7ad1df"
                    strokeWidth="2"
                  />
                ))}
                {includeBiomes && analysis.biomeZones.map(zone => (
                  <circle
                    key={zone.id}
                    cx={zone.center.x * 1000}
                    cy={zone.center.y * 500}
                    r={zone.radius * 1000}
                    fill="#fde68a"
                    fillOpacity="0.16"
                    stroke="#fde68a"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                  />
                ))}
                {includePaths && analysis.paths.map(path => (
                  <polyline
                    key={path.id}
                    points={path.points.map(p => `${p.x * 1000},${p.y * 500}`).join(' ')}
                    fill="none"
                    stroke={path.kind === 'River' ? '#38bdf8' : path.kind === 'Border' ? '#f87171' : '#e7c27d'}
                    strokeWidth={path.kind === 'River' ? 3.5 : 2.5}
                    strokeDasharray={path.kind === 'Border' ? '8 5' : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {visibleStamps.map(stamp => (
                  <g key={stamp.id} transform={`translate(${stamp.point.x * 1000}, ${stamp.point.y * 500})`}>
                    <circle
                      r={stamp.kind === 'settlements' ? 7 : 5.5}
                      fill={stamp.kind === 'mountains' ? '#fbbf24' : stamp.kind === 'forests' ? '#4ade80' : '#f472b6'}
                      stroke="#1f1b16"
                      strokeWidth="1.5"
                    />
                  </g>
                ))}
                {includeLabels && analysis.labels.map(label => (
                  <text
                    key={label.id}
                    x={label.point.x * 1000}
                    y={label.point.y * 500}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="600"
                    fill="#fef3c7"
                    stroke="#1f1b16"
                    strokeWidth="3"
                    paintOrder="stroke"
                  >
                    {label.text}
                  </text>
                ))}
              </svg>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-950/35 px-3 py-2">
              <label className="flex flex-1 items-center gap-2">
                <span className="shrink-0 text-[11px] text-surface-300">Draft underlay</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={draftOpacity}
                  onChange={event => setDraftOpacity(Number(event.target.value))}
                  className="w-full accent-[hsl(var(--brand-green))]"
                />
                <output className="w-8 text-right text-[11px] tabular-nums text-surface-300">{draftOpacity}%</output>
              </label>
              <div className="flex items-center gap-2 text-[10px] text-surface-400">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#d9f99d]" />Land</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#38bdf8]" />Rivers</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#fbbf24]" />Mountains</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#4ade80]" />Forests</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f472b6]" />Towns</span>
              </div>
            </div>
          </div>

          {/* Right: Summary, Layer Toggles & Generate */}
          <div className="flex flex-col justify-between gap-3">
            <div className="space-y-3 overflow-y-auto pr-0.5 max-h-[60vh]">
              <div className="rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-950/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--brand-green)/0.4)] bg-[hsl(var(--brand-green-bg))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--brand-green))]">
                    {analysis.engineLabel}
                  </span>
                  <button
                    type="button"
                    className="text-[11px] text-surface-400 underline hover:text-surface-100"
                    onClick={() => setAnalysis(null)}
                  >
                    Change image
                  </button>
                </div>
                <p className="leading-relaxed text-surface-200">{analysis.summary}</p>
                {analysis.fallbackNotice && (
                  <p className="rounded border border-warning-500/35 bg-warning-500/10 px-2 py-1.5 text-[11px] text-warning-300">
                    {analysis.fallbackNotice}
                  </p>
                )}
              </div>

              {/* Layer Group Checkboxes */}
              <div className="rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-950/40 p-3 space-y-2">
                <span className="block font-semibold text-surface-200">Layers to generate</span>
                <div className="grid gap-1.5">
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={includeLandmasses} onChange={e => setIncludeLandmasses(e.target.checked)} className="accent-[hsl(var(--brand-green))]" />
                      Landmasses & islands
                    </span>
                    <span className="tabular-nums text-surface-400">{analysis.landmasses.length}</span>
                  </label>
                  {analysis.lakes.length > 0 && (
                    <label className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={includeLakes} onChange={e => setIncludeLakes(e.target.checked)} className="accent-[hsl(var(--brand-green))]" />
                        Inland lakes & seas
                      </span>
                      <span className="tabular-nums text-surface-400">{analysis.lakes.length}</span>
                    </label>
                  )}
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={includeBiomes} onChange={e => setIncludeBiomes(e.target.checked)} className="accent-[hsl(var(--brand-green))]" />
                      Blended biome regions
                    </span>
                    <span className="tabular-nums text-surface-400">{analysis.biomeZones.length}</span>
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={includePaths} onChange={e => setIncludePaths(e.target.checked)} className="accent-[hsl(var(--brand-green))]" />
                      Rivers, roads & borders
                    </span>
                    <span className="tabular-nums text-surface-400">{analysis.paths.length}</span>
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={includeMountains} onChange={e => setIncludeMountains(e.target.checked)} className="accent-[hsl(var(--brand-green))]" />
                      <span className="h-2 w-2 rounded-full bg-[#fbbf24]" aria-hidden="true" />
                      Mountain stamps
                    </span>
                    <span className="tabular-nums text-surface-400">{stampCounts.mountains}</span>
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={includeForests} onChange={e => setIncludeForests(e.target.checked)} className="accent-[hsl(var(--brand-green))]" />
                      <span className="h-2 w-2 rounded-full bg-[#4ade80]" aria-hidden="true" />
                      Forest stamps
                    </span>
                    <span className="tabular-nums text-surface-400">{stampCounts.forests}</span>
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={includeSettlements} onChange={e => setIncludeSettlements(e.target.checked)} className="accent-[hsl(var(--brand-green))]" />
                      <span className="h-2 w-2 rounded-full bg-[#f472b6]" aria-hidden="true" />
                      Settlement stamps
                    </span>
                    <span className="tabular-nums text-surface-400">{stampCounts.settlements}</span>
                  </label>
                  {analysis.suggestedStamps.length > 0 && (
                    <label className="flex items-start justify-between gap-2 rounded-md border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper)/0.6)] p-2">
                      <span className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={includeSuggestedNature}
                          onChange={e => setIncludeSuggestedNature(e.target.checked)}
                          className="mt-0.5 accent-[hsl(var(--brand-green))]"
                        />
                        <span>
                          <span className="block font-medium text-surface-200">Auto-place natural mountains & forests</span>
                          <span className="block text-[10px] text-surface-400">Adds mountain ridges & woodlands along continent interiors</span>
                        </span>
                      </span>
                      <span className="tabular-nums text-surface-400">+{analysis.suggestedStamps.length}</span>
                    </label>
                  )}
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={includeLabels} onChange={e => setIncludeLabels(e.target.checked)} className="accent-[hsl(var(--brand-green))]" />
                      Map text labels
                    </span>
                    <span className="tabular-nums text-surface-400">{analysis.labels.length}</span>
                  </label>
                  {analysis.suggestedWidthKm && (
                    <label className="flex items-center justify-between border-t border-[hsl(var(--studio-edge))] pt-1.5">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" checked={applyScale} onChange={e => setApplyScale(e.target.checked)} className="accent-[hsl(var(--brand-green))]" />
                        Set world scale ({analysis.suggestedScaleLabel})
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Coastline Roughness & Replace/Append */}
              <div className="rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-950/40 p-3 space-y-2.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-surface-200">Coastline Roughness</span>
                    <output className="tabular-nums text-surface-300">{roughness}</output>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {ROUGHNESS_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        aria-pressed={roughness === preset.value}
                        onClick={() => setRoughness(preset.value)}
                        className={cn(
                          'rounded border py-1 text-[10px] font-medium transition-colors',
                          roughness === preset.value
                            ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                            : 'border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] text-surface-400 hover:bg-surface-850 hover:text-surface-100'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {hasExistingLayers && (
                  <div className="grid grid-cols-2 gap-1.5 border-t border-[hsl(var(--studio-edge))] pt-2">
                    <button
                      type="button"
                      aria-pressed={applyMode === 'replace'}
                      onClick={() => setApplyMode('replace')}
                      className={cn(
                        controlBtn,
                        applyMode === 'replace' && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                      )}
                    >
                      Replace layers
                    </button>
                    <button
                      type="button"
                      aria-pressed={applyMode === 'append'}
                      onClick={() => setApplyMode('append')}
                      className={cn(
                        controlBtn,
                        applyMode === 'append' && '!border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] !text-[hsl(var(--brand-green))]'
                      )}
                    >
                      Add to existing
                    </button>
                  </div>
                )}
              </div>

              {/* Correction / Re-analyze */}
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={userNote}
                    disabled={analyzing}
                    onChange={event => setUserNote(event.target.value)}
                    placeholder="Correction hint (optional), then Re-analyze…"
                    className="min-w-0 flex-1 rounded-md border border-[hsl(var(--studio-edge))] bg-surface-950 px-2.5 py-1.5 text-xs text-surface-100 placeholder:text-surface-500"
                  />
                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={() => void runAnalysis()}
                    className={controlBtn}
                  >
                    {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Re-analyze
                  </button>
                </div>
                {analyzing && progress && (
                  <div className="space-y-1 rounded-md border border-[hsl(var(--brand-green)/0.3)] bg-[hsl(var(--brand-green-bg)/0.2)] px-2.5 py-1.5">
                    <div className="flex items-center justify-between text-[10px] text-surface-200">
                      <span className="truncate">{progress.stage}</span>
                      <span className="tabular-nums text-[hsl(var(--brand-green))]">{progress.percent}%</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-900">
                      <div
                        className="h-full rounded-full bg-[hsl(var(--brand-green))] transition-all duration-200"
                        style={{ width: `${Math.max(4, Math.min(100, progress.percent))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--studio-edge))] pt-3">
              <button type="button" className={controlBtn} disabled={analyzing} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                disabled={analyzing}
                onClick={handleGenerate}
                className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--brand-green))] px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45 dark:text-surface-950"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Generate Editable Map
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
