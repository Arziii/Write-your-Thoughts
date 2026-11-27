import { MAP_IMAGE_LIMIT } from '../../../../../shared/maps'
import type { VisionImageInput } from '../../../services/ai/BaseProvider'
import { ProviderFactory } from '../../../services/ai/ProviderFactory'
import { getAIConfigurationError, isLocalAIProvider, resolveAISettings } from '../../../services/ai/configuration'
import type { AIProvider, Settings } from '../../../types'
import { stampsById } from './mapStampAssets'
import { resolveTerrainName } from './terrainAssets'
import { traceDraftContours } from './mapContourTracer'
import type { DraftDetailLevel, DraftImageStyle, NormalizedPoint } from './mapContourTracer'

export type DraftEngineKind = 'cloud_vision' | 'local_vision' | 'offline'

export type DraftLandmass = {
  id: string
  name: string
  biome: string
  points: NormalizedPoint[]
  centroid: NormalizedPoint
}

export type DraftLake = {
  id: string
  name: string
  points: NormalizedPoint[]
}

export type DraftBiomeZone = {
  id: string
  biome: string
  center: NormalizedPoint
  radius: number
}

export type DraftPath = {
  id: string
  kind: 'River' | 'Route' | 'Border'
  name: string
  points: NormalizedPoint[]
  preset?: string
}

export type DraftStamp = {
  id: string
  kind: 'mountains' | 'forests' | 'settlements'
  stampId: string
  label: string
  point: NormalizedPoint
  size: number
}

export type DraftLabel = {
  id: string
  text: string
  point: NormalizedPoint
  size: number
}

export type MapDraftAnalysis = {
  engine: DraftEngineKind
  engineLabel: string
  fallbackNotice?: string
  imageStyle: DraftImageStyle
  summary: string
  suggestedWidthKm?: number
  suggestedScaleLabel?: string
  landmasses: DraftLandmass[]
  lakes: DraftLake[]
  biomeZones: DraftBiomeZone[]
  paths: DraftPath[]
  stamps: DraftStamp[]
  suggestedStamps: DraftStamp[]
  labels: DraftLabel[]
  usedTracedContours: boolean
}

export type PreparedDraftImage = {
  previewUrl: string
  visionImageHigh: VisionImageInput
  visionImageStandard: VisionImageInput
  bitmap: ImageBitmap
  width: number
  height: number
}

const SCALE_PRESET_WIDTH_KM: Record<string, { km: number; label: string }> = {
  world: { km: 40075, label: 'World / Earth (40,075 km)' },
  continent: { km: 6000, label: 'Continent (6,000 km)' },
  kingdom: { km: 1200, label: 'Kingdom (1,200 km)' },
  region: { km: 250, label: 'Region (250 km)' },
  city: { km: 12, label: 'City / Local (12 km)' },
}

const VALID_STAMPS_PROMPT = {
  mountains: 'alpine_range, snow_peak, snow_ridge, rocky_ridge, misty_peak, foothills, mountain_cluster_01, peak_01, peak_02',
  forests: 'dense_forest, mixed_forest, pine_grove, oak_grove, woodland, ancient_oak',
  settlements: 'coastal_castle, painted_castle, walled_town, painted_town, town_01, village, village_01, watercolour_village',
}

const SINGLE_PASS_PROMPT = `You are a master cartographer analyzing an author's draft map sketch or reference map image for a fantasy map editor.
Inspect the image carefully and extract its geography in normalized [0..1] image coordinates where x=0 is left, x=1 is right, y=0 is top, y=1 is bottom.
Ignore decorative compass roses, map borders, title cartouches, and legend boxes.

Return ONLY valid JSON with this exact schema:
{
  "summary": "Brief 1-2 sentence overview of the continents, regions, and landmarks detected.",
  "imageStyle": "line_sketch" | "colored_draft" | "reference_map",
  "scalePreset": "world" | "continent" | "kingdom" | "region" | "city",
  "waterSeeds": [{ "x": 0.05, "y": 0.05 }],
  "landSeeds": [{ "x": 0.5, "y": 0.5 }],
  "landmasses": [{ "name": "Mainland", "biome": "Grassland", "points": [{ "x": 0.2, "y": 0.3 }] }],
  "biomeZones": [{ "biome": "Snow", "center": { "x": 0.5, "y": 0.2 }, "radius": 0.12 }],
  "rivers": [{ "name": "Silver River", "points": [{ "x": 0.5, "y": 0.3 }, { "x": 0.6, "y": 0.6 }], "size": "stream" | "river" | "wide_river" }],
  "roads": [{ "name": "King's Road", "points": [{ "x": 0.4, "y": 0.5 }, { "x": 0.7, "y": 0.5 }], "kind": "dirt" | "cobblestone" | "trade_route" | "forest_trail" }],
  "borders": [{ "name": "Northern Reach", "points": [{ "x": 0.3, "y": 0.3 }, { "x": 0.5, "y": 0.4 }], "closed": false }],
  "mountains": [{ "stampId": "alpine_range", "x": 0.5, "y": 0.3, "size": 1.0 }],
  "forests": [{ "stampId": "dense_forest", "x": 0.4, "y": 0.5, "size": 0.9 }],
  "settlements": [{ "stampId": "walled_town", "name": "Optional name", "x": 0.6, "y": 0.55, "size": 0.85 }],
  "labels": [{ "text": "Sea of Glass", "x": 0.2, "y": 0.8, "size": 1.1 }]
}

STRICT RULES:
- Valid biomes ONLY: Grassland, Plains, Woodland, Highlands, Snow, Desert, Marsh, Ashlands.
- Valid mountain stampId ONLY: ${VALID_STAMPS_PROMPT.mountains}.
- Valid forest stampId ONLY: ${VALID_STAMPS_PROMPT.forests}.
- Valid settlement stampId ONLY: ${VALID_STAMPS_PROMPT.settlements}.
- Give 3-6 accurate waterSeeds placed inside ocean/water and 3-6 landSeeds inside major landmasses.`

const PASS1_GEOGRAPHY_PROMPT = `You are a master cartographer performing Pass 1 (Macro Geography & Linear Features) on an author's draft or reference map.
Inspect every region in normalized [0..1] coordinates (x=0 left, x=1 right, y=0 top, y=1 bottom).
Ignore decorative compass roses, map borders, title cartouches, and legend boxes.

Return ONLY valid JSON with this exact schema:
{
  "summary": "1-2 sentence cartographic summary of the continents, biomes, rivers, and routes detected.",
  "imageStyle": "line_sketch" | "colored_draft" | "reference_map",
  "scalePreset": "world" | "continent" | "kingdom" | "region" | "city",
  "waterSeeds": [{ "x": 0.05, "y": 0.05 }],
  "landSeeds": [{ "x": 0.5, "y": 0.5 }],
  "landmasses": [
    { "name": "Continent name", "biome": "Plains", "points": [{ "x": 0.2, "y": 0.3 }] }
  ],
  "biomeZones": [
    { "biome": "Snow", "center": { "x": 0.5, "y": 0.2 }, "radius": 0.1 }
  ],
  "rivers": [
    { "name": "River name", "points": [{ "x": 0.5, "y": 0.3 }, { "x": 0.6, "y": 0.6 }], "size": "stream" | "river" | "wide_river" }
  ],
  "roads": [
    { "name": "Road name", "points": [{ "x": 0.4, "y": 0.5 }, { "x": 0.7, "y": 0.5 }], "kind": "dirt" | "cobblestone" | "trade_route" | "forest_trail" }
  ],
  "borders": [
    { "name": "Realm name", "points": [{ "x": 0.3, "y": 0.3 }, { "x": 0.5, "y": 0.4 }], "closed": false }
  ]
}

STRICT RULES:
- Valid biomes ONLY: Grassland, Plains, Woodland, Highlands, Snow, Desert, Marsh, Ashlands.
- Place 4-8 waterSeeds in clear ocean/sea water and 4-8 landSeeds inside major continents/islands.
- Trace up to 16 landmasses (14-32 vertices), up to 18 biomeZones, up to 14 rivers, up to 14 roads, and up to 10 borders with detailed multi-point geometry.`

const PASS2_DETAILS_PROMPT = `You are a master cartographer performing Pass 2 (Detailed Landmarks, Mountain Ridges, Forests, Settlements & Map Labels).
Focus exhaustively on every visible mountain ridge, forest cluster, settlement symbol/city/castle, and readable map text label in normalized [0..1] coordinates.
Ignore decorative compass roses and frame ornaments.

Return ONLY valid JSON with this exact schema:
{
  "mountains": [{ "stampId": "alpine_range", "name": "Optional peak/range name", "x": 0.5, "y": 0.3, "size": 0.9 }],
  "forests": [{ "stampId": "dense_forest", "name": "Optional wood name", "x": 0.4, "y": 0.5, "size": 0.85 }],
  "settlements": [{ "stampId": "walled_town", "name": "Town name if readable", "x": 0.6, "y": 0.55, "size": 0.85 }],
  "labels": [{ "text": "Visible text label", "x": 0.2, "y": 0.8, "size": 1.05 }]
}

STRICT RULES:
- Valid mountain stampId ONLY: ${VALID_STAMPS_PROMPT.mountains} (up to 36 stamps tracing along every visible range).
- Valid forest stampId ONLY: ${VALID_STAMPS_PROMPT.forests} (up to 36 stamps covering visible woods/taiga/jungles).
- Valid settlement stampId ONLY: ${VALID_STAMPS_PROMPT.settlements} (up to 28 settlements).
- Extract up to 32 clearly readable ocean/continent/region/settlement labels; omit invented names.`

const clampCoord = (n: unknown, fallback = 0.5) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0.01, Math.min(0.99, n)) : fallback

function sanitizePoints(raw: unknown, minCount: number): NormalizedPoint[] {
  if (!Array.isArray(raw)) return []
  const pts: NormalizedPoint[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    if (typeof rec.x === 'number' && Number.isFinite(rec.x) && typeof rec.y === 'number' && Number.isFinite(rec.y)) {
      pts.push({ x: clampCoord(rec.x), y: clampCoord(rec.y) })
    }
  }
  return pts.length >= minCount ? pts : []
}

function centroidOf(points: NormalizedPoint[]): NormalizedPoint {
  if (!points.length) return { x: 0.5, y: 0.5 }
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / points.length, y: sy / points.length }
}

function resolveStampId(kind: 'mountains' | 'forests' | 'settlements', candidate: unknown, hint = ''): string {
  const id = typeof candidate === 'string' ? candidate.trim() : ''
  const exact = stampsById.get(id)
  if (exact && exact.category === kind) return exact.id

  const text = `${id} ${hint}`.toLowerCase()
  if (kind === 'mountains') {
    if (/snow|ice|glacier|frost/.test(text)) return /ridge|range/.test(text) ? 'snow_ridge' : 'snow_peak'
    if (/foot|hill/.test(text)) return 'foothills'
    if (/mist|cloud/.test(text)) return 'misty_peak'
    if (/cluster|range/.test(text)) return 'alpine_range'
    if (/rock|crag|ridge/.test(text)) return 'rocky_ridge'
    if (/peak/.test(text)) return 'peak_01'
    return 'alpine_range'
  }
  if (kind === 'forests') {
    if (/pine|taiga|boreal|conifer/.test(text)) return 'pine_grove'
    if (/oak/.test(text)) return 'oak_grove'
    if (/ancient|old/.test(text)) return 'ancient_oak'
    if (/mix/.test(text)) return 'mixed_forest'
    if (/wood|grove|small/.test(text)) return 'woodland'
    return 'dense_forest'
  }
  if (/coast|port|harbor|harbour/.test(text)) return 'coastal_castle'
  if (/castle|citadel|fort|keep/.test(text)) return 'castle_01'
  if (/village|hamlet/.test(text)) return 'village'
  if (/city|capital|walled/.test(text)) return 'walled_town'
  return 'town_01'
}

export function detectDraftEngine(settings: Settings | null): {
  kind: DraftEngineKind
  label: string
  provider?: AIProvider
  reason?: string
} {
  const error = getAIConfigurationError(settings)
  if (error || !settings) {
    return {
      kind: 'offline',
      label: 'Built-in Offline Analyzer',
      reason: error || 'Configure an AI provider in Settings to enable semantic Vision detection.',
    }
  }
  const provider = settings.ai_provider || 'openai'
  const configured = settings.ai_settings?.[provider]
  const local = isLocalAIProvider(provider, configured?.baseUrl)
  if (local) {
    return {
      kind: 'local_vision',
      provider,
      label: `${provider === 'ollama' ? 'Ollama' : provider === 'lmstudio' ? 'LM Studio' : 'Local AI'} Vision + Tracer`,
    }
  }
  const names: Partial<Record<AIProvider, string>> = {
    openai: 'OpenAI Vision',
    gemini: 'Gemini Vision',
    claude: 'Claude Vision',
    openrouter: 'OpenRouter Vision',
    mistral: 'Mistral Vision',
    together: 'Together Vision',
    xai: 'xAI Vision',
    groq: 'Groq Vision',
    custom: 'Custom Vision AI',
  }
  return {
    kind: 'cloud_vision',
    provider,
    label: `${names[provider] || 'AI Vision'} + Tracer`,
  }
}

function encodeScaledJpeg(bitmap: ImageBitmap, maxSide: number, quality: number): VisionImageInput {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const targetW = Math.max(1, Math.round(bitmap.width * scale))
  const targetH = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not prepare canvas context for image analysis.')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return { mimeType: 'image/jpeg', base64, dataUrl }
}

export async function prepareDraftImage(file: File): Promise<PreparedDraftImage> {
  if (file.size > MAP_IMAGE_LIMIT) throw new Error('Choose an image up to 40 MB.')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This image could not be decoded. Try PNG, JPEG, or WebP.')
  })

  const visionImageStandard = encodeScaledJpeg(bitmap, 1024, 0.86)
  const visionImageHigh = Math.max(bitmap.width, bitmap.height) > 1024
    ? encodeScaledJpeg(bitmap, 1600, 0.92)
    : visionImageStandard
  const previewUrl = URL.createObjectURL(file)

  return {
    previewUrl,
    visionImageHigh,
    visionImageStandard,
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
  }
}

export async function analyzeMapDraft({
  bitmap,
  visionImageHigh,
  visionImageStandard,
  settings,
  mode,
  detail = 'high',
  userNote,
  signal,
  onProgress,
}: {
  bitmap: ImageBitmap
  visionImageHigh: VisionImageInput
  visionImageStandard: VisionImageInput
  settings: Settings | null
  mode: 'auto' | 'offline'
  detail?: DraftDetailLevel
  userNote?: string
  signal?: AbortSignal
  onProgress?: (stage: string, percent: number) => void
}): Promise<MapDraftAnalysis> {
  const detected = detectDraftEngine(settings)
  let activeEngine: DraftEngineKind = mode === 'offline' ? 'offline' : detected.kind
  let engineLabel = mode === 'offline' ? 'Built-in Offline Analyzer' : detected.label
  let fallbackNotice: string | undefined
  let aiJson: any = null

  if (activeEngine !== 'offline' && detected.provider && settings) {
    try {
      const providerSettings = resolveAISettings(detected.provider, settings.ai_api_key, settings.ai_settings)
      const ai = ProviderFactory.create(detected.provider, providerSettings)
      const visionPayload = detail === 'high' && activeEngine === 'cloud_vision'
        ? visionImageHigh
        : visionImageStandard

      if (detail === 'high') {
        onProgress?.('Vision AI Pass 1/2: Reading continents, biomes & routes…', 10)
        const prompt1 = userNote?.trim()
          ? `Analyze the macro geography of this draft map.\n\nAuthor note / hints: ${userNote.trim()}`
          : 'Analyze the macro geography of this draft map: extract continents, islands, biomes, rivers, roads, and borders.'
        const pass1 = await ai.generateJSONWithImage(PASS1_GEOGRAPHY_PROMPT, prompt1, visionPayload, signal)
        signal?.throwIfAborted()

        onProgress?.('Vision AI Pass 2/2: Locating ridges, forests, settlements & labels…', 28)
        let pass2: any = {}
        try {
          const detectedNames = Array.isArray(pass1?.landmasses)
            ? pass1.landmasses.map((m: any) => m?.name).filter((n: unknown) => typeof n === 'string').slice(0, 6).join(', ')
            : ''
          const prompt2 = [
            'Locate all mountain chains, forests, settlements, and map labels in detail.',
            detectedNames ? `Major regions identified in Pass 1: ${detectedNames}.` : '',
            userNote?.trim() ? `Author note / hints: ${userNote.trim()}` : '',
          ].filter(Boolean).join('\n\n')
          pass2 = await ai.generateJSONWithImage(PASS2_DETAILS_PROMPT, prompt2, visionPayload, signal)
        } catch (pass2Error) {
          if (signal?.aborted || (pass2Error instanceof DOMException && pass2Error.name === 'AbortError')) {
            throw pass2Error
          }
          // Pass 2 failed cleanly; keep Pass 1 geography + offline detail tracing
        }
        aiJson = { ...pass1, ...pass2 }
      } else {
        onProgress?.('Running Vision AI analysis…', 15)
        const prompt = userNote?.trim()
          ? `Analyze this draft map image and extract structured geography.\n\nAuthor note / hints: ${userNote.trim()}`
          : 'Analyze this draft map image and extract continents, biomes, rivers, roads, borders, mountains, forests, settlements, and labels.'
        aiJson = await ai.generateJSONWithImage(SINGLE_PASS_PROMPT, prompt, visionPayload, signal)
      }
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw error
      }
      const message = error instanceof Error ? error.message : 'Vision request failed.'
      const looksLikeNoVision = /vision|image|multimodal|does not support|invalid_request_error|unsupported content|http 400/i.test(message)
      fallbackNotice = looksLikeNoVision
        ? 'Your configured AI model could not process images, so the built-in offline analyzer traced this map automatically.'
        : `Vision AI was unavailable (${message}), so the built-in offline analyzer traced this map automatically.`
      activeEngine = 'offline'
      engineLabel = 'Built-in Offline Analyzer'
      aiJson = null
    }
  }

  signal?.throwIfAborted()

  const aiStyle: DraftImageStyle | undefined =
    aiJson?.imageStyle === 'line_sketch' || aiJson?.imageStyle === 'colored_draft' || aiJson?.imageStyle === 'reference_map'
      ? aiJson.imageStyle
      : undefined
  const waterSeeds = sanitizePoints(aiJson?.waterSeeds, 1)
  const landSeeds = sanitizePoints(aiJson?.landSeeds, 1)

  const traced = await traceDraftContours(bitmap, {
    imageStyle: aiStyle,
    detail,
    waterSeeds: waterSeeds.length ? waterSeeds : undefined,
    landSeeds: landSeeds.length ? landSeeds : undefined,
    signal,
    onProgress: (stage, pct) => {
      const scaled = aiJson ? Math.round(35 + pct * 0.6) : pct
      onProgress?.(stage, scaled)
    },
  })

  // Assemble AI landmass candidates
  const aiLandmasses: Array<{ name: string; biome: string; points: NormalizedPoint[]; centroid: NormalizedPoint }> = []
  if (Array.isArray(aiJson?.landmasses)) {
    for (let i = 0; i < Math.min(aiJson.landmasses.length, 16); i++) {
      const item = aiJson.landmasses[i]
      if (!item || typeof item !== 'object') continue
      const pts = sanitizePoints(item.points, 3)
      if (!pts.length) continue
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `Landmass ${i + 1}`
      const biome = resolveTerrainName(typeof item.biome === 'string' ? item.biome : 'Plains')
      aiLandmasses.push({ name, biome, points: pts, centroid: centroidOf(pts) })
    }
  }

  const useTraced = traced.traceConfidence === 'high' || aiLandmasses.length === 0
  const landmasses: DraftLandmass[] = (useTraced
    ? traced.landmasses.map((lm, index) => {
        let bestMatch = aiLandmasses[0]
        let bestDist = Infinity
        for (const candidate of aiLandmasses) {
          const d = Math.hypot(candidate.centroid.x - lm.centroid.x, candidate.centroid.y - lm.centroid.y)
          if (d < bestDist) {
            bestDist = d
            bestMatch = candidate
          }
        }
        const matched = bestMatch && bestDist < 0.25 ? bestMatch : undefined
        return {
          id: crypto.randomUUID(),
          name: matched?.name || (index === 0 ? 'Mainland' : `Island ${index}`),
          biome: matched?.biome || lm.dominantBiome,
          points: lm.points,
          centroid: lm.centroid,
        }
      })
    : aiLandmasses.map(lm => ({
        id: crypto.randomUUID(),
        name: lm.name,
        biome: lm.biome,
        points: lm.points,
        centroid: lm.centroid,
      }))
  ).slice(0, 32)

  const lakes: DraftLake[] = traced.lakes.slice(0, 16).map((lake, idx) => ({
    id: crypto.randomUUID(),
    name: idx === 0 ? 'Inland Sea' : `Lake ${idx + 1}`,
    points: lake.points,
  }))

  const biomeZones: DraftBiomeZone[] = []
  if (Array.isArray(aiJson?.biomeZones)) {
    for (const zone of aiJson.biomeZones.slice(0, 18)) {
      if (!zone || typeof zone !== 'object') continue
      const center = zone.center && typeof zone.center === 'object'
        ? { x: clampCoord((zone.center as any).x), y: clampCoord((zone.center as any).y) }
        : undefined
      if (!center) continue
      biomeZones.push({
        id: crypto.randomUUID(),
        biome: resolveTerrainName(typeof zone.biome === 'string' ? zone.biome : 'Grassland'),
        center,
        radius: typeof zone.radius === 'number' && Number.isFinite(zone.radius)
          ? Math.max(0.03, Math.min(0.2, zone.radius))
          : 0.08,
      })
    }
  }
  if (biomeZones.length < 4 && traced.biomePatches.length) {
    for (const patch of traced.biomePatches.slice(0, 32)) {
      if (biomeZones.some(z => z.biome === patch.biome && Math.hypot(z.center.x - patch.center.x, z.center.y - patch.center.y) < 0.05)) {
        continue
      }
      biomeZones.push({
        id: crypto.randomUUID(),
        biome: patch.biome,
        center: patch.center,
        radius: patch.radius,
      })
    }
  }

  const paths: DraftPath[] = []
  if (Array.isArray(aiJson?.rivers)) {
    for (let i = 0; i < Math.min(aiJson.rivers.length, 14); i++) {
      const r = aiJson.rivers[i]
      const pts = sanitizePoints(r?.points, 2)
      if (!pts.length) continue
      paths.push({
        id: crypto.randomUUID(),
        kind: 'River',
        name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : `River ${i + 1}`,
        points: pts,
        preset: r.size === 'stream' || r.size === 'wide_river' ? r.size : 'river',
      })
    }
  } else if (traced.rivers.length) {
    traced.rivers.slice(0, 14).forEach((r, i) => {
      paths.push({
        id: crypto.randomUUID(),
        kind: 'River',
        name: `River ${i + 1}`,
        points: r.points,
        preset: r.widthPreset,
      })
    })
  }

  if (Array.isArray(aiJson?.roads)) {
    for (let i = 0; i < Math.min(aiJson.roads.length, 14); i++) {
      const rd = aiJson.roads[i]
      const pts = sanitizePoints(rd?.points, 2)
      if (!pts.length) continue
      paths.push({
        id: crypto.randomUUID(),
        kind: 'Route',
        name: typeof rd.name === 'string' && rd.name.trim() ? rd.name.trim() : `Road ${i + 1}`,
        points: pts,
        preset: typeof rd.kind === 'string' ? rd.kind : 'dirt',
      })
    }
  }

  if (Array.isArray(aiJson?.borders)) {
    for (let i = 0; i < Math.min(aiJson.borders.length, 10); i++) {
      const bd = aiJson.borders[i]
      const minPts = bd?.closed ? 3 : 2
      const pts = sanitizePoints(bd?.points, minPts)
      if (!pts.length) continue
      paths.push({
        id: crypto.randomUUID(),
        kind: 'Border',
        name: typeof bd.name === 'string' && bd.name.trim() ? bd.name.trim() : `Border ${i + 1}`,
        points: pts,
        preset: bd?.closed ? 'closed' : 'dashed',
      })
    }
  }

  const stamps: DraftStamp[] = []
  const isNearExisting = (pt: NormalizedPoint, kind: DraftStamp['kind']) =>
    stamps.some(s => s.kind === kind && Math.hypot(s.point.x - pt.x, s.point.y - pt.y) < 0.022)

  const collectStamps = (rawList: unknown, kind: DraftStamp['kind'], limit: number, defaultSize: number) => {
    if (!Array.isArray(rawList)) return
    for (const item of rawList.slice(0, limit)) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      if (typeof rec.x !== 'number' || typeof rec.y !== 'number') continue
      const point = { x: clampCoord(rec.x), y: clampCoord(rec.y) }
      if (isNearExisting(point, kind)) continue
      const hintName = typeof rec.name === 'string' ? rec.name : ''
      const stampId = resolveStampId(kind, rec.stampId, hintName)
      const asset = stampsById.get(stampId)
      const size = typeof rec.size === 'number' && Number.isFinite(rec.size)
        ? Math.max(0.35, Math.min(2.2, rec.size))
        : defaultSize
      stamps.push({
        id: crypto.randomUUID(),
        kind,
        stampId,
        label: hintName.trim() || asset?.label || kind,
        point,
        size,
      })
    }
  }

  collectStamps(aiJson?.mountains, 'mountains', 42, 0.9)
  collectStamps(aiJson?.forests, 'forests', 42, 0.85)
  collectStamps(aiJson?.settlements, 'settlements', 28, 0.8)

  const appendTracedKind = (kind: DraftStamp['kind']) => {
    for (const item of traced.stamps) {
      if (item.kind !== kind) continue
      if (stamps.some(s => s.kind === kind && Math.hypot(s.point.x - item.point.x, s.point.y - item.point.y) < 0.032)) {
        continue
      }
      const asset = stampsById.get(item.stampId)
      stamps.push({
        id: crypto.randomUUID(),
        kind: item.kind,
        stampId: item.stampId,
        label: item.label || asset?.label || item.kind,
        point: item.point,
        size: item.size,
      })
    }
  }
  if (!aiJson) {
    appendTracedKind('mountains')
    appendTracedKind('forests')
    appendTracedKind('settlements')
  } else {
    if (stamps.filter(s => s.kind === 'mountains').length < 3) appendTracedKind('mountains')
    if (stamps.filter(s => s.kind === 'forests').length < 3) appendTracedKind('forests')
  }

  const suggestedStamps: DraftStamp[] = []
  for (const item of traced.suggestedStamps) {
    if (stamps.some(s => Math.hypot(s.point.x - item.point.x, s.point.y - item.point.y) < 0.045)) continue
    const asset = stampsById.get(item.stampId)
    suggestedStamps.push({
      id: crypto.randomUUID(),
      kind: item.kind,
      stampId: item.stampId,
      label: item.label || asset?.label || item.kind,
      point: item.point,
      size: item.size,
    })
  }

  const labels: DraftLabel[] = []
  if (Array.isArray(aiJson?.labels)) {
    for (const item of aiJson.labels.slice(0, 32)) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const text = typeof rec.text === 'string' ? rec.text.trim() : ''
      if (!text || typeof rec.x !== 'number' || typeof rec.y !== 'number') continue
      labels.push({
        id: crypto.randomUUID(),
        text,
        point: { x: clampCoord(rec.x), y: clampCoord(rec.y) },
        size: typeof rec.size === 'number' && Number.isFinite(rec.size) ? Math.max(0.7, Math.min(2.2, rec.size)) : 1,
      })
    }
  }

  const presetKey = typeof aiJson?.scalePreset === 'string' ? aiJson.scalePreset.toLowerCase() : ''
  const scaleInfo = SCALE_PRESET_WIDTH_KM[presetKey]

  const mtnCount = stamps.filter(s => s.kind === 'mountains').length
  const forestCount = stamps.filter(s => s.kind === 'forests').length
  const townCount = stamps.filter(s => s.kind === 'settlements').length
  const stampParts: string[] = []
  if (mtnCount) stampParts.push(`${mtnCount} mountain stamp${mtnCount === 1 ? '' : 's'}`)
  if (forestCount) stampParts.push(`${forestCount} forest stamp${forestCount === 1 ? '' : 's'}`)
  if (townCount) stampParts.push(`${townCount} settlement stamp${townCount === 1 ? '' : 's'}`)

  const offlineSummary = landmasses.length
    ? `Detected ${landmasses.length} landmass${landmasses.length === 1 ? '' : 'es'}${lakes.length ? `, ${lakes.length} inland lake${lakes.length === 1 ? '' : 's'}` : ''}${biomeZones.length ? `, ${biomeZones.length} biome region${biomeZones.length === 1 ? '' : 's'}` : ''}${paths.length ? `, ${paths.length} river${paths.length === 1 ? '' : 's'}` : ''}${stampParts.length ? `, and ${stampParts.join(', ')}` : ''}.`
    : 'No clear landmass silhouettes were detected automatically. Try high-contrast ink or switch to Vision AI for faint sketches.'

  const summary = typeof aiJson?.summary === 'string' && aiJson.summary.trim()
    ? aiJson.summary.trim()
    : offlineSummary

  onProgress?.('Analysis complete', 100)

  return {
    engine: activeEngine,
    engineLabel,
    fallbackNotice,
    imageStyle: aiStyle || traced.imageStyle,
    summary,
    suggestedWidthKm: scaleInfo?.km,
    suggestedScaleLabel: scaleInfo?.label,
    landmasses,
    lakes,
    biomeZones,
    paths,
    stamps,
    suggestedStamps,
    labels,
    usedTracedContours: useTraced && traced.landmasses.length > 0,
  }
}
