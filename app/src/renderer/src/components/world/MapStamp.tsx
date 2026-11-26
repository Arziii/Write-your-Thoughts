import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { MapPoint } from './MapCanvas'
import type { StampAsset } from './mapStampAssets'

export const stampWidthFraction = (asset: StampAsset, size: number) =>
  asset.width / Math.max(asset.width, asset.height) * .055 * size

export function MapStamp({ asset, point, size, angle, opacity, selected, editable, onSelect, onMove }: {
  asset: StampAsset
  point: MapPoint
  size: number
  angle: number
  opacity: number
  selected: boolean
  editable: boolean
  onSelect: () => void
  onMove: (point: MapPoint) => void
}) {
  const [preview, setPreview] = useState<MapPoint | null>(null)
  const stopDrag = useRef<(() => void) | null>(null)
  const position = preview ?? point

  useEffect(() => () => stopDrag.current?.(), [])

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || stopDrag.current) return
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!bounds?.width || !bounds.height) return
    const { width, height } = bounds

    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    const { pointerId, clientX, clientY } = event
    let moved = false
    function dragPoint(next: globalThis.PointerEvent) {
      const dx = next.clientX - clientX
      const dy = next.clientY - clientY
      if (!moved && Math.hypot(dx, dy) < 3) return
      moved = true
      return {
        x: Math.max(0, Math.min(1, point.x + dx / width)),
        y: Math.max(0, Math.min(1, point.y + dy / height)),
      }
    }
    function track(next: globalThis.PointerEvent) {
      if (next.pointerId !== pointerId) return
      const position = dragPoint(next)
      if (position) setPreview(position)
    }
    function finish(next: globalThis.PointerEvent) {
      if (next.pointerId !== pointerId) return
      const position = dragPoint(next)
      cancel()
      if (position && (position.x !== point.x || position.y !== point.y)) onMove(position)
    }
    function cancelPointer(next: globalThis.PointerEvent) {
      if (next.pointerId === pointerId) cancel()
    }
    function cleanup() {
      window.removeEventListener('pointermove', track)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancelPointer)
      window.removeEventListener('blur', cancel)
      stopDrag.current = null
    }
    function cancel() {
      cleanup()
      setPreview(null)
    }
    stopDrag.current = cleanup
    window.addEventListener('pointermove', track)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancelPointer)
    window.addEventListener('blur', cancel)
    onSelect()
  }

  const artwork = <img src={asset.url} alt="" draggable={false} className="block h-auto w-full" style={{ opacity }} />
  const style = {
    left: `${position.x * 100}%`,
    top: `${position.y * 100}%`,
    width: `${stampWidthFraction(asset, size) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
  }

  if (!editable) return <div className="absolute" style={style}>{artwork}</div>

  return (
    <button type="button" className={`pointer-events-auto absolute cursor-grab rounded-sm active:cursor-grabbing ${selected ? 'outline outline-1 outline-offset-2 outline-accent-600' : ''}`}
      style={style} aria-label={`Select ${asset.label} stamp`} aria-pressed={selected}
      onPointerDown={startDrag}
      onClick={event => { if (event.detail === 0) onSelect() }}
    >
      {artwork}
    </button>
  )
}
