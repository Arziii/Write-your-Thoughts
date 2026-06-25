import { useMemo } from 'react'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

interface Props {
  bookId: string
}

export default function RelationshipGraph({ bookId }: Props) {
  const { relationships } = useStoryBibleStore()
  const { characters } = useWorkspaceStore()
  
  // Create a simple radial graph mapping
  const nodes = useMemo(() => {
    return characters.filter(c => c.book_id === bookId)
  }, [characters, bookId])

  const edges = useMemo(() => {
    // Collect all relationships across all characters in this book
    const all = []
    for (const sourceId in relationships) {
      for (const rel of relationships[sourceId]) {
        if (rel.book_id === bookId) {
          all.push(rel)
        }
      }
    }
    return all
  }, [relationships, bookId])

  if (nodes.length === 0) {
    return <div className="text-surface-400 text-sm text-center p-8">No characters found to map.</div>
  }

  // Simple circle layout
  const radius = 200
  const centerX = 300
  const centerY = 300
  
  const nodePositions = new Map<string, { x: number, y: number }>()
  nodes.forEach((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI
    nodePositions.set(node.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    })
  })

  const getEdgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'romance': return 'stroke-pink-500'
      case 'enemy': return 'stroke-red-500'
      case 'rival': return 'stroke-orange-500'
      case 'family': return 'stroke-blue-500'
      case 'friend': return 'stroke-green-500'
      case 'mentor': return 'stroke-purple-500'
      default: return 'stroke-surface-500'
    }
  }

  return (
    <div className="w-full h-full min-h-[600px] bg-surface-900 rounded-lg border border-surface-700 flex items-center justify-center overflow-hidden">
      <svg width={centerX * 2} height={centerY * 2} className="overflow-visible">
        {/* Draw Edges */}
        {edges.map(edge => {
          const source = nodePositions.get(edge.source_character_id)
          const target = nodePositions.get(edge.target_character_id)
          if (!source || !target) return null
          
          return (
            <g key={edge.id}>
              <line
                x1={source.x} y1={source.y}
                x2={target.x} y2={target.y}
                className={`${getEdgeColor(edge.relationship_type)} opacity-40`}
                strokeWidth={2 + (edge.affection_level || 5) / 3}
              />
            </g>
          )
        })}

        {/* Draw Nodes */}
        {nodes.map(node => {
          const pos = nodePositions.get(node.id)
          if (!pos) return null
          
          return (
            <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`} className="cursor-pointer">
              <circle r={24} className="fill-surface-800 stroke-accent-500" strokeWidth={2} />
              <text y={36} textAnchor="middle" className="fill-surface-100 text-xs font-semibold drop-shadow-md">
                {node.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
