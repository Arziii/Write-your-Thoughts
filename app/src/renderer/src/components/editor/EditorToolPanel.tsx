import type { ReactNode } from 'react'
import { RefreshCw, Sparkles, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn } from '../../utils'

export const panelButton = 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-surface-700 px-2.5 py-1.5 text-xs font-medium hover:bg-surface-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'
export const panelIconButton = 'shrink-0 rounded-md p-1.5 text-surface-400 hover:bg-surface-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
export const panelCard = 'rounded-lg border border-surface-800 bg-[hsl(var(--studio-paper))] p-3'
export const panelField = 'w-full min-w-0 rounded-md border border-surface-700 bg-surface-950 px-2.5 py-1.5 text-sm text-surface-100 placeholder:text-surface-500'
export const panelBadge = 'inline-flex max-w-full items-center rounded-full bg-[hsl(var(--brand-green-bg))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--brand-green))]'

export function EditorToolPanel({ id, title, icon: Icon, onClose, action, footer, children }: {
  id: string
  title: string
  icon: LucideIcon
  onClose: () => void
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  const subject = useWorkspaceStore(state => state.tabs.find(tab => tab.id === state.activeTabId)?.title)

  return (
    <aside id={id} aria-label={title}
      className="flex h-full min-h-0 w-[min(22.5rem,62%)] min-w-0 shrink-0 flex-col border-l border-surface-800 bg-[hsl(var(--studio-desk))] text-surface-100">
      <header className="shrink-0 border-b border-surface-800 bg-[hsl(var(--studio-header))] px-3 py-3.5 sm:px-4">
        <div className="flex items-start gap-2.5">
          <div className="shrink-0 rounded-lg bg-[hsl(var(--brand-green-bg))] p-2 text-[hsl(var(--brand-green))]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold leading-tight">{title}</h3>
            {subject && <p title={subject} className="mt-0.5 truncate text-xs text-surface-400">{subject}</p>}
          </div>
          <button type="button" className={panelIconButton} onClick={onClose} aria-label={`Close ${title}`} title={`Close ${title}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {action && <div className="mt-3">{action}</div>}
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 sm:px-4">{children}</div>
      {footer && <div className="shrink-0 border-t border-surface-800 bg-[hsl(var(--studio-header))] px-3 py-3 sm:px-4">{footer}</div>}
    </aside>
  )
}

export function PanelAnalyzeButton({ onClick, busy, disabled = false, label = 'Run AI analysis', busyLabel = 'Analyzing…', secondary = false }: {
  onClick: () => void
  busy: boolean
  disabled?: boolean
  label?: string
  busyLabel?: string
  secondary?: boolean
}) {
  const Icon = busy ? RefreshCw : Sparkles
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} aria-busy={busy}
      className={cn(panelButton, !secondary && 'w-full border-transparent bg-[hsl(var(--brand-green-bg))] py-2 text-sm font-semibold text-[hsl(var(--brand-green))] hover:border-[hsl(var(--brand-green))] hover:bg-[hsl(var(--brand-green-bg))]')}>
      <Icon className={cn('h-4 w-4 shrink-0', busy && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />
      {busy ? busyLabel : label}
    </button>
  )
}

export function PanelEmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className={cn(panelCard, 'flex items-start gap-2.5')}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-green))]" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 text-xs leading-relaxed text-surface-400">{description}</p>}
      </div>
    </div>
  )
}
