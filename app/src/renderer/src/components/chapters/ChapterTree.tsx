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
import type { Book, Chapter } from '../../types'

const F = {
  bg: 'hsl(var(--surface-900))',
  bgHover: 'hsl(var(--surface-850))',
  active: 'hsl(var(--surface-800))',
  border: 'hsl(var(--surface-800))',
  green: 'hsl(var(--brand-green))',
  greenLight: 'hsl(var(--brand-green-bg))',
  text: 'hsl(var(--surface-50))',
  textMid: 'hsl(var(--surface-300))',
  textSoft: 'hsl(var(--surface-500))',
  textFaint: 'hsl(var(--surface-600))',
}

interface ChapterTreeProps {
  book: Book
}

export default function ChapterTree({ book }: ChapterTreeProps) {
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
    <div style={{ padding: '0 10px', marginTop: 12 }}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px',
          color: F.green, background: 'none', border: 'none', borderRadius: 8,
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = F.greenLight; (e.currentTarget as HTMLElement).style.background = F.bgHover }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = F.green; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <ChevronDown style={{ width: 12, height: 12, transition: 'transform 0.15s', transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)' }} />
        Chapters
      </button>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
          <Droppable droppableId="chapters" isDropDisabled={chapters.length === 0}>
            {(provided) => (
              <div 
                style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {chapters.map((chapter, idx) => (
                  <Draggable key={chapter.id} draggableId={chapter.id} index={idx}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="group relative"
                        style={{
                          ...provided.draggableProps.style,
                          zIndex: snapshot.isDragging ? 50 : 'auto',
                          opacity: snapshot.isDragging ? 0.9 : 1,
                        }}
                      >
                        <button
                          id={`chapter-${chapter.id}`}
                          onClick={() => openChapter(chapter)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                            padding: '6px 6px', borderRadius: 6, fontSize: 13, fontWeight: activeTabId === chapter.id ? 600 : 500,
                            background: activeTabId === chapter.id ? F.greenLight : 'transparent',
                            color: activeTabId === chapter.id ? F.green : F.textSoft,
                            border: 'none', borderLeft: activeTabId === chapter.id ? `2px solid ${F.green}` : '2px solid transparent',
                            cursor: 'pointer', transition: 'all 0.1s', textAlign: 'left',
                            boxShadow: snapshot.isDragging ? `0 4px 12px rgba(45,90,39,0.15)` : 'none'
                          }}
                          onMouseEnter={e => { if (activeTabId !== chapter.id) { (e.currentTarget as HTMLElement).style.background = F.bgHover; (e.currentTarget as HTMLElement).style.color = F.textMid } }}
                          onMouseLeave={e => { if (activeTabId !== chapter.id) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = F.textSoft } }}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: F.textFaint, padding: 2, marginLeft: -4, cursor: 'grab' }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = F.textMid}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = F.textFaint}
                          >
                            <GripVertical style={{ width: 14, height: 14 }} />
                          </div>
                          
                          <FileText style={{ width: 14, height: 14, flexShrink: 0, opacity: activeTabId === chapter.id ? 1 : 0.7 }} />
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chapter.title}</span>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, paddingRight: 4 }}>
                            {chapter.cloud_id && <Lock style={{ width: 12, height: 12, color: F.textFaint }} />}
                            {chapter.word_count > 0 && (
                              <span className="group-hover:hidden" style={{ fontSize: 10, color: F.textFaint, fontWeight: 500 }}>
                                {chapter.word_count}w
                              </span>
                            )}
                            <button
                              id={`chapter-menu-${chapter.id}`}
                              onClick={(e) => { e.stopPropagation(); setContextMenu({ id: chapter.id, x: e.clientX, y: e.clientY }) }}
                              className="opacity-0 group-hover:opacity-100 transition-all"
                              style={{ color: F.textFaint, background: 'none', border: 'none', cursor: 'pointer' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = F.textMid}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = F.textFaint}
                            >
                              <MoreHorizontal style={{ width: 14, height: 14 }} />
                            </button>
                          </div>
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {chapters.length === 0 && (
            <p style={{ fontSize: 12, color: F.textFaint, padding: '4px 8px' }}>No chapters yet.</p>
          )}

          {/* Add chapter */}
          <button
            id="create-chapter-btn"
            onClick={() => { setNewTitle(''); setIsCreateOpen(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px',
              color: F.textSoft, background: 'none', border: 'none', borderRadius: 6,
              fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = F.bgHover; (e.currentTarget as HTMLElement).style.color = F.green }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = F.textSoft }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            New Chapter
          </button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 animate-fade-in"
            style={{ left: contextMenu.x, top: contextMenu.y, background: '#fffefb', border: `1px solid ${F.border}`, borderRadius: 12, boxShadow: '0 4px 18px rgba(45,90,39,0.13)', padding: '4px 0', minWidth: 150 }}
          >
            {(() => {
              const ch = chapters.find((c) => c.id === contextMenu.id)!
              return (
                <>
                  <button
                    onClick={() => { setEditChapter(ch); setEditTitle(ch.title); setContextMenu(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: F.textMid, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = F.greenLight}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Pencil style={{ width: 14, height: 14 }} /> Rename
                  </button>
                  <button
                    onClick={() => { setDeleteChapter(ch); setContextMenu(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fff0f0'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} /> Delete
                  </button>
                  {ch.cloud_id && (
                    <>
                      <div style={{ height: 1, background: F.border, margin: '4px 0' }} />
                      <button
                        onClick={async () => {
                          setContextMenu(null); addToast('Checking out chapter...', 'info');
                          const success = await syncService.lockChapter(ch.cloud_id!);
                          if (success) addToast('Chapter checked out!', 'success'); else addToast('Failed to check out chapter', 'error');
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: F.textMid, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = F.greenLight}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <Lock style={{ width: 14, height: 14 }} /> Check Out
                      </button>
                      <button
                        onClick={async () => {
                          setContextMenu(null); addToast('Checking in chapter...', 'info');
                          const success = await syncService.unlockChapter(ch.cloud_id!);
                          if (success) addToast('Chapter checked in!', 'success'); else addToast('Failed to check in chapter', 'error');
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: F.green, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = F.greenLight}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <Unlock style={{ width: 14, height: 14 }} /> Check In
                      </button>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Modals remain mostly unchanged in logic, but styling inside uses standard classes which will look OK enough, or we can use custom inline. Standard classes are easier to maintain for Modals. */}
      {/* Create Chapter Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Chapter" size="sm">
        <div className="space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <input
            type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Chapter title..." autoFocus
            onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && handleCreate()}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
            style={{ background: '#fffefb', borderColor: F.border, color: F.text }}
          />
          <div className="flex gap-3">
            <button onClick={() => setIsCreateOpen(false)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: F.bgHover, color: F.textMid }}>Cancel</button>
            <button id="create-chapter-submit" onClick={handleCreate} disabled={!newTitle.trim()} className="flex-1 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors" style={{ background: F.green }}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal isOpen={!!editChapter} onClose={() => setEditChapter(null)} title="Rename Chapter" size="sm">
        <div className="space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <input
            type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus
            onKeyDown={(e) => e.key === 'Enter' && editTitle.trim() && handleRename()}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
            style={{ background: '#fffefb', borderColor: F.border, color: F.text }}
          />
          <div className="flex gap-3">
            <button onClick={() => setEditChapter(null)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: F.bgHover, color: F.textMid }}>Cancel</button>
            <button id="rename-chapter-submit" onClick={handleRename} disabled={!editTitle.trim()} className="flex-1 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors" style={{ background: F.green }}>Rename</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteChapter} onClose={() => setDeleteChapter(null)} title="Delete Chapter" size="sm">
        <p style={{ fontSize: 14, color: F.textSoft, marginBottom: 20 }}>
          Delete <strong style={{ color: F.text }}>"{deleteChapter?.title}"</strong>? All version history will also be removed.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteChapter(null)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: F.bgHover, color: F.textMid }}>Cancel</button>
          <button id="confirm-delete-chapter" onClick={handleDelete} className="flex-1 py-2 text-white rounded-lg text-sm font-medium transition-colors" style={{ background: '#ef4444' }}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}
