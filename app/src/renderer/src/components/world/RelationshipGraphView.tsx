import { useState, useEffect, useRef, useCallback } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useToastStore } from '../../stores/toastStore'
import type { Relationship } from '../../types'

// ── Types ──────────────────────────────────────────────────────────
interface NodePos {
  x: number
  y: number
}

interface DragState {
  characterId: string
  startMouseX: number
  startMouseY: number
  startNodeX: number
  startNodeY: number
}

// ── Relationship type config ────────────────────────────────────────
const REL_TYPES: { label: string; color: string; icon: string }[] = [
  { label: 'Friend',  color: '#3b82f6', icon: '●' },
  { label: 'Enemy',   color: '#ef4444', icon: '✕' },
  { label: 'Rival',   color: '#f97316', icon: '⚡' },
  { label: 'Family',  color: '#a855f7', icon: '♥' },
  { label: 'Lover',   color: '#ec4899', icon: '♥' },
  { label: 'Mentor',  color: '#14b8a6', icon: '★' },
  { label: 'Ally',    color: '#22c55e', icon: '◆' },
  { label: 'Neutral', color: '#6b7280', icon: '—' },
]

function getRelColor(type: string) {
  const found = REL_TYPES.find(r => r.label.toLowerCase() === type.toLowerCase())
  return found?.color ?? '#6b7280'
}

// ── Initials avatar ─────────────────────────────────────────────────
function InitialsAvatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f97316',
    '#14b8a6', '#22c55e', '#ef4444', '#a855f7',
  ]
  const idx = name.charCodeAt(0) % colors.length
  const bg = colors[idx]

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700,
        color: '#fff', userSelect: 'none', flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

// ── Arrow with label ────────────────────────────────────────────────
function Arrow({
  x1, y1, x2, y2, color, label, onEdit,
}: {
  x1: number; y1: number; x2: number; y2: number
  color: string; label: string; onEdit: () => void
}) {
  const NODE_R = 32 // node radius – keep arrow outside the circle

  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.sqrt(dx * dx + dy * dy) || 1

  // Shorten so arrow starts/ends at node edge
  const sx = x1 + (dx / dist) * NODE_R
  const sy = y1 + (dy / dist) * NODE_R
  const ex = x2 - (dx / dist) * NODE_R
  const ey = y2 - (dy / dist) * NODE_R

  const mx = (sx + ex) / 2
  const my = (sy + ey) / 2

  return (
    <g onClick={onEdit} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
      <defs>
        <marker
          id={`arrow-${color.replace('#', '')}`}
          markerWidth="8" markerHeight="8"
          refX="6" refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L8,3 z" fill={color} />
        </marker>
      </defs>
      {/* Invisible wide hit-area */}
      <line x1={sx} y1={sy} x2={ex} y2={ey}
        stroke="transparent" strokeWidth={16} />
      {/* Actual arrow */}
      <line
        x1={sx} y1={sy} x2={ex} y2={ey}
        stroke={color} strokeWidth={2}
        markerEnd={`url(#arrow-${color.replace('#', '')})`}
      />
      {/* Label pill */}
      <g transform={`translate(${mx}, ${my})`}>
        <rect x={-28} y={-11} width={56} height={22} rx={11}
          fill="#fffefb" stroke={color} strokeWidth={1.5} />
        <text
          x={0} y={4.5}
          textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={10} fontWeight={600}
          style={{ userSelect: 'none' }}
        >
          {label}
        </text>
      </g>
    </g>
  )
}

// ── Main Component ──────────────────────────────────────────────────
export default function RelationshipGraphView() {
  const { characters, openTab, currentBook } = useWorkspaceStore()
  const { relationships, setRelationships, addRelationship, removeRelationship } = useStoryBibleStore()
  const { addToast } = useToastStore()

  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 })
  const [nodePositions, setNodePositions] = useState<Record<string, NodePos>>({})
  const [allRelationships, setAllRelationships] = useState<Relationship[]>([])
  const [loading, setLoading] = useState(true)

  // Edit modal state
  const [editModal, setEditModal] = useState<{
    rel: Relationship | null
    isNew: boolean
    sourceId: string
    targetId: string
    type: string
    trustLevel: number
    affectionLevel: number
    history: string
    currentState: string
  } | null>(null)

  // Drag state
  const dragRef = useRef<DragState | null>(null)

  // Canvas pan
  const panRef = useRef({ x: 0, y: 0, dragging: false, startX: 0, startY: 0 })
  const [pan, setPan] = useState({ x: 0, y: 0 })

  // Measure canvas
  useEffect(() => {
    if (!canvasRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setCanvasSize({ w: e.contentRect.width, h: e.contentRect.height })
      }
    })
    ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [])

  // Load relationships
  useEffect(() => {
    if (!currentBook?.id) return
    loadAll()
  }, [currentBook?.id, characters])

  async function loadAll() {
    if (!currentBook?.id) return
    setLoading(true)
    try {
      const rels = await window.api.relationships.getByBook(currentBook.id)
      setAllRelationships(rels as Relationship[])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Initial layout: first character in center, rest in a circle around it
  useEffect(() => {
    if (!characters.length) return
    const cx = canvasSize.w / 2
    const cy = canvasSize.h / 2
    const radius = Math.min(canvasSize.w, canvasSize.h) * 0.32

    const positions: Record<string, NodePos> = {}

    characters.forEach((char, idx) => {
      if (idx === 0) {
        positions[char.id] = { x: cx, y: cy }
      } else {
        const angle = ((idx - 1) / (characters.length - 1)) * 2 * Math.PI
        positions[char.id] = {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        }
      }
    })

    setNodePositions(positions)
  }, [characters, canvasSize])

  // ── Drag handlers ───────────────────────────────────────────────────
  const onNodeMouseDown = useCallback((e: React.MouseEvent, charId: string) => {
    e.stopPropagation()
    const pos = nodePositions[charId] || { x: 0, y: 0 }
    dragRef.current = {
      characterId: charId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: pos.x,
      startNodeY: pos.y,
    }
  }, [nodePositions])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const { characterId, startMouseX, startMouseY, startNodeX, startNodeY } = dragRef.current
        setNodePositions(prev => ({
          ...prev,
          [characterId]: {
            x: startNodeX + (e.clientX - startMouseX),
            y: startNodeY + (e.clientY - startMouseY),
          },
        }))
      } else if (panRef.current.dragging) {
        const dx = e.clientX - panRef.current.startX
        const dy = e.clientY - panRef.current.startY
        setPan({ x: panRef.current.x + dx, y: panRef.current.y + dy })
      }
    }
    const onMouseUp = () => {
      dragRef.current = null
      panRef.current.dragging = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // ── Save / delete relationship ──────────────────────────────────────
  async function saveEditModal() {
    if (!editModal || !currentBook) return
    try {
      if (editModal.rel) {
        // Update existing
        const updated = await window.api.relationships.upsert({
          ...editModal.rel,
          relationship_type: editModal.type,
          trust_level: editModal.trustLevel,
          affection_level: editModal.affectionLevel,
          history: editModal.history,
          current_state: editModal.currentState,
        })
        setAllRelationships(prev =>
          prev.map(r => r.id === editModal.rel!.id ? updated as Relationship : r)
        )
        addToast('Relationship updated', 'success')
      } else {
        // Create new
        if (!editModal.targetId) return
        const created = await window.api.relationships.upsert({
          book_id: currentBook.id,
          source_character_id: editModal.sourceId,
          target_character_id: editModal.targetId,
          relationship_type: editModal.type,
          trust_level: editModal.trustLevel,
          affection_level: editModal.affectionLevel,
          history: editModal.history,
          current_state: editModal.currentState,
        })
        setAllRelationships(prev => [...prev, created as Relationship])
        addToast('Relationship created', 'success')
      }
      setEditModal(null)
    } catch (e: any) {
      addToast(e.message || 'Failed to save', 'error')
    }
  }

  async function deleteRelationship() {
    if (!editModal?.rel) return
    try {
      await window.api.relationships.delete(editModal.rel.id)
      setAllRelationships(prev => prev.filter(r => r.id !== editModal!.rel!.id))
      addToast('Relationship deleted', 'info')
      setEditModal(null)
    } catch {
      addToast('Failed to delete', 'error')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  if (!characters.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-surface-500 text-sm">
        No characters yet. Create characters first.
      </div>
    )
  }

  // Collect all unique arrow colors for defs
  const usedColors = Array.from(new Set(allRelationships.map(r => getRelColor(r.relationship_type))))

  return (
    <div className="flex flex-col h-full" style={{ background: '#f0ece4' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0" style={{ borderColor: '#d3ccbe', background: '#f6f1e9' }}>
        <h2 className="text-sm font-bold" style={{ color: '#2d5a27', fontFamily: '"Playfair Display", serif' }}>Character Relationship Map</h2>
        <button
          onClick={() => {
            if (!characters.length) return
            setEditModal({
              rel: null,
              isNew: true,
              sourceId: characters[0].id,
              targetId: '',
              type: 'Friend',
              trustLevel: 5,
              affectionLevel: 5,
              history: '',
              currentState: '',
            })
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          + Add Relationship
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ background: '#f0ece4' }}
        onMouseDown={e => {
          if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
            panRef.current = { x: pan.x, y: pan.y, dragging: true, startX: e.clientX, startY: e.clientY }
          }
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-surface-500 text-sm">
            Loading relationships…
          </div>
        )}

        {/* SVG for arrows */}
        <svg
          width={canvasSize.w} height={canvasSize.h}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }}
        >
          <g transform={`translate(${pan.x}, ${pan.y})`} style={{ pointerEvents: 'auto' }}>
            {allRelationships.map(rel => {
              const src = nodePositions[rel.source_character_id]
              const tgt = nodePositions[rel.target_character_id]
              if (!src || !tgt) return null
              const color = getRelColor(rel.relationship_type)
              return (
                <Arrow
                  key={rel.id}
                  x1={src.x} y1={src.y}
                  x2={tgt.x} y2={tgt.y}
                  color={color}
                  label={rel.relationship_type}
                  onEdit={() => setEditModal({ 
                    rel, isNew: false, sourceId: rel.source_character_id, targetId: rel.target_character_id, 
                    type: rel.relationship_type, trustLevel: rel.trust_level || 5, affectionLevel: rel.affection_level || 5, 
                    history: rel.history || '', currentState: rel.current_state || '' 
                  })}
                />
              )
            })}
          </g>
        </svg>

        {/* Character nodes */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, position: 'absolute', top: 0, left: 0 }}>
            {characters.map((char, idx) => {
              const pos = nodePositions[char.id]
              if (!pos) return null
              const isCenter = idx === 0
              const nodeSize = isCenter ? 72 : 56
              const labelColor = isCenter ? '#3b82f6' : '#1e293b'
              return (
                <div
                  key={char.id}
                  style={{
                    position: 'absolute',
                    left: pos.x - nodeSize / 2,
                    top: pos.y - nodeSize / 2,
                    width: nodeSize,
                    cursor: 'grab',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    zIndex: isCenter ? 10 : 5,
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={e => onNodeMouseDown(e, char.id)}
                  onClick={(e) => {
                    if (dragRef.current) return
                    openTab(char.id, 'character', char.name)
                  }}
                >
                  {/* Avatar circle */}
                  <div style={{
                    width: nodeSize, height: nodeSize,
                    borderRadius: '50%',
                    border: isCenter ? '3px solid #3b82f6' : '2px solid #cbd5e1',
                    boxShadow: isCenter ? '0 0 0 4px rgba(59,130,246,0.25)' : '0 2px 8px rgba(0,0,0,0.12)',
                    overflow: 'hidden',
                    background: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {char.image_url ? (
                      <img src={char.image_url} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <InitialsAvatar name={char.name} size={nodeSize} />
                    )}
                  </div>
                  {/* Name label */}
                  <div style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: isCenter ? 700 : 600,
                    color: labelColor,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {char.name}
                    {isCenter && (
                      <span style={{ marginLeft: 4, fontSize: 9, color: '#3b82f6', fontWeight: 400 }}>• Center</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16,
          background: '#fffefb',
          border: '1px solid #d3ccbe',
          borderRadius: 12,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          boxShadow: '0 4px 12px rgba(45,90,39,0.08)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Legend</div>
          {REL_TYPES.map(rt => (
            <div key={rt.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 2, background: rt.color, borderRadius: 2, position: 'relative' }}>
                <div style={{
                  position: 'absolute', right: -4, top: -4,
                  width: 0, height: 0,
                  borderTop: '5px solid transparent',
                  borderBottom: '5px solid transparent',
                  borderLeft: `7px solid ${rt.color}`,
                }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: rt.color }}>{rt.label}</span>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          fontSize: 10, color: '#94a3b8', textAlign: 'right',
        }}>
          Drag nodes to rearrange · Click arrows to edit · Click nodes to open profile
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(26,46,24,0.4)' }}
          onClick={() => setEditModal(null)}
        >
          <div
            className="rounded-2xl shadow-2xl p-6 w-[480px] max-w-[95vw]"
            style={{ background: '#fffefb', border: '1px solid #d3ccbe' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: '#1a2e18', fontFamily: '"Playfair Display", serif' }}>
              {editModal.isNew ? 'Add Relationship' : 'Edit Relationship'}
            </h3>

            {/* Source */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">From Character</label>
              <select
                value={editModal.sourceId}
                onChange={e => setEditModal(m => m && { ...m, sourceId: e.target.value })}
                disabled={!editModal.isNew}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-400"
                style={{ color: '#0f172a' }}
              >
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Target */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">To Character</label>
              <select
                value={editModal.targetId}
                onChange={e => setEditModal(m => m && { ...m, targetId: e.target.value })}
                disabled={!editModal.isNew}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-400"
                style={{ color: '#0f172a' }}
              >
                <option value="">Select a character…</option>
                {characters
                  .filter(c => c.id !== editModal.sourceId)
                  .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                }
              </select>
            </div>

            {/* Type */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Relationship Type</label>
              <select
                value={editModal.type}
                onChange={e => setEditModal(m => m && { ...m, type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-400"
                style={{ color: '#0f172a' }}
              >
                {REL_TYPES.map(rt => (
                  <option key={rt.label} value={rt.label}>{rt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Trust Level (1-10)</label>
                <input
                  type="number" min="1" max="10"
                  value={editModal.trustLevel}
                  onChange={e => setEditModal(m => m && { ...m, trustLevel: parseInt(e.target.value) || 5 })}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-400"
                  style={{ color: '#0f172a' }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Affection (1-10)</label>
                <input
                  type="number" min="1" max="10"
                  value={editModal.affectionLevel}
                  onChange={e => setEditModal(m => m && { ...m, affectionLevel: parseInt(e.target.value) || 5 })}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-400"
                  style={{ color: '#0f172a' }}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Shared History</label>
              <textarea
                value={editModal.history}
                onChange={e => setEditModal(m => m && { ...m, history: e.target.value })}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                style={{ color: '#0f172a', height: '60px' }}
                placeholder="How did they meet? Past conflicts?"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Current State</label>
              <textarea
                value={editModal.currentState}
                onChange={e => setEditModal(m => m && { ...m, currentState: e.target.value })}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                style={{ color: '#0f172a', height: '60px' }}
                placeholder="Current dynamic..."
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              {!editModal.isNew && (
                <button
                  onClick={deleteRelationship}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEditModal}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent-600 text-white hover:bg-accent-500 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

