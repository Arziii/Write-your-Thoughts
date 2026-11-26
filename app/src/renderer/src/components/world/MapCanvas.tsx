import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { LocateFixed, MapPin as PinIcon, Minus, Plus } from 'lucide-react'
import type { MapPin } from '../../../../shared/maps'
import { atlasHeight, atlasWidth } from './atlasPaths'

const blankSize = { width: atlasWidth, height: atlasHeight }
const homeView = { x: 0, y: 0, zoom: 1 }
export type MapPoint = { x: number; y: number }
type MapBrush = {
  diameter: number
  start: (point: MapPoint) => void
  move: (point: MapPoint) => void
  finish: () => void
  cancel: () => void
}
type NamedPin = MapPin & { name: string }

interface MapCanvasProps {
  overlay?: ReactNode | ((aspectRatio: number) => ReactNode)
  placementPreview?: (point: MapPoint) => ReactNode
  brush?: MapBrush
  imageUrl: string | null
  hideImage?: boolean
  fitTrigger?: boolean
  pins: NamedPin[]
  selectedLocationId: string
  placing: boolean
  onSelectPin: (locationId: string) => void
  onPlace: (point: MapPoint) => void
}

export default function MapCanvas({ overlay, placementPreview, brush, imageUrl, hideImage, fitTrigger, pins, selectedLocationId, placing, onSelectPin, onPlace }: MapCanvasProps) {
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const painting = useRef<number | null>(null)
  const [cursor, setCursor] = useState<MapPoint | null>(null)
  const [view, setView] = useState(homeView)
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 })
  const [imageSize, setImageSize] = useState(blankSize)
  const [invalidImage, setInvalidImage] = useState(false)
  const fit = Math.min(
    Math.max(1, viewportSize.width - 8) / imageSize.width,
    Math.max(1, viewportSize.height - 8) / imageSize.height,
  )
  const scale = fit * view.zoom
  const width = imageSize.width * scale
  const height = imageSize.height * scale
  const left = (viewportSize.width - width) / 2 + view.x
  const top = (viewportSize.height - height) / 2 + view.y

  useEffect(() => {
    setView(homeView)
  }, [fitTrigger])

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportSize({ width: element.clientWidth, height: element.clientHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function zoomAt(factor: number, x = 0, y = 0) {
    setView(previous => {
      const zoom = Math.min(Math.max(24, 2 / fit), Math.max(0.5, previous.zoom * factor))
      const ratio = zoom / previous.zoom
      return { zoom, x: x + (previous.x - x) * ratio, y: y + (previous.y - y) * ratio }
    })
  }

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      if (painting.current !== null) return
      const rect = element!.getBoundingClientRect()
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      zoomAt(Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.0025),
        event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [fit])

  function mapPoint(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - bounds.left - left) / width, y: (event.clientY - bounds.top - top) / height }
  }

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (painting.current !== null || drag.current) return
    if (event.button === 0 && brush) {
      const point = mapPoint(event)
      if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return
      painting.current = event.pointerId
      event.currentTarget.setPointerCapture(event.pointerId)
      brush.start(point)
      return
    }
    if (event.button !== 0 && event.button !== 1) return
    if (placing && event.button === 0) {
      const { x, y } = mapPoint(event)
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onPlace({ x, y })
      return
    }
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (brush || placementPreview) {
      const point = mapPoint(event)
      setCursor(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 ? point : null)
      if (brush && painting.current === event.pointerId) {
        brush.move({ x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)) })
        return
      }
    }
    const start = drag.current
    if (!start || event.pointerId !== start.id) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    start.x = event.clientX
    start.y = event.clientY
    setView(current => ({ ...current, x: current.x + dx, y: current.y + dy }))
  }

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    const pan = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] }
    if (event.key in pan) {
      const [dx, dy] = pan[event.key as keyof typeof pan]
      setView(current => ({ ...current, x: current.x + dx, y: current.y + dy }))
    } else if (event.key === '+' || event.key === '=') zoomAt(1.25)
    else if (event.key === '-') zoomAt(0.8)
    else if (event.key === '0') setView(homeView)
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={viewport}
      tabIndex={0}
      role="region"
      aria-label="Map canvas. Use arrow keys to pan, plus and minus to zoom, and zero to fit."
      onKeyDown={handleKey}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerLeave={() => setCursor(null)}
      onPointerUp={event => {
        if (painting.current !== event.pointerId) return
        painting.current = null
        const point = mapPoint(event)
        brush?.move({ x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)) })
        brush?.finish()
      }}
      onLostPointerCapture={event => {
        if (drag.current?.id === event.pointerId) drag.current = null
        if (painting.current !== event.pointerId) return
        painting.current = null
        brush?.cancel()
      }}
      className={`studio-desk relative min-h-0 flex-1 touch-none select-none overflow-hidden !p-0 focus-visible:outline-accent-500 ${placing || brush ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <div
        className="pointer-events-none absolute border border-surface-700 bg-surface-950 shadow-sm"
        style={{
          width, height, left, top,
          backgroundImage: 'linear-gradient(to right, hsl(var(--surface-800)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--surface-800)) 1px, transparent 1px)',
          backgroundSize: `${Math.max(6, 80 * scale)}px ${Math.max(6, 80 * scale)}px`,
        }}
      >
        {imageUrl && !invalidImage && (
          <img
            src={imageUrl}
            alt="Reference map"
            draggable={false}
            className={`h-full w-full ${hideImage ? 'invisible' : ''}`}
            onLoad={event => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => setInvalidImage(true)}
          />
        )}
        {typeof overlay === 'function' ? overlay(imageSize.width / imageSize.height) : overlay}
        {placementPreview && cursor && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {placementPreview(cursor)}
          </div>
        )}
      </div>

      {invalidImage && <p role="status" className="pointer-events-none absolute inset-x-4 top-4 text-center text-sm text-surface-400">This image could not be displayed. Import a replacement.</p>}

      {pins.map(pin => (
        <button
          key={pin.locationId}
          type="button"
          aria-label={pin.name}
          aria-pressed={selectedLocationId === pin.locationId}
          title={pin.name}
          onPointerDown={event => { if (!placing && !brush && event.button === 0) event.stopPropagation() }}
          onClick={() => { if (!placing && !brush) onSelectPin(pin.locationId) }}
          className={`absolute -translate-x-1/2 -translate-y-full rounded-full border p-1.5 shadow-md ${selectedLocationId === pin.locationId
            ? 'border-accent-500 bg-accent-500 text-white'
            : 'border-surface-700 bg-surface-950 text-accent-600 hover:border-accent-500'}`}
          style={{ left: left + pin.x * width, top: top + pin.y * height }}
        >
          <PinIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}

      {brush && brush.diameter > 0 && cursor && (
        <div aria-hidden="true" className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_1px_#333]"
          style={{ left: left + cursor.x * width, top: top + cursor.y * height, width: width * brush.diameter / atlasWidth, height: height * brush.diameter / atlasHeight }} />
      )}

      <div
        className="absolute bottom-4 right-4 flex cursor-default items-center rounded-lg border border-surface-700 bg-surface-950 p-1 shadow-sm"
        onPointerDown={event => event.stopPropagation()}
        onPointerMove={event => { event.stopPropagation(); setCursor(null) }}
      >
        <button type="button" className="rounded p-2 hover:bg-surface-800" title="Zoom out" aria-label="Zoom out" onClick={() => zoomAt(0.8)}><Minus className="h-4 w-4" /></button>
        <button type="button" className="rounded p-2 hover:bg-surface-800" title="Zoom in" aria-label="Zoom in" onClick={() => zoomAt(1.25)}><Plus className="h-4 w-4" /></button>
        <button type="button" className="flex items-center gap-1.5 rounded p-2 text-xs hover:bg-surface-800" onClick={() => setView(homeView)}>
          <LocateFixed className="h-4 w-4" aria-hidden="true" /> Fit map
        </button>
      </div>
    </div>
  )
}

