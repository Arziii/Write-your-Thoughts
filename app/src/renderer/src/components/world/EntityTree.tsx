import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, ChevronDown, GripVertical } from 'lucide-react'
import { Droppable, Draggable } from '@hello-pangea/dnd'
import Modal from '../ui/Modal'
import { useWorkspaceStore } from '../../stores/workspaceStore'

// ── Forest Literary Palette ──────────────────────────────────────────
const F = {
  bg: '#f0ece4',          // parchment sidebar bg
  bgHover: '#e8e2d8',     // hovered item
  active: '#e0dbd0',      // active item bg
  border: '#d0c9bc',      // divider
  green: '#2d5a27',       // forest green accent
  greenLight: '#e8f0e5',  // light green tint
  text: '#1a2e18',        // dark forest text
  textMid: '#3d5c3a',     // medium text
  textSoft: '#7a8c77',    // muted text
  textFaint: '#a0b09e',   // faintest text
}

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
    <div style={{ padding: '0 10px', marginTop: 12 }}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px',
          color: F.textSoft, background: 'none', border: 'none', borderRadius: 8,
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = F.textMid }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = F.textSoft }}
      >
        <ChevronDown style={{ width: 12, height: 12, transition: 'transform 0.15s', transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)' }} />
        {title}
      </button>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
          {staticItems?.map(item => (
            <div key={item.id} className="group relative">
              <button
                onClick={() => openTab(item.id, type, item.title)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '6px 6px', borderRadius: 6, fontSize: 13, fontWeight: activeTabId === item.id ? 600 : 500,
                  background: activeTabId === item.id ? F.greenLight : 'transparent',
                  color: activeTabId === item.id ? F.green : F.textSoft,
                  border: 'none', borderLeft: activeTabId === item.id ? `2px solid ${F.green}` : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.1s', textAlign: 'left',
                }}
                onMouseEnter={e => { if (activeTabId !== item.id) { (e.currentTarget as HTMLElement).style.background = F.bgHover; (e.currentTarget as HTMLElement).style.color = F.textMid } }}
                onMouseLeave={e => { if (activeTabId !== item.id) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = F.textSoft } }}
              >
                <div style={{ paddingLeft: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: activeTabId === item.id ? 1 : 0.7 }}>
                  {item.icon || icon}
                </div>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
              </button>
            </div>
          ))}

          <Droppable droppableId={type} isDropDisabled={items.length === 0}>
            {(provided) => (
              <div 
                style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {items.map((item, idx) => (
                  <Draggable key={item.id} draggableId={item.id} index={idx}>
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
                          onClick={() => openItem(item)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                            padding: '6px 6px', borderRadius: 6, fontSize: 13, fontWeight: activeTabId === item.id ? 600 : 500,
                            background: activeTabId === item.id ? F.greenLight : 'transparent',
                            color: activeTabId === item.id ? F.green : F.textSoft,
                            border: 'none', borderLeft: activeTabId === item.id ? `2px solid ${F.green}` : '2px solid transparent',
                            cursor: 'pointer', transition: 'all 0.1s', textAlign: 'left',
                            boxShadow: snapshot.isDragging ? `0 4px 12px rgba(45,90,39,0.15)` : 'none'
                          }}
                          onMouseEnter={e => { if (activeTabId !== item.id) { (e.currentTarget as HTMLElement).style.background = F.bgHover; (e.currentTarget as HTMLElement).style.color = F.textMid } }}
                          onMouseLeave={e => { if (activeTabId !== item.id) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = F.textSoft } }}
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
                          
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: activeTabId === item.id ? 1 : 0.7 }}>
                            {icon}
                          </div>
                          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, paddingRight: 4 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setContextMenu({ id: item.id, x: e.clientX, y: e.clientY }) }}
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

          {items.length === 0 && (
            <p style={{ fontSize: 12, color: F.textFaint, padding: '4px 8px' }}>{emptyMessage}</p>
          )}

          {/* Add entity */}
          <button
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
            New {singularTitle || title.slice(0, -1)}
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
              const it = items.find((c) => c.id === contextMenu.id)!
              return (
                <>
                  <button
                    onClick={() => { setEditItem(it); setEditTitle(it.title); setContextMenu(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: F.textMid, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = F.greenLight}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Pencil style={{ width: 14, height: 14 }} /> Rename
                  </button>
                  <button
                    onClick={() => { setDeleteItem(it); setContextMenu(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fff0f0'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Trash2 style={{ width: 14, height: 14 }} /> Delete
                  </button>
                </>
              )
            })()}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title={`New ${title.slice(0, -1)}`} size="sm">
        <div className="space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <input
            type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Name..." autoFocus
            onKeyDown={(e) => e.key === 'Enter' && newTitle.trim() && handleCreate()}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
            style={{ background: '#fffefb', borderColor: F.border, color: F.text }}
          />
          <div className="flex gap-3">
            <button onClick={() => setIsCreateOpen(false)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: F.bgHover, color: F.textMid }}>Cancel</button>
            <button onClick={handleCreate} disabled={!newTitle.trim()} className="flex-1 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors" style={{ background: F.green }}>Create</button>
          </div>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Rename" size="sm">
        <div className="space-y-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <input
            type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus
            onKeyDown={(e) => e.key === 'Enter' && editTitle.trim() && handleRename()}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 transition-all"
            style={{ background: '#fffefb', borderColor: F.border, color: F.text }}
          />
          <div className="flex gap-3">
            <button onClick={() => setEditItem(null)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: F.bgHover, color: F.textMid }}>Cancel</button>
            <button onClick={handleRename} disabled={!editTitle.trim()} className="flex-1 py-2 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors" style={{ background: F.green }}>Rename</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteItem} onClose={() => setDeleteItem(null)} title="Delete" size="sm">
        <p style={{ fontSize: 14, color: F.textSoft, marginBottom: 20 }}>
          Delete <strong style={{ color: F.text }}>"{deleteItem?.title}"</strong>?
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteItem(null)} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: F.bgHover, color: F.textMid }}>Cancel</button>
          <button onClick={handleDelete} className="flex-1 py-2 text-white rounded-lg text-sm font-medium transition-colors" style={{ background: '#ef4444' }}>Delete</button>
        </div>
      </Modal>
    </div>
  )
}
