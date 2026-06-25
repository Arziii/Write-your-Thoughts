import { CheckCircle, Info, AlertTriangle, AlertCircle, X } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import type { ToastType } from '../../types'

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
}

const colors: Record<ToastType, string> = {
  success: 'text-success-400 bg-success-400/10 border-success-400/20',
  info: 'text-accent-400 bg-accent-500/10 border-accent-500/20',
  warning: 'text-warning-400 bg-warning-400/10 border-warning-400/20',
  error: 'text-danger-400 bg-danger-400/10 border-danger-400/20',
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = icons[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'toast-enter flex items-start gap-3 px-4 py-3 rounded-lg border shadow-xl pointer-events-auto max-w-xs',
              'bg-surface-850/95 backdrop-blur-sm',
              colors[toast.type]
            )}
          >
            <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-surface-200 flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-surface-500 hover:text-surface-300 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
