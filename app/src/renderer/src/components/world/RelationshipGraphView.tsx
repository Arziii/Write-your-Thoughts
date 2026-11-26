import { useState, useEffect, useRef, useMemo } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
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

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: 'hsl(var(--brand-green-bg))', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700,
        color: 'hsl(var(--brand-green))', userSelect: 'none', flexShrink: 0,
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
  const { addToast } = useToastStore()

  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 600 })
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, NodePos>>({})
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

  const hasCharacters = characters.length > 0

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
  }, [hasCharacters])

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

  const characterIds = useMemo(() => new Set(characters.map(character => character.id)), [characters])
  const links = allRelationships.filter(link =>
    characterIds.has(link.source_character_id) && characterIds.has(link.target_character_id)
  )
  const linkedIds = new Set(links.flatMap(link => [link.source_character_id, link.target_character_id]))
  const linkedCharacters = [...linkedIds]
    .map(id => characters.find(character => character.id === id)!)
  const unlinkedCharacters = characters.filter(character => !linkedIds.has(character.id))
  const columns = Math.min(linkedCharacters.length, Math.max(1, Math.floor(canvasSize.w / 150)))
  const rows = Math.ceil(linkedCharacters.length / Math.max(1, columns))
  const nodePositions = Object.fromEntries(linkedCharacters.map((character, index) => {
    const row = Math.floor(index / columns)
    const rowLength = Math.min(columns, linkedCharacters.length - row * columns)
    const offset = nodeOffsets[character.id]
    return [character.id, {
      x: canvasSize.w / 2 + (index % columns - (rowLength - 1) / 2) * 150 + (offset?.x ?? 0),
      y: Math.max(65, canvasSize.h / 2 - 14 - (rows - 1) * 60) + row * 120 + (offset?.y ?? 0),
    }]
  }))

  const nodeMoved = useRef(false)

  function onNodeMouseDown(e: React.MouseEvent, charId: string) {
    if (e.button !== 0) return
    e.stopPropagation()
    nodeMoved.current = false
    const offset = nodeOffsets[charId] ?? { x: 0, y: 0 }
    dragRef.current = {
      characterId: charId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: offset.x,
      startNodeY: offset.y,
    }
  }

  function startRelationship(sourceId: string) {
    setEditModal({
      rel: null,
      isNew: true,
      sourceId,
      targetId: '',
      type: 'Friend',
      trustLevel: 5,
      affectionLevel: 5,
      history: '',
      currentState: '',
    })
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const { characterId, startMouseX, startMouseY, startNodeX, startNodeY } = dragRef.current
        if (!nodeMoved.current && Math.hypot(e.clientX - startMouseX, e.clientY - startMouseY) < 4) return
        nodeMoved.current = true
        setNodeOffsets(prev => ({
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
        if (!editModal.targetId || editModal.targetId === editModal.sourceId) return
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

  return (
    <div className="studio-desk flex h-full flex-col">
      <div className="studio-chapter-toolbar flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2">
        <h2 className="font-serif text-sm font-semibold text-[hsl(var(--brand-green))]">Character Relationship Map</h2>
        <button
          type="button"
          disabled={characters.length < 2 || loading}
          onClick={() => startRelationship(characters[0].id)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          + Add Relationship
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden select-none"
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
            {links.map(rel => {
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
            {linkedCharacters.map(char => {
              const pos = nodePositions[char.id]
              if (!pos) return null
              const nodeSize = 56
              return (
                <button
                  type="button"
                  title={char.name}
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
                    zIndex: 5,
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={e => onNodeMouseDown(e, char.id)}
                  onClick={(event) => {
                    if (event.detail && nodeMoved.current) return
                    openTab(char.id, 'character', char.name)
                  }}
                >
                  {/* Avatar circle */}
                  <div style={{
                    width: nodeSize, height: nodeSize,
                    borderRadius: '50%',
                    border: '2px solid hsl(var(--studio-edge))',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
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
                    background: 'hsl(var(--studio-paper))',
                    border: '1px solid hsl(var(--studio-edge))',
                    borderRadius: 8,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'hsl(var(--studio-ink))',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {char.name}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {!loading && links.length === 0 && (
          <p className="absolute inset-0 grid place-content-center px-4 text-center text-sm text-surface-500">
            {characters.length < 2 ? 'Add another character to create a relationship.' : 'Add a relationship to connect your characters.'}
          </p>
        )}
      </div>

      {!loading && unlinkedCharacters.length > 0 && (
        <section className="studio-chapter-toolbar shrink-0 border-t border-[hsl(var(--studio-edge))] px-4 py-3" aria-label="Unlinked characters">
          <h3 className="mb-2 text-xs font-semibold text-surface-400">Unlinked · {unlinkedCharacters.length}</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {unlinkedCharacters.map(character => (
              <button
                key={character.id}
                type="button"
                onClick={() => startRelationship(character.id)}
                disabled={characters.length < 2}
                title={`Add a relationship for ${character.name}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] py-1 pl-1 pr-3 text-xs text-surface-200 hover:bg-[hsl(var(--brand-green-bg))] disabled:opacity-60"
              >
                {character.image_url
                  ? <img src={character.image_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                  : <InitialsAvatar name={character.name} size={24} />}
                {character.name}
                <span aria-hidden="true">+</span>
              </button>
            ))}
          </div>
        </section>
      )}

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
                onChange={e => setEditModal(m => m && {
                  ...m,
                  sourceId: e.target.value,
                  targetId: m.targetId === e.target.value ? '' : m.targetId,
                })}
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
                disabled={!editModal.targetId || editModal.sourceId === editModal.targetId}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent-600 text-white hover:bg-accent-500 transition-colors disabled:opacity-50"
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

