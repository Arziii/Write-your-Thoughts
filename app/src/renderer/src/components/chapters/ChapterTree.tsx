import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, FileText, MoreHorizontal, Pencil, Trash2, ChevronDown, Lock, Unlock, GripVertical
} from 'lucide-react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { syncService } from '../../services/syncService'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import Modal from '../ui/Modal'
import { Button, Input } from '../ui/primitives'
import type { Book, Chapter } from '../../types'

interface ChapterTreeProps {
  book: Book
  filterQuery?: string
}

export default function ChapterTree({ book, filterQuery = '' }: ChapterTreeProps) {
  const {
    chapters, addChapter, updateChapter, removeChapter,
    openTab, activeTabId
  } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editChapter, setEditChapter] = useState<Chapter | null>(null)
  const [deleteChapter, setDeleteChapter] = useState<Chapter | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  const query = filterQuery.trim().toLowerCase()
  const visibleChapters = query
    ? chapters.filter(ch => ch.title.toLowerCase().includes(query))
    : chapters

  if (query && visibleChapters.length === 0) return null

  const expanded = query ? true : isExpanded

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      const chapter = await window.api.chapters.create({ bookId: book.id, title: newTitle.trim() })
      addChapter(chapter as Chapter)
      openTab((chapter as Chapter).id, 'chapter', (chapter as Chapter).title)
      navigate(`/book/${book.id}/chapter/${(chapter as Chapter).id}`)
      addToast(`"${newTitle}" created`, 'success')
      setIsCreateOpen(false)
      setNewTitle('')
    } catch {
      addToast('Failed to create chapter', 'error')
    }
  }

  const handleRename = async () => {
    if (!editChapter || !editTitle.trim()) return
    try {
      const updated = await window.api.chapters.rename({ id: editChapter.id, title: editTitle.trim() })
      updateChapter(updated as Chapter)
      addToast('Chapter renamed', 'success')
      setEditChapter(null)
    } catch {
      addToast('Failed to rename chapter', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteChapter) return
    try {
      await window.api.chapters.delete(deleteChapter.id)
      removeChapter(deleteChapter.id)
      addToast('Chapter deleted', 'info')
      setDeleteChapter(null)
    } catch {
      addToast('Failed to delete chapter', 'error')
    }
  }

  const openChapter = (chapter: Chapter) => {
    openTab(chapter.id, 'chapter', chapter.title)
    navigate(`/book/${book.id}/chapter/${chapter.id}`)
  }

  return (
    <div className="mt-3 px-2.5">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--brand-green))] transition-colors hover:bg-surface-850 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--brand-green))]"
      >
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 transition-transform', !expanded && '-rotate-90')}
        />
        <span className="flex-1 truncate">Chapters</span>
        <span className="rounded-full bg-surface-850 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-surface-400">
          {visibleChapters.length}
        </span>
      </button>

      {expanded && (
        <div className="mt-1 flex flex-col gap-0.5">
          <Droppable droppableId="chapters" isDropDisabled={visibleChapters.length === 0 || Boolean(query)}>
            {(provided) => (
              <div
                className="flex flex-col gap-0.5"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {visibleChapters.map((chapter, idx) => {
                  const isActive = activeTabId === chapter.id
                  return (
                    <Draggable key={chapter.id} draggableId={chapter.id} index={idx} isDragDisabled={Boolean(query)}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn('group relative', snapshot.isDragging && 'z-50 opacity-90')}
                          style={provided.draggableProps.style}
                        >
                          <div
                            id={`chapter-${chapter.id}`}
                            onClick={() => openChapter(chapter)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChapter(chapter) } }}
                            className={cn(
                              'flex w-full cursor-pointer items-center gap-1.5 rounded-md border-l-2 px-1.5 py-1.5 text-left text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--brand-green))]',
                              isActive
                                ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] font-semibold text-[hsl(var(--brand-green))]'
                                : 'border-transparent font-medium text-surface-400 hover:bg-surface-850 hover:text-surface-200',
                              snapshot.isDragging && 'shadow-md'
                            )}
                          >
                            {!query && (
                              <div
                                {...provided.dragHandleProps}
                                className="-ml-1 cursor-grab p-0.5 text-surface-500 opacity-0 transition-opacity hover:text-surface-200 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </div>
                            )}

                            <FileText className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'opacity-100' : 'opacity-70')} />
                            <span className="min-w-0 flex-1 truncate">{chapter.title}</span>

                            <div className="flex shrink-0 items-center gap-1 pr-1">
                              {chapter.cloud_id && <Lock className="h-3 w-3 text-surface-500" />}
                              {chapter.word_count > 0 && (
                                <span className="text-[10px] font-medium tabular-nums text-surface-500 group-hover:hidden">
                                  {chapter.word_count}w
                                </span>
                              )}
                              <button
                                id={`chapter-menu-${chapter.id}`}
                                type="button"
                                aria-label={`Chapter options for ${chapter.title}`}
                                onClick={(e) => { e.stopPropagation(); setContextMenu({ id: chapter.id, x: e.clientX, y: e.clientY }) }}
                                className="rounded p-0.5 text-surface-500 opacity-0 transition-all hover:text-surface-200 focus-visible:opacity-100 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  )
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {visibleChapters.length === 0 && (
            <p className="px-2 py-1 text-xs text-surface-500">No chapters yet.</p>
          )}

          {!query && (
            <button
              id="create-chapter-btn"
              type="button"
              onClick={() => { setNewTitle(''); setIsCreateOpen(true) }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-surface-400 transition-colors hover:bg-surface-850 hover:text-[hsl(var(--brand-green))]"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chapter
            </button>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 min-w-[155px] animate-fade-in rounded-xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const ch = chapters.find((c) => c.id === contextMenu.id)
              if (!ch) return null
              return (
                <>
                  <button
                    type="button"
                    onClick={() => { setEditChapter(ch); setEditTitle(ch.title); setContextMenu(null) }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-surface-200 transition-colors hover:bg-[hsl(var(--brand-green-bg))] hover:text-[hsl(var(--brand-green))]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteChapter(ch); setContextMenu(null) }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-danger-500 transition-colors hover:bg-danger-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                  {ch.cloud_id && (
                    <>
                      <div className="my-1 h-px bg-[hsl(var(--studio-edge))]" />
                      <button
                        type="button"
                        onClick={async () => {
                          setContextMenu(null); addToast('Checking out chapter...', 'info')
                          const success = await syncService.lockChapter(ch.cloud_id!)
                          if (success) addToast('Chapter checked out!', 'success'); else addToast('Failed to check out chapter', 'error')
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-surface-200 transition-colors hover:bg-[hsl(var(--brand-green-bg))]"
                      >
                        <Lock className="h-3.5 w-3.5" /> Check Out
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setContextMenu(null); addToast('Checking in chapter...', 'info')
                          const success = await syncService.unlockChapter(ch.cloud_id!)
                          if (success) addToast('Chapter checked in!', 'success'); else addToast('Failed to check in chapter', 'error')
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-[hsl(var(--brand-green))] transition-colors hover:bg-[hsl(var(--brand-green-bg))]"
                      >
                        <Unlock className="h-3.5 w-3.5" /> Check In
                      </button>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Create Chapter Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Chapter" size="sm">
        <div className="space-y-4">
          <Input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Chapter title..."
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && handleCreate()}
          />
          <div className="flex gap-3">
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button id="create-chapter-submit" variant="primary" size="md" className="flex-1" onClick={handleCreate} disabled={!newTitle.trim()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal isOpen={!!editChapter} onClose={() => setEditChapter(null)} title="Rename Chapter" size="sm">
        <div className="space-y-4">
          <Input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && editTitle.trim() && handleRename()}
          />
          <div className="flex gap-3">
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setEditChapter(null)}>Cancel</Button>
            <Button id="rename-chapter-submit" variant="primary" size="md" className="flex-1" onClick={handleRename} disabled={!editTitle.trim()}>Rename</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteChapter} onClose={() => setDeleteChapter(null)} title="Delete Chapter" size="sm">
        <p className="mb-5 text-sm text-surface-400">
          Delete <strong className="text-surface-100">"{deleteChapter?.title}"</strong>? All version history will also be removed.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={() => setDeleteChapter(null)}>Cancel</Button>
          <Button id="confirm-delete-chapter" variant="danger" size="md" className="flex-1" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
