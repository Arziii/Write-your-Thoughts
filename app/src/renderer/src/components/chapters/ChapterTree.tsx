import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, FileText, MoreHorizontal, Pencil, Trash2, ChevronDown, Lock, Unlock
} from 'lucide-react'
import { syncService } from '../../services/syncService'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn, formatWordCount } from '../../utils'
import Modal from '../ui/Modal'
import type { Book, Chapter } from '../../types'

interface ChapterTreeProps {
  book: Book
}

export default function ChapterTree({ book }: ChapterTreeProps) {
  const {
    chapters, addChapter, updateChapter, removeChapter,
    openTab, activeChapter
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

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      const chapter = await window.api.chapters.create({
        bookId: book.id,
        title: newTitle.trim(),
      })
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
      const updated = await window.api.chapters.rename({
        id: editChapter.id,
        title: editTitle.trim(),
      })
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
    <div className="px-1">
      {/* Book title header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-surface-500 hover:text-surface-300 transition-colors uppercase tracking-wider"
      >
        <ChevronDown
          className={cn('w-3 h-3 transition-transform', !isExpanded && '-rotate-90')}
        />
        Chapters
      </button>

      {isExpanded && (
        <div className="space-y-0.5">
          {chapters.map((chapter, idx) => (
            <div key={chapter.id} className="group relative">
              <button
                id={`chapter-${chapter.id}`}
                onClick={() => openChapter(chapter)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-2 py-1.5 text-sm rounded-md transition-colors',
                  activeChapter?.id === chapter.id
                    ? 'bg-accent-600/20 text-accent-300 border-l-2 border-accent-500'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                )}
              >
                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1 text-left text-xs">{chapter.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {chapter.cloud_id && (
                    <Lock className="w-3 h-3 text-surface-500 mr-1" />
                  )}
                  {chapter.word_count > 0 && (
                    <span className="text-[10px] text-surface-600 hidden group-hover:hidden">
                      {chapter.word_count}w
                    </span>
                  )}
                  <button
                    id={`chapter-menu-${chapter.id}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setContextMenu({ id: chapter.id, x: e.clientX, y: e.clientY })
                    }}
                    className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-surface-300 transition-all"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            </div>
          ))}

          {chapters.length === 0 && (
            <p className="text-xs text-surface-600 px-2 py-1">No chapters yet.</p>
          )}

          {/* Add chapter */}
          <button
            id="create-chapter-btn"
            onClick={() => { setNewTitle(''); setIsCreateOpen(true) }}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-surface-600 hover:text-accent-400 hover:bg-surface-800/40 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chapter
          </button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-36 animate-fade-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const ch = chapters.find((c) => c.id === contextMenu.id)!
              return (
                <>
                  <button
                    onClick={() => {
                      setEditChapter(ch)
                      setEditTitle(ch.title)
                      setContextMenu(null)
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Rename
                  </button>
                  <button
                    onClick={() => { setDeleteChapter(ch); setContextMenu(null) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-danger-400 hover:bg-surface-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                  {ch.cloud_id && (
                    <>
                      <button
                        onClick={async () => {
                          setContextMenu(null)
                          addToast('Checking out chapter...', 'info')
                          const success = await syncService.lockChapter(ch.cloud_id!)
                          if (success) addToast('Chapter checked out!', 'success')
                          else addToast('Failed to check out chapter', 'error')
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-accent-400 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Check Out
                      </button>
                      <button
                        onClick={async () => {
                          setContextMenu(null)
                          addToast('Checking in chapter...', 'info')
                          const success = await syncService.unlockChapter(ch.cloud_id!)
                          if (success) addToast('Chapter checked in!', 'success')
                          else addToast('Failed to check in chapter', 'error')
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-green-400 transition-colors"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Check In
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
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Chapter title..."
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && handleCreate()}
            className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all"
          />
          <div className="flex gap-3">
            <button onClick={() => setIsCreateOpen(false)} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button
              id="create-chapter-submit"
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              className="flex-1 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal isOpen={!!editChapter} onClose={() => setEditChapter(null)} title="Rename Chapter" size="sm">
        <div className="space-y-4">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && editTitle.trim() && handleRename()}
            className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all"
          />
          <div className="flex gap-3">
            <button onClick={() => setEditChapter(null)} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button
              id="rename-chapter-submit"
              onClick={handleRename}
              disabled={!editTitle.trim()}
              className="flex-1 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Rename
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteChapter} onClose={() => setDeleteChapter(null)} title="Delete Chapter" size="sm">
        <p className="text-sm text-surface-300 mb-5">
          Delete <strong className="text-surface-100">"{deleteChapter?.title}"</strong>? All version history will also be removed.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteChapter(null)} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
          <button id="confirm-delete-chapter" onClick={handleDelete} className="flex-1 py-2 bg-danger-500 hover:bg-danger-400 text-white rounded-lg text-sm font-medium transition-colors">Delete</button>
        </div>
      </Modal>
    </div>
  )
}
