import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, ChevronDown, GripVertical } from 'lucide-react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import { cn } from '../../utils'
import Modal from '../ui/Modal'
import { useWorkspaceStore } from '../../stores/workspaceStore'

interface EntityTreeProps {
  title: string
  items: Array<{ id: string; title: string }>
  icon: React.ReactNode
  type: 'character' | 'location' | 'note' | 'timeline'
  onCreate: (title: string) => Promise<void>
  onRename: (id: string, newTitle: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  emptyMessage: string
  singularTitle?: string
  staticItems?: Array<{ id: string; title: string; icon?: React.ReactNode }>
}

export default function EntityTree({ title, items, staticItems, icon, type, onCreate, onRename, onDelete, emptyMessage, singularTitle }: EntityTreeProps) {
  const { openTab, activeTabId } = useWorkspaceStore()
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editItem, setEditItem] = useState<{ id: string; title: string } | null>(null)
  const [deleteItem, setDeleteItem] = useState<{ id: string; title: string } | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    try {
      await onCreate(newTitle.trim())
      setIsCreateOpen(false)
      setNewTitle('')
    } catch (err) {
      console.error('Failed to create entity:', err)
      // Provide a generic fail fallback to unblock the UI if the toast store is not accessible directly here
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
    openTab(item.id, type, item.title)
  }

  return (
    <div className="px-1 mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-surface-500 hover:text-surface-300 transition-colors uppercase tracking-wider"
      >
        <ChevronDown className={cn('w-3 h-3 transition-transform', !isExpanded && '-rotate-90')} />
        {title}
      </button>

      {isExpanded && (
        <div className="space-y-0.5">
          {staticItems?.map(item => (
            <div key={item.id} className="group relative">
              <button
                onClick={() => openTab(item.id, type, item.title)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-2 py-1.5 text-sm rounded-md transition-colors',
                  activeTabId === item.id
                    ? 'bg-accent-600/20 text-accent-300 border-l-2 border-accent-500'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                )}
              >
                <div className="flex-shrink-0 flex items-center justify-center opacity-70">{item.icon || icon}</div>
                <span className="truncate flex-1 text-left text-xs">{item.title}</span>
              </button>
            </div>
          ))}

          <Droppable droppableId={type} isDropDisabled={items.length === 0}>
            {(provided) => (
              <div 
                className="space-y-0.5"
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {items.map((item, idx) => (
                  <Draggable key={item.id} draggableId={item.id} index={idx}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "group relative",
                          snapshot.isDragging && "opacity-90 z-50 rounded-md ring-1 ring-accent-500/50 shadow-lg"
                        )}
                        style={provided.draggableProps.style}
                      >
                        <button
                          onClick={() => openItem(item)}
                          className={cn(
                            'flex items-center gap-1.5 w-full px-1.5 py-1.5 text-sm rounded-md transition-colors',
                            activeTabId === item.id
                              ? 'bg-accent-600/20 text-accent-300 border-l-2 border-accent-500'
                              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
                          )}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-surface-300 cursor-grab active:cursor-grabbing p-0.5 -ml-1 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-shrink-0 flex items-center justify-center opacity-70">{icon}</div>
                          <span className="truncate flex-1 text-left text-xs">{item.title}</span>
                          <div className="flex items-center gap-1 flex-shrink-0 pr-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setContextMenu({ id: item.id, x: e.clientX, y: e.clientY })
                              }}
                              className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-surface-300 transition-all"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
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

          {items.length === 0 && (
            <p className="text-xs text-surface-600 px-2 py-1">{emptyMessage}</p>
          )}

          <button
            onClick={() => { setNewTitle(''); setIsCreateOpen(true) }}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-surface-600 hover:text-accent-400 hover:bg-surface-800/40 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New {singularTitle || title.slice(0, -1)}
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
              const it = items.find((c) => c.id === contextMenu.id)!
              return (
                <>
                  <button
                    onClick={() => {
                      setEditItem(it)
                      setEditTitle(it.title)
                      setContextMenu(null)
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-surface-300 hover:bg-surface-700 hover:text-surface-100 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Rename
                  </button>
                  <button
                    onClick={() => { setDeleteItem(it); setContextMenu(null) }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-danger-400 hover:bg-surface-700 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title={`New ${title.slice(0, -1)}`} size="sm">
        <div className="space-y-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Name..."
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && handleCreate()}
            className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all"
          />
          <div className="flex gap-3">
            <button onClick={() => setIsCreateOpen(false)} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button
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
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Rename" size="sm">
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
            <button onClick={() => setEditItem(null)} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button
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
      <Modal isOpen={!!deleteItem} onClose={() => setDeleteItem(null)} title="Delete" size="sm">
        <p className="text-sm text-surface-300 mb-5">
          Delete <strong className="text-surface-100">"{deleteItem?.title}"</strong>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteItem(null)} className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
          <button onClick={handleDelete} className="flex-1 py-2 bg-danger-500 hover:bg-danger-400 text-white rounded-lg text-sm font-medium transition-colors">Delete</button>
        </div>
      </Modal>
    </div>
  )
}
