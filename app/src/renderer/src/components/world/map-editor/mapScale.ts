import type { MapPoint } from './MapCanvas'

export type MapDistanceUnit = 'km' | 'mi' | 'leagues'

export interface MapScaleConfig {
  widthKm: number
  unit: MapDistanceUnit
  showScaleBar: boolean
}

export const EARTH_EQUATOR_KM = 40075

export const DEFAULT_MAP_SCALE: MapScaleConfig = {
  widthKm: EARTH_EQUATOR_KM,
  unit: 'km',
  showScaleBar: true,
}

export const MAP_SCALE_PRESETS = [
  { label: 'Earth (World)', widthKm: EARTH_EQUATOR_KM },
  { label: 'Continent', widthKm: 6000 },
  { label: 'Kingdom', widthKm: 1200 },
  { label: 'Region', widthKm: 250 },
  { label: 'City / Local', widthKm: 12 },
] as const

export const KM_PER_UNIT: Record<MapDistanceUnit, number> = {
  km: 1,
  mi: 1.609344,
  leagues: 4.828032,
}

export const UNIT_LABEL: Record<MapDistanceUnit, string> = {
  km: 'km',
  mi: 'mi',
  leagues: 'leagues',
}

export const scaleStorageKey = (mapId: string) => `wyt-parchment-map-scale-${mapId}`

function clampWidthKm(value: number): number {
  if (!Number.isFinite(value)) return EARTH_EQUATOR_KM
  return Math.max(0.5, Math.min(500000, value))
}

export function loadMapScale(mapId: string): MapScaleConfig {
  try {
    const raw = localStorage.getItem(scaleStorageKey(mapId))
    if (!raw) return DEFAULT_MAP_SCALE
    const parsed = JSON.parse(raw) as Partial<MapScaleConfig>
    const unit: MapDistanceUnit =
      parsed.unit === 'mi' || parsed.unit === 'leagues' ? parsed.unit : 'km'
    return {
      widthKm: clampWidthKm(Number(parsed.widthKm)),
      unit,
      showScaleBar: parsed.showScaleBar ?? true,
    }
  } catch {
    return DEFAULT_MAP_SCALE
  }
}

export function saveMapScale(mapId: string, config: MapScaleConfig) {
  try {
    const clean: MapScaleConfig = {
      widthKm: clampWidthKm(config.widthKm),
      unit: config.unit,
      showScaleBar: Boolean(config.showScaleBar),
    }
    localStorage.setItem(scaleStorageKey(mapId), JSON.stringify(clean))
  } catch {}
}

export function disposeMapScale(mapId: string) {
  try {
    localStorage.removeItem(scaleStorageKey(mapId))
  } catch {}
}

export function fromKm(km: number, unit: MapDistanceUnit): number {
  return km / KM_PER_UNIT[unit]
}

export function toKm(value: number, unit: MapDistanceUnit): number {
  return value * KM_PER_UNIT[unit]
}

export function formatNumber(value: number): string {
  if (value >= 100) return Math.round(value).toLocaleString('en-US')
  if (value >= 10) return Number(value.toFixed(1)).toLocaleString('en-US')
  return Number(value.toFixed(2)).toLocaleString('en-US')
}

export function formatDistance(km: number, unit: MapDistanceUnit): string {
  return `${formatNumber(fromKm(km, unit))} ${UNIT_LABEL[unit]}`
}

export function measureSegmentKm(
  a: MapPoint,
  b: MapPoint,
  widthKm: number,
  aspectRatio = 2
): number {
  const safeRatio = aspectRatio > 0 ? aspectRatio : 2
  const dxKm = (b.x - a.x) * widthKm
  const dyKm = (b.y - a.y) * (widthKm / safeRatio)
  return Math.hypot(dxKm, dyKm)
}

export function measurePathKm(
  points: MapPoint[],
  widthKm: number,
  aspectRatio = 2
): { totalKm: number; segmentsKm: number[] } {
  const segmentsKm: number[] = []
  let totalKm = 0
  for (let i = 1; i < points.length; i++) {
    const seg = measureSegmentKm(points[i - 1], points[i], widthKm, aspectRatio)
    segmentsKm.push(seg)
    totalKm += seg
  }
  return { totalKm, segmentsKm }
}

export function calibrateWidthKm(
  points: MapPoint[],
  targetValue: number,
  unit: MapDistanceUnit,
  aspectRatio = 2
): number | null {
  if (points.length < 2 || !Number.isFinite(targetValue) || targetValue <= 0) return null
  const normalizedMeasure = measurePathKm(points, 1, aspectRatio).totalKm
  if (normalizedMeasure <= 1e-6) return null
  const targetKm = toKm(targetValue, unit)
  return clampWidthKm(targetKm / normalizedMeasure)
}

function formatDuration(days: number, hoursPerDay: number): string {
  if (days <= 0) return '0 hrs'
  if (days < 0.5) {
    const hrs = Math.max(0.1, days * hoursPerDay)
    return `~${hrs >= 10 ? Math.round(hrs) : hrs.toFixed(1)} hrs`
  }
  if (days < 28) {
    return `~${days >= 10 ? Math.round(days) : days.toFixed(1)} days`
  }
  if (days < 120) {
    const weeks = days / 7
    return `~${weeks >= 10 ? Math.round(weeks) : weeks.toFixed(1)} wks`
  }
  const months = days / 30
  return `~${months >= 10 ? Math.round(months) : months.toFixed(1)} mos`
}

export function estimateTravelTimes(km: number) {
  return [
    { label: 'On foot', speed: '30 km/day', duration: formatDuration(km / 30, 8) },
    { label: 'Wagon', speed: '40 km/day', duration: formatDuration(km / 40, 8) },
    { label: 'Horseback', speed: '55 km/day', duration: formatDuration(km / 55, 8) },
    { label: 'Sailing ship', speed: '150 km/day', duration: formatDuration(km / 150, 24) },
  ] as const
}

const NICE_MULTIPLIERS = [1, 2, 2.5, 5] as const

export function computeScaleBar(
  mapPixelWidth: number,
  widthKm: number,
  unit: MapDistanceUnit,
  targetPx = 136
): { pixelWidth: number; label: string; halfLabel: string } {
  const safeMapPx = Math.max(1, mapPixelWidth)
  const unitsAcrossMap = fromKm(widthKm, unit)
  const unitsPerPx = unitsAcrossMap / safeMapPx
  const idealUnits = Math.max(1e-4, unitsPerPx * targetPx)
  const power = Math.pow(10, Math.floor(Math.log10(idealUnits)))

  let bestUnits = power
  let bestDiff = Infinity
  for (const exp of [power / 10, power, power * 10]) {
    for (const mult of NICE_MULTIPLIERS) {
      const candidate = mult * exp
      const px = candidate / unitsPerPx
      if (px < 56 || px > 220) continue
      const diff = Math.abs(px - targetPx)
      if (diff < bestDiff) {
        bestDiff = diff
        bestUnits = candidate
      }
    }
  }

  const pixelWidth = Math.max(48, Math.min(240, Math.round(bestUnits / unitsPerPx)))
  return {
    pixelWidth,
    label: `${formatNumber(bestUnits)} ${UNIT_LABEL[unit]}`,
    halfLabel: formatNumber(bestUnits / 2),
  }
}
