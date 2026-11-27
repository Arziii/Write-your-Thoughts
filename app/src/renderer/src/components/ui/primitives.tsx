import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'xs' | 'sm' | 'md'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-[hsl(var(--brand-green))] text-white dark:text-surface-950 hover:opacity-90',
  secondary:
    'border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] text-surface-100 hover:bg-surface-850',
  ghost:
    'border-transparent bg-transparent text-surface-400 hover:bg-surface-850 hover:text-surface-100',
  danger:
    'border-danger-500/25 bg-danger-500/10 text-danger-500 hover:bg-danger-500/20',
}

const buttonSizes: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs rounded-md gap-1',
  sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'sm', className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center border font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand-green))] disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  size?: 'sm' | 'md'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ active = false, size = 'sm', className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand-green))] disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        active
          ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
          : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100',
        className
      )}
      {...props}
    />
  )
)
IconButton.displayName = 'IconButton'

const fieldBase =
  'w-full min-w-0 rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:border-[hsl(var(--brand-green))] focus:outline-none transition-colors disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...props} />
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, className)} {...props} />
  )
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(fieldBase, className)} {...props} />
  )
)
Select.displayName = 'Select'

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand-green))] disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-[hsl(var(--brand-green))] dark:bg-[#5b7a52]' : 'bg-surface-700'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  )
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title?: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] p-5 shadow-sm',
        className
      )}
    >
      {(title || description || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            {Icon && (
              <div className="mt-0.5 rounded-lg bg-[hsl(var(--brand-green-bg))] p-1.5 text-[hsl(var(--brand-green))] shrink-0">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-base font-semibold text-surface-50">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-surface-400">{description}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
