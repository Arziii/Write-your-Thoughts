import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Building2,
  Check,
  Clock,
  Gavel,
  Globe,
  Loader2,
  MapPin,
  ShieldCheck,
  StickyNote,
  Trash2,
  Users,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { Button, Input } from '../ui/primitives'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import type { Book } from '../../types'
import {
  CLEARABLE_CATEGORIES,
  clearBookContent,
  getBookCategoryCounts,
  type ClearBookContentResult,
  type ClearableCategory,
} from '../../services/import/bookContentCleaner'

interface ClearStoryContentModalProps {
  isOpen: boolean
  onClose: () => void
  book: Book | null
  onCleared?: (result: ClearBookContentResult) => void
}

const CATEGORY_ICONS: Record<ClearableCategory, typeof BookOpen> = {
  chapters: BookOpen,
  characters: Users,
  locations: MapPin,
  organizations: Building2,
  world_rules: Gavel,
  codex: BookMarked,
  wiki: Globe,
  notes: StickyNote,
  timeline_events: Clock,
}

export default function ClearStoryContentModal({
  isOpen,
  onClose,
  book,
  onCleared,
}: ClearStoryContentModalProps) {
  const { currentBook } = useWorkspaceStore()
  const { addToast } = useToastStore()

  const [step, setStep] = useState<'choose' | 'confirm'>('choose')
  const [counts, setCounts] = useState<Record<ClearableCategory, number> | null>(null)
  const [isLoadingCounts, setIsLoadingCounts] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Set<ClearableCategory>>(new Set())

  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setStep('choose')
      setCounts(null)
      setIsLoadingCounts(false)
      setSelectedCategories(new Set())
      setAcknowledged(false)
      setConfirmInput('')
      setIsDeleting(false)
      setProgress(null)
      return
    }

    if (!book?.id) return
    let cancelled = false
    setIsLoadingCounts(true)
    getBookCategoryCounts(book.id)
      .then((res) => {
        if (!cancelled) setCounts(res)
      })
      .catch(() => {
        if (!cancelled) {
          addToast('Could not read story item counts.', 'error')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCounts(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, book?.id, addToast])

  const totalAvailableCount = useMemo(() => {
    if (!counts) return 0
    return CLEARABLE_CATEGORIES.reduce((sum, cat) => sum + (counts[cat.key] || 0), 0)
  }, [counts])

  const selectedItemCount = useMemo(() => {
    if (!counts) return 0
    let sum = 0
    for (const key of selectedCategories) {
      sum += counts[key] || 0
    }
    return sum
  }, [counts, selectedCategories])

  const selectedBreakdown = useMemo(() => {
    if (!counts) return []
    return CLEARABLE_CATEGORIES.filter(
      (c) => selectedCategories.has(c.key) && (counts[c.key] || 0) > 0
    ).map((c) => ({
      ...c,
      count: counts[c.key] || 0,
    }))
  }, [counts, selectedCategories])

  const toggleCategory = (key: ClearableCategory) => {
    if (!counts || (counts[key] || 0) === 0) return
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAllNonEmpty = () => {
    if (!counts) return
    const next = new Set<ClearableCategory>()
    for (const cat of CLEARABLE_CATEGORIES) {
      if ((counts[cat.key] || 0) > 0) next.add(cat.key)
    }
    setSelectedCategories(next)
  }

  const clearSelection = () => {
    setSelectedCategories(new Set())
  }

  const confirmMatched = confirmInput.trim().toUpperCase() === 'CONFIRM'

  const handleConfirmDelete = async () => {
    if (!book || !acknowledged || !confirmMatched || selectedItemCount === 0) return

    setIsDeleting(true)
    setProgress({ done: 0, total: selectedItemCount, label: 'Preparing…' })

    try {
      const result = await clearBookContent({
        bookId: book.id,
        bookTitle: book.title,
        categories: Array.from(selectedCategories),
        syncToActiveWorkspace: Boolean(currentBook?.id && currentBook.id === book.id),
        onProgress: (done, total, label) => {
          setProgress({ done, total, label })
        },
      })

      if (result.failed.length > 0) {
        addToast(
          `Deleted ${result.totalDeleted} item(s), but ${result.failed.length} failed.`,
          result.totalDeleted > 0 ? 'info' : 'error'
        )
      } else {
        addToast(
          `Cleared ${result.totalDeleted} ${result.totalDeleted === 1 ? 'item' : 'items'} from "${book.title}". Your Maps were kept safe.`,
          'success'
        )
      }

      onCleared?.(result)
      onClose()
    } catch (err: any) {
      addToast(err?.message || 'Failed to clear story content.', 'error')
    } finally {
      setIsDeleting(false)
      setProgress(null)
    }
  }

  if (!book) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isDeleting}
      title={step === 'choose' ? 'Clear Story Content' : 'Confirm Permanent Deletion'}
      size="lg"
      className="z-[60]"
    >
      <div className="flex flex-col gap-4">
        {step === 'choose' ? (
          <>
            <div className="text-xs text-surface-300">
              Select which imported or draft sections to clear from{' '}
              <strong className="text-surface-100">{book.title}</strong>:
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-[hsl(var(--brand-green))]/30 bg-[hsl(var(--brand-green-bg))] px-3 py-2.5 text-xs text-surface-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-green))]" />
              <span>
                Your <strong className="text-surface-100">Fantasy Maps</strong> and map layers stay
                completely untouched and will not be deleted.
              </span>
            </div>

            {isLoadingCounts ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-surface-400">
                <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--brand-green))]" />
                Counting items in &ldquo;{book.title}&rdquo;…
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <span className="text-[11px] text-surface-400">
                    {totalAvailableCount === 0
                      ? 'This story has no clearable items yet.'
                      : `${selectedItemCount} of ${totalAvailableCount} items selected for deletion`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllNonEmpty}
                      disabled={totalAvailableCount === 0}
                      className="text-[11px] font-medium text-[hsl(var(--brand-green))] hover:underline disabled:opacity-40"
                    >
                      Select all ({totalAvailableCount})
                    </button>
                    {selectedCategories.size > 0 && (
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-[11px] text-surface-400 hover:text-surface-200 hover:underline"
                      >
                        Unselect all
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {CLEARABLE_CATEGORIES.map((cat) => {
                    const count = counts?.[cat.key] || 0
                    const isSelected = selectedCategories.has(cat.key)
                    const Icon = CATEGORY_ICONS[cat.key]
                    const disabled = count === 0

                    return (
                      <button
                        key={cat.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleCategory(cat.key)}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          disabled && 'cursor-not-allowed opacity-45',
                          !disabled && isSelected
                            ? 'border-danger-500/60 bg-danger-500/10 text-surface-100'
                            : 'border-[hsl(var(--studio-edge))] bg-surface-900/40 text-surface-300 hover:bg-surface-850/60'
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                              isSelected
                                ? 'border-danger-500 bg-danger-500 text-white'
                                : 'border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))]'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </span>
                          <Icon className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                          <span className="truncate text-xs font-medium">{cat.label}</span>
                        </div>
                        <span className="shrink-0 rounded-full bg-surface-850 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-surface-400">
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-[hsl(var(--studio-edge))] pt-3">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={isLoadingCounts || selectedItemCount === 0}
                onClick={() => {
                  setAcknowledged(false)
                  setConfirmInput('')
                  setStep('confirm')
                }}
              >
                <Trash2 className="h-4 w-4" />
                Continue to Confirm ({selectedItemCount})
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2.5 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3.5 text-xs text-danger-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-400" />
              <div className="space-y-1.5">
                <div className="font-semibold text-danger-100">
                  You are about to permanently delete {selectedItemCount}{' '}
                  {selectedItemCount === 1 ? 'item' : 'items'} from &ldquo;{book.title}&rdquo;:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedBreakdown.map((b) => (
                    <span
                      key={b.key}
                      className="rounded-md border border-danger-500/30 bg-danger-500/15 px-2 py-0.5 text-[11px] font-medium text-danger-100"
                    >
                      {b.count} {b.count === 1 ? b.singular : b.label.toLowerCase()}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-danger-200/90">
                  Fantasy Maps will remain untouched. Local deletions are queued for cloud sync if
                  enabled.
                </div>
              </div>
            </div>

            {/* Double-confirmation Guard 1: Explicit Checkbox */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[hsl(var(--studio-edge))] bg-surface-900/40 p-3 text-xs text-surface-200">
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={isDeleting}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-danger-500"
              />
              <span>
                I understand that deleting these{' '}
                <strong>
                  {selectedItemCount} {selectedItemCount === 1 ? 'item' : 'items'}
                </strong>{' '}
                from <strong>{book.title}</strong> cannot be undone.
              </span>
            </label>

            {/* Double-confirmation Guard 2: Typed CONFIRM */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-surface-200">
                Type <code className="rounded bg-surface-850 px-1.5 py-0.5 font-bold text-danger-400">CONFIRM</code> below to unlock deletion
              </label>
              <div className="relative">
                <Input
                  type="text"
                  value={confirmInput}
                  disabled={isDeleting}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && acknowledged && confirmMatched && !isDeleting) {
                      void handleConfirmDelete()
                    }
                  }}
                  placeholder="Type CONFIRM"
                  autoFocus
                  aria-label="Type CONFIRM to delete selected story content"
                  className={cn(
                    confirmMatched && 'border-danger-500/70 focus:border-danger-500'
                  )}
                />
                {confirmMatched && (
                  <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-danger-400" />
                )}
              </div>
            </div>

            {isDeleting && progress && (
              <div className="space-y-1.5 rounded-xl border border-[hsl(var(--studio-edge))] bg-surface-900/50 p-3">
                <div className="flex items-center justify-between text-xs text-surface-200">
                  <span>Clearing {progress.label}…</span>
                  <span className="tabular-nums text-surface-400">
                    {progress.done} / {progress.total}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-850">
                  <div
                    className="h-full bg-danger-500 transition-all duration-150"
                    style={{
                      width: `${Math.max(
                        6,
                        Math.round((progress.done / Math.max(1, progress.total)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-[hsl(var(--studio-edge))] pt-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={isDeleting}
                onClick={() => setStep('choose')}
              >
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={isDeleting} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  disabled={!acknowledged || !confirmMatched || isDeleting}
                  onClick={handleConfirmDelete}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Permanently Delete {selectedItemCount}{' '}
                      {selectedItemCount === 1 ? 'Item' : 'Items'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
