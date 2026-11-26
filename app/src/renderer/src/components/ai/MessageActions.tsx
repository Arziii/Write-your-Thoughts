import { useEffect, useState } from 'react'
import { Check, Copy, Pencil, RefreshCcw } from 'lucide-react'
import { cn } from '../../utils'

const iconButton = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-surface-400 hover:bg-surface-850 hover:text-surface-100 focus-visible:outline-accent-700 disabled:opacity-50'
const messageTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

interface MessageActionsProps {
  content: string
  createdAt: number
  alignRight?: boolean
  disabled?: boolean
  onEdit: () => void
  onResend?: () => void
  onCopyError: () => void
}

export default function MessageActions({
  content, createdAt, alignRight, disabled, onEdit, onResend, onCopyError,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
    } catch {
      onCopyError()
    }
  }

  return (
    <div role="group" aria-label="Message actions" className={cn('mt-1 flex items-center gap-0.5', alignRight && 'justify-end')}>
      <span role="status" className="sr-only">{copied ? 'Message copied.' : ''}</span>
      <button type="button" className={iconButton} aria-label="Copy message" title={copied ? 'Copied' : 'Copy'} onClick={() => void copy()}>
        {copied ? <Check className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" aria-hidden />
          : <Copy className="h-3.5 w-3.5" aria-hidden />}
      </button>
      <button type="button" className={iconButton} aria-label="Edit message" title="Edit" disabled={disabled} onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
      </button>
      {onResend && (
        <button type="button" className={iconButton} aria-label="Resend message" title="Resend" disabled={disabled} onClick={onResend}>
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
      <time className="ml-1 text-xs tabular-nums text-surface-500" dateTime={new Date(createdAt).toISOString()}>
        {messageTime.format(createdAt)}
      </time>
    </div>
  )
}
