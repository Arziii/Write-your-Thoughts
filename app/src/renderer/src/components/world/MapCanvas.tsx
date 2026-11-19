import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { LocateFixed, MapPin as PinIcon, Minus, Plus } from 'lucide-react'
import type { MapPin } from '../../../../shared/maps'

const blankSize = { width: 1600, height: 1000 }
const homeView = { x: 0, y: 0, zoom: 1 }
type Point = { x: number; y: number }
type NamedPin = MapPin & { name: string }

interface MapCanvasProps {
  imageUrl: string | null
  pins: NamedPin[]
  selectedLocationId: string
  placing: boolean
  onSelectPin: (locationId: string) => void
  onPlace: (point: Point) => void
}

export default function MapCanvas({ imageUrl, pins, selectedLocationId, placing, onSelectPin, onPlace }: MapCanvasProps) {
  const viewport = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const [view, setView] = useState(homeView)
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 })
  const [imageSize, setImageSize] = useState(blankSize)
  const [invalidImage, setInvalidImage] = useState(false)
  const fit = Math.min(
    Math.max(1, viewportSize.width - 56) / imageSize.width,
    Math.max(1, viewportSize.height - 56) / imageSize.height,
    1,
  )
  const scale = fit * view.zoom
  const width = imageSize.width * scale
  const height = imageSize.height * scale
  const left = (viewportSize.width - width) / 2 + view.x
  const top = (viewportSize.height - height) / 2 + view.y

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
      const rect = element!.getBoundingClientRect()
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      zoomAt(Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.005),
        event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [fit])

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (placing) {
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = (event.clientX - bounds.left - left) / width
      const y = (event.clientY - bounds.top - top) / height
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) onPlace({ x, y })
      return
    }
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
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
      onLostPointerCapture={() => { drag.current = null }}
      className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden bg-surface-900 focus-visible:outline-accent-500 ${placing ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
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
            className="h-full w-full"
            onLoad={event => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => setInvalidImage(true)}
          />
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
          onPointerDown={event => { if (!placing) event.stopPropagation() }}
          onClick={() => { if (!placing) onSelectPin(pin.locationId) }}
          className={`absolute -translate-x-1/2 -translate-y-full rounded-full border p-1.5 shadow-md ${selectedLocationId === pin.locationId
            ? 'border-accent-500 bg-accent-500 text-white'
            : 'border-surface-700 bg-surface-950 text-accent-600 hover:border-accent-500'}`}
          style={{ left: left + pin.x * width, top: top + pin.y * height }}
        >
          <PinIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}

      <div
        className="absolute bottom-4 right-4 flex cursor-default items-center rounded-lg border border-surface-700 bg-surface-950 p-1 shadow-sm"
        onPointerDown={event => event.stopPropagation()}
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

