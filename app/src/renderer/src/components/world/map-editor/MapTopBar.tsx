import type { RefObject } from 'react'
import { ArrowLeft, Layers, Redo2, Sparkles, Undo2 } from 'lucide-react'
import { cn } from '../../../utils'

interface MapTopBarProps {
  exitButtonRef: RefObject<HTMLButtonElement | null>
  mapName: string
  canUndo: boolean
  canRedo: boolean
  inspectorOpen: boolean
  error: string
  onExit: () => void
  onUndo: () => void
  onRedo: () => void
  onToggleInspector: () => void
  onOpenDraftImport?: () => void
}

export default function MapTopBar({
  exitButtonRef,
  mapName,
  canUndo,
  canRedo,
  inspectorOpen,
  error,
  onExit,
  onUndo,
  onRedo,
  onToggleInspector,
  onOpenDraftImport,
}: MapTopBarProps) {
  return (
    <div className="studio-chapter-toolbar flex h-10 shrink-0 items-center gap-2 px-3">
      <button
        ref={exitButtonRef}
        type="button"
        onClick={onExit}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-surface-300 transition-colors hover:bg-surface-850 hover:text-surface-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Back to Maps</span>
      </button>

      <div className="h-4 w-px bg-[hsl(var(--studio-edge))]" />

      <h2 className="mr-auto truncate font-serif text-sm font-semibold text-surface-50">{mapName}</h2>

      {error ? (
        <span role="alert" className="truncate text-xs font-medium text-danger-500">{error}</span>
      ) : (
        <span role="status" title="Map layers save automatically on this device" className="hidden items-center gap-1.5 text-[11px] text-surface-400 sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success-400" aria-hidden="true" />
          <span>Saved</span>
        </span>
      )}

      {onOpenDraftImport && (
        <button
          type="button"
          onClick={onOpenDraftImport}
          title="Import a draft sketch or map image and convert it into editable layers"
          className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-2.5 py-1 text-xs font-medium text-surface-200 transition-colors hover:bg-surface-850 hover:text-surface-100"
        >
          <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" aria-hidden="true" />
          <span className="hidden md:inline">Draft to Map</span>
        </button>
      )}

      <div className="flex items-center rounded-md border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-0.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          className="rounded p-1 text-surface-300 transition-colors hover:bg-surface-850 hover:text-surface-100 disabled:opacity-35"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-3.5 w-px bg-[hsl(var(--studio-edge))]" />
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          className="rounded p-1 text-surface-300 transition-colors hover:bg-surface-850 hover:text-surface-100 disabled:opacity-35"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleInspector}
        aria-pressed={inspectorOpen}
        title={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
          inspectorOpen
            ? 'border-[hsl(var(--brand-green)/0.4)] bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
            : 'border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] text-surface-300 hover:bg-surface-850'
        )}
      >
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Inspector</span>
      </button>
    </div>
  )
}
