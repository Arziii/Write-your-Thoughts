import { useState } from 'react'
import { useOpenBookTab } from '../../hooks/useOpenBookTab'
import { Plus, MoreHorizontal, Pencil, Trash2, ChevronDown, GripVertical } from 'lucide-react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import Modal from '../ui/Modal'
import { Button, Input } from '../ui/primitives'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn } from '../../utils'

interface EntityTreeProps {
  title: string
  items: Array<{ id: string; title: string }>
  icon: React.ReactNode
  type: 'character' | 'location' | 'note' | 'timeline' | 'codex' | 'wiki' | 'organization' | 'world_rule'
  onCreate: (title: string) => Promise<void>
  onRename: (id: string, newTitle: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  emptyMessage: string
  singularTitle?: string
  staticItems?: Array<{ id: string; title: string; icon?: React.ReactNode }>
  filterQuery?: string
}

export default function EntityTree({
  title,
  items,
  staticItems,
  icon,
  type,
  onCreate,
  onRename,
  onDelete,
  emptyMessage,
  singularTitle,
  filterQuery = '',
}: EntityTreeProps) {
  const { activeTabId } = useWorkspaceStore()
  const openBookTab = useOpenBookTab()

  const [isExpanded, setIsExpanded] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editItem, setEditItem] = useState<{ id: string; title: string } | null>(null)
  const [deleteItem, setDeleteItem] = useState<{ id: string; title: string } | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  const query = filterQuery.trim().toLowerCase()
  const visibleItems = query
    ? items.filter(item => item.title.toLowerCase().includes(query))
    : items
  const visibleStatic = query
    ? (staticItems ?? []).filter(item => item.title.toLowerCase().includes(query))
    : (staticItems ?? [])

  if (query && visibleItems.length === 0 && visibleStatic.length === 0) {
    return null
  }

  const expanded = query ? true : isExpanded
  const totalCount = visibleItems.length + visibleStatic.length

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      await onCreate(newTitle.trim())
      setIsCreateOpen(false)
      setNewTitle('')
    } catch (err) {
      console.error('Failed to create entity:', err)
      setIsCreateOpen(false)
    }
  }

  const handleRename = async () => {
    if (!editItem || !editTitle.trim()) return
    await onRename(editItem.id, editTitle.trim())
    setEditItem(null)
  }

  const handleDelete = async () => {
    if (!deleteItem) return
    await onDelete(deleteItem.id)
    setDeleteItem(null)
  }

  const openItem = (item: { id: string; title: string }) => {
    openBookTab(item.id, type, item.title)
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
        <span className="flex-1 truncate">{title}</span>
        <span className="rounded-full bg-surface-850 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-surface-400">
          {totalCount}
        </span>
      </button>

      {expanded && (
        <div className="mt-1 flex flex-col gap-0.5">
          {visibleStatic.map(item => {
            const isActive = activeTabId === item.id
            return (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  onClick={() => openBookTab(item.id, type, item.title)}
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-md border-l-2 px-1.5 py-1.5 text-left text-[13px] transition-colors',
                    isActive
                      ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] font-semibold text-[hsl(var(--brand-green))]'
                      : 'border-transparent font-medium text-surface-400 hover:bg-surface-850 hover:text-surface-200'
                  )}
                >
                  <div className={cn('flex items-center justify-center pl-3', isActive ? 'opacity-100' : 'opacity-70')}>
                    {item.icon || icon}
                  </div>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                </button>
              </div>
            )
          })}

          <Droppable droppableId={type} isDropDisabled={visibleItems.length === 0 || Boolean(query)}>
            {(provided) => (
              <div
                className="flex flex-col gap-0.5"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {visibleItems.map((item, idx) => {
                  const isActive = activeTabId === item.id
                  return (
                    <Draggable key={item.id} draggableId={item.id} index={idx} isDragDisabled={Boolean(query)}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn('group relative', snapshot.isDragging && 'z-50 opacity-90')}
                          style={provided.draggableProps.style}
                        >
                          <div
                            onClick={() => openItem(item)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(item) } }}
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

                            <div className={cn('flex items-center justify-center shrink-0', isActive ? 'opacity-100' : 'opacity-70')}>
                              {icon}
                            </div>
                            <span className="min-w-0 flex-1 truncate">{item.title}</span>

                            <div className="flex shrink-0 items-center gap-1 pr-1">
                              <button
                                type="button"
                                aria-label={`Options for ${item.title}`}
                                onClick={(e) => { e.stopPropagation(); setContextMenu({ id: item.id, x: e.clientX, y: e.clientY }) }}
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

          {visibleItems.length === 0 && visibleStatic.length === 0 && (
            <p className="px-2 py-1 text-xs text-surface-500">{emptyMessage}</p>
          )}

          {!query && (
            <button
              type="button"
              onClick={() => { setNewTitle(''); setIsCreateOpen(true) }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-surface-400 transition-colors hover:bg-surface-850 hover:text-[hsl(var(--brand-green))]"
            >
              <Plus className="h-3.5 w-3.5" />
              New {singularTitle || title.slice(0, -1)}
            </button>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 min-w-[150px] animate-fade-in rounded-xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const it = items.find((c) => c.id === contextMenu.id)
              if (!it) return null
              return (
                <>
                  <button
                    type="button"
                    onClick={() => { setEditItem(it); setEditTitle(it.title); setContextMenu(null) }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-surface-200 transition-colors hover:bg-[hsl(var(--brand-green-bg))] hover:text-[hsl(var(--brand-green))]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleteItem(it); setContextMenu(null) }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-danger-500 transition-colors hover:bg-danger-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title={`New ${singularTitle || title.slice(0, -1)}`} size="sm">
        <div className="space-y-4">
          <Input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Name..."
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && handleCreate()}
          />
          <div className="flex gap-3">
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" size="md" className="flex-1" onClick={handleCreate} disabled={!newTitle.trim()}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Rename" size="sm">
        <div className="space-y-4">
          <Input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && editTitle.trim() && handleRename()}
          />
          <div className="flex gap-3">
            <Button variant="secondary" size="md" className="flex-1" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button variant="primary" size="md" className="flex-1" onClick={handleRename} disabled={!editTitle.trim()}>Rename</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteItem} onClose={() => setDeleteItem(null)} title="Delete" size="sm">
        <p className="mb-5 text-sm text-surface-400">
          Delete <strong className="text-surface-100">"{deleteItem?.title}"</strong>?
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={() => setDeleteItem(null)}>Cancel</Button>
          <Button variant="danger" size="md" className="flex-1" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
