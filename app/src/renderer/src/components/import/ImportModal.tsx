import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Gavel,
  Globe,
  Info,
  Loader2,
  MapPin,
  Plus,
  StickyNote,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { Button, Input, Select, Switch } from '../ui/primitives'
import ClearStoryContentModal from './ClearStoryContentModal'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import type { Book } from '../../types'
import {
  SUPPORTED_IMPORT_EXTENSIONS,
} from '../../services/import/documentParsers'
import {
  IMPORT_ENTITY_KINDS,
  commitImportBatch,
  extractCharacterFields,
  extractLocationFields,
  extractTimelineFields,
  formatImportSummaryToast,
  prepareImportFiles,
  type CommitImportResult,
  type ImportCandidate,
  type ImportEntityKind,
} from '../../services/import/projectImporter'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  currentBook?: Book | null
  onImportComplete?: (result: CommitImportResult) => void
}

const KIND_ICONS: Record<ImportEntityKind, typeof BookOpen> = {
  chapter: BookOpen,
  character: Users,
  location: MapPin,
  organization: Building2,
  world_rule: Gavel,
  codex: BookMarked,
  wiki: Globe,
  note: StickyNote,
  timeline_event: Clock,
}

const ACCEPT_ATTR = SUPPORTED_IMPORT_EXTENSIONS.join(',')

export default function ImportModal({
  isOpen,
  onClose,
  currentBook = null,
  onImportComplete,
}: ImportModalProps) {
  const { user } = useUserStore()
  const { books } = useWorkspaceStore()
  const { addToast } = useToastStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const addMoreInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'select' | 'review'>('select')
  const [destination, setDestination] = useState<'existing' | 'new'>(
    currentBook ? 'existing' : 'new'
  )
  const [targetBookId, setTargetBookId] = useState<string>(currentBook?.id || books[0]?.id || '')
  const [newBookTitle, setNewBookTitle] = useState('')
  const [newBookGenre, setNewBookGenre] = useState('')
  const [bookTitleEdited, setBookTitleEdited] = useState(false)

  const [smartSplit, setSmartSplit] = useState(true)
  const [sourceFiles, setSourceFiles] = useState<File[]>([])
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [batchWarnings, setBatchWarnings] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; title: string } | null>(null)
  const [failedItems, setFailedItems] = useState<CommitImportResult['failed']>([])
  const [isClearOpen, setIsClearOpen] = useState(false)

  const selectedExistingBook = useMemo(
    () => books.find((b) => b.id === targetBookId) || currentBook || null,
    [books, targetBookId, currentBook]
  )

  // Reset cleanly on open/close
  useEffect(() => {
    if (!isOpen) {
      setStep('select')
      setSourceFiles([])
      setCandidates([])
      setBatchWarnings([])
      setExpandedIds(new Set())
      setIsDragging(false)
      setIsParsing(false)
      setParseError('')
      setIsImporting(false)
      setImportProgress(null)
      setFailedItems([])
      setNewBookTitle('')
      setNewBookGenre('')
      setBookTitleEdited(false)
      setDestination(currentBook ? 'existing' : 'new')
      setTargetBookId(currentBook?.id || books[0]?.id || '')
    } else {
      setDestination(currentBook ? 'existing' : 'new')
      setTargetBookId(currentBook?.id || books[0]?.id || '')
    }
  }, [isOpen, currentBook?.id])

  const runParse = useCallback(
    async (files: File[], split: boolean) => {
      if (files.length === 0) return
      setIsParsing(true)
      setParseError('')
      setFailedItems([])
      try {
        const batch = await prepareImportFiles(files, { smartSplit: split })
        setCandidates(batch.candidates)
        setBatchWarnings(batch.warnings)
        if (!bookTitleEdited && batch.suggestedBookTitle) {
          setNewBookTitle(batch.suggestedBookTitle)
        }
        if (batch.candidates.length === 0) {
          setParseError(
            batch.warnings[0] ||
              'No readable text or sections were found in the selected file(s). Try exporting from Campfire as HTML or DOCX.'
          )
        } else {
          setStep('review')
        }
      } catch (err: any) {
        setParseError(err?.message || 'Failed to read the selected file(s).')
      } finally {
        setIsParsing(false)
      }
    },
    [bookTitleEdited]
  )

  const handleFilesAdded = (incoming: FileList | File[], append = false) => {
    const list = Array.from(incoming)
    if (list.length === 0) return
    const nextFiles = append ? [...sourceFiles, ...list] : list
    setSourceFiles(nextFiles)
    void runParse(nextFiles, smartSplit)
  }

  const handleToggleSmartSplit = (next: boolean) => {
    setSmartSplit(next)
    if (sourceFiles.length > 0 && step === 'review') {
      void runParse(sourceFiles, next)
    }
  }

  const itemWarnings = useMemo(() => {
    const uniq = new Set<string>(batchWarnings)
    for (const c of candidates) {
      for (const w of c.warnings) uniq.add(w)
    }
    return Array.from(uniq)
  }, [batchWarnings, candidates])

  const selectedCandidates = useMemo(
    () => candidates.filter((c) => c.selected),
    [candidates]
  )

  const summaryCounts = useMemo(() => {
    const counts: Partial<Record<ImportEntityKind, number>> = {}
    let totalWords = 0
    for (const c of selectedCandidates) {
      counts[c.kind] = (counts[c.kind] || 0) + 1
      totalWords += c.wordCount
    }
    return { counts, totalWords }
  }, [selectedCandidates])

  const allSelected = candidates.length > 0 && candidates.every((c) => c.selected)

  const toggleAllSelected = () => {
    const next = !allSelected
    setCandidates((prev) => prev.map((c) => ({ ...c, selected: next })))
  }

  const setBulkKind = (kind: ImportEntityKind) => {
    if (!kind) return
    setCandidates((prev) =>
      prev.map((c) => (c.selected ? { ...c, kind } : c))
    )
  }

  const updateCandidate = (id: string, patch: Partial<ImportCandidate>) => {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const removeCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id))
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCommit = async () => {
    if (selectedCandidates.length === 0) return
    if (destination === 'new' && !user?.id) {
      addToast('Sign in or wait for your local writer profile before creating a new story.', 'error')
      return
    }
    if (destination === 'new' && !newBookTitle.trim()) {
      addToast('Enter a title for the new story.', 'error')
      return
    }
    if (destination === 'existing' && !targetBookId) {
      addToast('Select a destination story.', 'error')
      return
    }

    setIsImporting(true)
    setFailedItems([])
    setImportProgress({ done: 0, total: selectedCandidates.length, title: selectedCandidates[0]?.title || '' })

    try {
      const result = await commitImportBatch({
        bookId: targetBookId,
        createNewBook:
          destination === 'new' && user?.id
            ? {
                userId: user.id,
                title: newBookTitle.trim(),
                genre: newBookGenre.trim(),
              }
            : undefined,
        items: candidates,
        syncToActiveWorkspace:
          destination === 'existing' && Boolean(currentBook?.id && currentBook.id === targetBookId),
        onProgress: (done, total, title) => {
          setImportProgress({ done, total, title })
        },
      })

      if (result.totalImported > 0) {
        addToast(formatImportSummaryToast(result), 'success')
      }

      if (result.failed.length > 0) {
        setFailedItems(result.failed)
        const failedTitles = new Set(result.failed.map((f) => f.title))
        setCandidates((prev) =>
          prev.filter((c) => c.selected && failedTitles.has(c.title.trim() || 'Untitled'))
        )
        addToast(
          `${result.failed.length} item(s) could not be imported.`,
          result.totalImported > 0 ? 'info' : 'error'
        )
        if (result.totalImported > 0) {
          onImportComplete?.(result)
        }
        return
      }

      onImportComplete?.(result)
      onClose()
    } catch (err: any) {
      addToast(err?.message || 'Import failed.', 'error')
    } finally {
      setIsImporting(false)
      setImportProgress(null)
    }
  }

  const renderStructuredPreview = (item: ImportCandidate) => {
    if (item.kind === 'character') {
      const f = extractCharacterFields(item.plainText, item.metadataFields, item.title)
      const pairs = [
        ['Nickname', f.nickname],
        ['Age', f.age],
        ['Gender', f.gender],
        ['Appearance', f.appearance],
        ['Personality', f.personality],
        ['Goals', f.goals],
        ['Relationships', f.relationships],
        ['Notes', f.notes],
      ].filter(([, v]) => v)
      if (pairs.length > 0) {
        return (
          <div className="mt-2 space-y-1 rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-900/50 p-2.5 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--brand-green))]">
              Mapped Character Sheet Fields
            </div>
            {pairs.slice(0, 6).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[96px_1fr] gap-2">
                <span className="font-medium text-surface-400">{k}:</span>
                <span className="line-clamp-2 text-surface-200">{v}</span>
              </div>
            ))}
          </div>
        )
      }
    }

    if (item.kind === 'location') {
      const f = extractLocationFields(item.plainText, item.metadataFields, item.title)
      const pairs = [
        ['Description', f.description],
        ['Culture', f.culture],
        ['History', f.history],
        ['Notes', f.notes],
      ].filter(([, v]) => v)
      if (pairs.length > 0) {
        return (
          <div className="mt-2 space-y-1 rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-900/50 p-2.5 text-xs">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--brand-green))]">
              Mapped Location Fields
            </div>
            {pairs.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[96px_1fr] gap-2">
                <span className="font-medium text-surface-400">{k}:</span>
                <span className="line-clamp-2 text-surface-200">{v}</span>
              </div>
            ))}
          </div>
        )
      }
    }

    if (item.kind === 'timeline_event') {
      const f = extractTimelineFields(item.plainText, item.metadataFields)
      return (
        <div className="mt-2 space-y-1 rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-900/50 p-2.5 text-xs">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--brand-green))]">
            Mapped World History Event
          </div>
          {f.event_date && (
            <div className="grid grid-cols-[96px_1fr] gap-2">
              <span className="font-medium text-surface-400">Date / Era:</span>
              <span className="text-surface-200">{f.event_date}</span>
            </div>
          )}
          <div className="grid grid-cols-[96px_1fr] gap-2">
            <span className="font-medium text-surface-400">Summary:</span>
            <span className="line-clamp-3 text-surface-200">{f.description || item.preview}</span>
          </div>
        </div>
      )
    }

    return (
      <div className="mt-2 rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-900/50 p-2.5 text-xs leading-relaxed text-surface-300">
        {item.plainText.slice(0, 700) || '(Empty)'}
        {item.plainText.length > 700 ? '…' : ''}
      </div>
    )
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        closeDisabled={isImporting || isParsing || isClearOpen}
        title={step === 'select' ? 'Import from Campfire or Files' : 'Review & Classify Imported Items'}
        size="3xl"
        className="max-h-[90vh] flex flex-col"
      >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {step === 'select' ? (
          <>
            {/* Destination Selector */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                Destination Story
              </label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {books.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestination('existing')
                      if (!targetBookId) setTargetBookId(currentBook?.id || books[0]?.id || '')
                    }}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                      destination === 'existing'
                        ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))]'
                        : 'border-[hsl(var(--studio-edge))] bg-surface-900/40 hover:bg-surface-850/60'
                    )}
                  >
                    <BookOpen
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        destination === 'existing' ? 'text-[hsl(var(--brand-green))]' : 'text-surface-400'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-surface-100">
                        {currentBook ? 'Import into Current Story' : 'Add to Existing Story'}
                      </div>
                      <div className="truncate text-xs text-surface-400">
                        {currentBook
                          ? currentBook.title
                          : `${books.length} ${books.length === 1 ? 'story' : 'stories'} available`}
                      </div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDestination('new')}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                    destination === 'new'
                      ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))]'
                      : 'border-[hsl(var(--studio-edge))] bg-surface-900/40 hover:bg-surface-850/60'
                  )}
                >
                  <Plus
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      destination === 'new' ? 'text-[hsl(var(--brand-green))]' : 'text-surface-400'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-surface-100">Create a New Story</div>
                    <div className="text-xs text-surface-400">
                      Start a fresh book from your imported files
                    </div>
                  </div>
                </button>
              </div>

              {destination === 'existing' && books.length > 0 && (
                <div className="space-y-2">
                  <Select
                    value={targetBookId}
                    onChange={(e) => setTargetBookId(e.target.value)}
                    aria-label="Select destination story"
                  >
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                        {currentBook?.id === b.id ? ' (Current)' : ''}
                      </option>
                    ))}
                  </Select>

                  {selectedExistingBook && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-900/35 px-3 py-2">
                      <span className="text-[11px] text-surface-400">
                        Need a clean slate before re-importing? Clear old chapters or lore (keeps Maps safe).
                      </span>
                      <Button
                        variant="danger"
                        size="xs"
                        onClick={() => setIsClearOpen(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear Existing Content…
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {destination === 'new' && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Input
                      type="text"
                      value={newBookTitle}
                      onChange={(e) => {
                        setNewBookTitle(e.target.value)
                        setBookTitleEdited(true)
                      }}
                      placeholder="New story title (auto-filled from filename)"
                      aria-label="New story title"
                    />
                  </div>
                  <Input
                    type="text"
                    value={newBookGenre}
                    onChange={(e) => setNewBookGenre(e.target.value)}
                    placeholder="Genre (optional)"
                    aria-label="New story genre"
                  />
                </div>
              )}
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                if (e.dataTransfer.files?.length) {
                  handleFilesAdded(e.dataTransfer.files, false)
                }
              }}
              onClick={() => !isParsing && fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all',
                isDragging
                  ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))]'
                  : 'border-[hsl(var(--studio-edge))] bg-surface-900/40 hover:border-[hsl(var(--brand-green))]/60 hover:bg-surface-900/70'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleFilesAdded(e.target.files, false)
                  }
                  e.target.value = ''
                }}
              />
              {isParsing ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--brand-green))]" />
                  <div>
                    <div className="text-sm font-semibold text-surface-100">
                      Reading and classifying your files…
                    </div>
                    <div className="mt-1 text-xs text-surface-400">
                      Extracting chapters, characters, worldbuilding sheets, and timelines
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-surface-100">
                      Drop your Campfire export or writing files here
                    </div>
                    <div className="mt-1 text-xs text-surface-400">
                      Or click to select one or multiple files at once
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    {['HTML', 'DOCX', 'RTF', 'PDF', 'ZIP', 'MD', 'TXT'].map((fmt) => (
                      <span
                        key={fmt}
                        className="rounded-md border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-2 py-0.5 text-[10px] font-bold tracking-wider text-surface-300"
                      >
                        .{fmt.toLowerCase()}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {parseError && (
              <div className="flex items-start gap-2 rounded-xl border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Campfire Tip & Smart Split Toggle */}
            <div className="flex flex-col gap-3 rounded-xl border border-[hsl(var(--studio-edge))] bg-surface-900/40 p-3.5">
              <div className="flex items-start gap-2.5 text-xs leading-relaxed text-surface-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-green))]" />
                <div>
                  <span className="font-semibold text-surface-100">Migrating from Campfire Writing?</span>{' '}
                  You can drop <strong className="text-surface-100">pdf</strong>,{' '}
                  <strong className="text-surface-100">html</strong>,{' '}
                  <strong className="text-surface-100">docx</strong>,{' '}
                  <strong className="text-surface-100">rtf</strong>, or{' '}
                  <strong className="text-surface-100">.zip</strong> exports — combined multi-element
                  exports automatically split into separate chapters, characters, locations, world
                  rules, and timeline events. (<strong className="text-surface-100">html</strong> and{' '}
                  <strong className="text-surface-100">docx</strong> also preserve tables and portraits best.)
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--studio-edge))] pt-3">
                <div>
                  <div className="text-xs font-semibold text-surface-100">
                    Smart chapter & section splitting
                  </div>
                  <div className="text-[11px] text-surface-400">
                    Automatically split combined exports on <code className="text-surface-300">Prologue</code>,{' '}
                    <code className="text-surface-300">Chapter 1…</code>, or top-level headings
                  </div>
                </div>
                <Switch
                  checked={smartSplit}
                  onCheckedChange={handleToggleSmartSplit}
                  aria-label="Smart chapter and section splitting"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 Review Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[hsl(var(--studio-edge))] bg-surface-900/40 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {IMPORT_ENTITY_KINDS.map((meta) => {
                  const count = summaryCounts.counts[meta.kind] || 0
                  if (!count) return null
                  const Icon = KIND_ICONS[meta.kind]
                  return (
                    <span
                      key={meta.kind}
                      className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--brand-green-bg))] px-2.5 py-0.5 text-[11px] font-medium text-[hsl(var(--brand-green))]"
                    >
                      <Icon className="h-3 w-3" />
                      {count} {count === 1 ? meta.label : meta.pluralLabel}
                    </span>
                  )
                })}
                <span className="px-1.5 text-xs text-surface-400">
                  {summaryCounts.totalWords.toLocaleString()} words total
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-surface-300">
                  <span>Smart Split</span>
                  <Switch
                    checked={smartSplit}
                    onCheckedChange={handleToggleSmartSplit}
                    aria-label="Toggle smart chapter splitting"
                  />
                </label>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => addMoreInputRef.current?.click()}
                  disabled={isImporting || isParsing}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Files
                </Button>
                <input
                  ref={addMoreInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      handleFilesAdded(e.target.files, true)
                    }
                    e.target.value = ''
                  }}
                />
              </div>
            </div>

            {destination === 'new' && (
              <div className="flex items-center gap-2.5">
                <span className="shrink-0 text-xs font-medium text-surface-400">New Story Title:</span>
                <Input
                  type="text"
                  value={newBookTitle}
                  onChange={(e) => {
                    setNewBookTitle(e.target.value)
                    setBookTitleEdited(true)
                  }}
                  placeholder="Story Title"
                  className="py-1.5 text-xs"
                />
              </div>
            )}

            {itemWarnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-xs text-warning-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="space-y-0.5">
                  {itemWarnings.map((w, idx) => (
                    <div key={idx}>{w}</div>
                  ))}
                </div>
              </div>
            )}

            {failedItems.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-semibold">Some items failed to import and remain listed for retry:</div>
                  {failedItems.map((f, idx) => (
                    <div key={idx}>
                      {f.title} ({f.kind}): {f.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bulk Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={toggleAllSelected}
                className="flex items-center gap-2 text-xs font-medium text-surface-300 hover:text-surface-100"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                    allSelected
                      ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green))] text-white'
                      : 'border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))]'
                  )}
                >
                  {allSelected && <Check className="h-3 w-3" />}
                </span>
                {selectedCandidates.length} of {candidates.length} selected
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-surface-400">Set selected as:</span>
                <Select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setBulkKind(e.target.value as ImportEntityKind)
                  }}
                  className="w-40 py-1 text-xs"
                  aria-label="Bulk set category for selected items"
                >
                  <option value="">Choose type…</option>
                  {IMPORT_ENTITY_KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Review Items List */}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {candidates.map((item) => {
                const Icon = KIND_ICONS[item.kind]
                const isExpanded = expandedIds.has(item.id)
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-xl border p-2.5 transition-colors',
                      item.selected
                        ? 'border-[hsl(var(--studio-edge))] bg-surface-900/45'
                        : 'border-[hsl(var(--studio-edge))] bg-surface-900/20 opacity-60'
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateCandidate(item.id, { selected: !item.selected })}
                        aria-label={`Select ${item.title}`}
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          item.selected
                            ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green))] text-white'
                            : 'border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))]'
                        )}
                      >
                        {item.selected && <Check className="h-3 w-3" />}
                      </button>

                      <div className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-2 py-1">
                        <Icon className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" />
                        <select
                          value={item.kind}
                          onChange={(e) =>
                            updateCandidate(item.id, { kind: e.target.value as ImportEntityKind })
                          }
                          aria-label={`Category for ${item.title}`}
                          className="bg-transparent text-xs font-medium text-surface-100 focus:outline-none"
                        >
                          {IMPORT_ENTITY_KINDS.map((k) => (
                            <option key={k.kind} value={k.kind} className="bg-surface-900 text-surface-100">
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateCandidate(item.id, { title: e.target.value })}
                        className="min-w-[160px] flex-1 py-1 text-xs font-medium"
                        aria-label="Item title"
                      />

                      <div className="flex items-center gap-2 text-[11px] text-surface-400">
                        <span className="tabular-nums">{item.wordCount.toLocaleString()} w</span>
                        <span
                          className="hidden max-w-[130px] truncate rounded bg-surface-850 px-1.5 py-0.5 text-[10px] sm:inline-block"
                          title={item.sourceFile}
                        >
                          <FileText className="mr-1 inline h-2.5 w-2.5" />
                          {item.sourceFile.split('/').pop()}
                        </span>
                        {item.warnings.length > 0 && (
                          <span title={item.warnings.join(' ')} className="text-warning-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        title={isExpanded ? 'Hide preview' : 'Preview extracted content'}
                        aria-label={isExpanded ? 'Hide preview' : 'Preview extracted content'}
                        className="rounded p-1 text-surface-400 hover:bg-surface-850 hover:text-surface-100"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => removeCandidate(item.id)}
                        title="Remove item"
                        aria-label={`Remove ${item.title}`}
                        className="rounded p-1 text-surface-500 hover:bg-danger-500/15 hover:text-danger-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {item.warnings.length > 0 && (
                      <div className="mt-1.5 flex items-start gap-1.5 pl-6 text-[11px] text-warning-300">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{item.warnings.join(' ')}</span>
                      </div>
                    )}

                    {!isExpanded && item.preview && (
                      <div className="mt-1.5 line-clamp-1 pl-6 text-[11px] text-surface-400">
                        {item.preview}
                      </div>
                    )}

                    {isExpanded && <div className="pl-6">{renderStructuredPreview(item)}</div>}
                  </div>
                )
              })}
            </div>

            {/* Progress Bar */}
            {isImporting && importProgress && (
              <div className="space-y-1.5 rounded-xl border border-[hsl(var(--studio-edge))] bg-surface-900/50 p-3">
                <div className="flex items-center justify-between text-xs text-surface-200">
                  <span className="truncate font-medium">
                    Importing &ldquo;{importProgress.title}&rdquo;…
                  </span>
                  <span className="tabular-nums text-surface-400">
                    {importProgress.done} / {importProgress.total}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-850">
                  <div
                    className="h-full bg-[hsl(var(--brand-green))] transition-all duration-150"
                    style={{
                      width: `${Math.max(
                        6,
                        Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--studio-edge))] pt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStep('select')}
                disabled={isImporting}
              >
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} disabled={isImporting}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCommit}
                  disabled={
                    isImporting ||
                    selectedCandidates.length === 0 ||
                    (destination === 'new' && !newBookTitle.trim())
                  }
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import {selectedCandidates.length}{' '}
                      {selectedCandidates.length === 1 ? 'Item' : 'Items'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>

    <ClearStoryContentModal
      isOpen={isOpen && isClearOpen}
      onClose={() => setIsClearOpen(false)}
      book={selectedExistingBook}
    />
  </>
  )
}
