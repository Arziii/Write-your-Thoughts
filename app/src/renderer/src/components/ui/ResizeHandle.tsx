import { useRef } from 'react'
import type { PointerEvent } from 'react'
import { cn } from '../../utils'

interface ResizeHandleProps {
  onResize: (deltaX: number) => void
  onResizeEnd?: () => void
  onReset?: () => void
  className?: string
  'aria-label'?: string
}

export default function ResizeHandle({
  onResize,
  onResizeEnd,
  onReset,
  className,
  'aria-label': ariaLabel = 'Resize panel',
}: ResizeHandleProps) {
  const dragX = useRef<number | null>(null)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    dragX.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragX.current === null) return
    const delta = event.clientX - dragX.current
    if (delta === 0) return
    dragX.current = event.clientX
    onResize(delta)
  }

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (dragX.current === null) return
    dragX.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onResizeEnd?.()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      title="Drag to resize (double-click to reset)"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onDoubleClick={onReset}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); onResize(-16); onResizeEnd?.() }
        else if (event.key === 'ArrowRight') { event.preventDefault(); onResize(16); onResizeEnd?.() }
      }}
      className={cn(
        'group relative w-1 shrink-0 cursor-col-resize select-none bg-transparent transition-colors hover:bg-[hsl(var(--brand-green)/0.45)] focus-visible:bg-[hsl(var(--brand-green))] focus-visible:outline-none',
        className
      )}
    />
  )
}
