import type {
  Chapter,
  Character,
  Codex,
  Location,
  Note,
  Organization,
  Relationship,
  Wiki,
  WorldRule,
} from '../../types'

export type GraphEntityKind =
  | 'character'
  | 'chapter'
  | 'location'
  | 'organization'
  | 'world_rule'
  | 'codex'
  | 'wiki'
  | 'note'

export type GraphEdgeKind = 'relationship' | 'reference' | 'mention'

export interface GraphCategoryMeta {
  kind: GraphEntityKind
  label: string
  color: string
  monochromeColor: string
}

export const GRAPH_CATEGORIES: GraphCategoryMeta[] = [
  { kind: 'character', label: 'Characters', color: '#60a5fa', monochromeColor: '#c4c7ce' },
  { kind: 'chapter', label: 'Chapters', color: '#4ade80', monochromeColor: '#b5b9c2' },
  { kind: 'location', label: 'Locations', color: '#2dd4bf', monochromeColor: '#b8bcc4' },
  { kind: 'organization', label: 'Organizations', color: '#fbbf24', monochromeColor: '#b2b6bf' },
  { kind: 'world_rule', label: 'World Rules', color: '#fb7185', monochromeColor: '#b2b6bf' },
  { kind: 'codex', label: 'Codex', color: '#c084fc', monochromeColor: '#b8bcc4' },
  { kind: 'wiki', label: 'Wiki', color: '#38bdf8', monochromeColor: '#b8bcc4' },
  { kind: 'note', label: 'Notes', color: '#a8a29e', monochromeColor: '#9ea3ad' },
]

export const CATEGORY_MAP: Record<GraphEntityKind, GraphCategoryMeta> = Object.fromEntries(
  GRAPH_CATEGORIES.map((c) => [c.kind, c])
) as Record<GraphEntityKind, GraphCategoryMeta>

export const REL_TYPES: { label: string; color: string; icon: string }[] = [
  { label: 'Friend', color: '#3b82f6', icon: '●' },
  { label: 'Enemy', color: '#ef4444', icon: '✕' },
  { label: 'Rival', color: '#f97316', icon: '⚡' },
  { label: 'Family', color: '#a855f7', icon: '♥' },
  { label: 'Lover', color: '#ec4899', icon: '♥' },
  { label: 'Mentor', color: '#14b8a6', icon: '★' },
  { label: 'Ally', color: '#22c55e', icon: '◆' },
  { label: 'Neutral', color: '#6b7280', icon: '—' },
]

export function getRelColor(type: string): string {
  const found = REL_TYPES.find((r) => r.label.toLowerCase() === type.toLowerCase())
  return found?.color ?? '#6b7280'
}

export interface GraphNode {
  id: string
  entityId: string
  kind: GraphEntityKind
  title: string
  color: string
  imageUrl?: string
  degree: number
  x: number
  y: number
  vx: number
  vy: number
  fx: number | null
  fy: number | null
  radius: number
  highlightAlpha: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: GraphEdgeKind
  color: string
  label?: string
  weight: number
  relationship?: Relationship
}

export interface ForceParams {
  centerForce: number
  repelForce: number
  linkForce: number
  linkDistance: number
  nodeSizeScale: number
}

export const DEFAULT_FORCE_PARAMS: ForceParams = {
  centerForce: 0.06,
  repelForce: 420,
  linkForce: 0.22,
  linkDistance: 135,
  nodeSizeScale: 1,
}

export interface RawReferenceEdge {
  sourceNodeId: string
  targetNodeId: string
  role?: string
}

export interface StoryGraphEntities {
  chapters: Chapter[]
  characters: Character[]
  locations: Location[]
  organizations: Organization[]
  worldRules: WorldRule[]
  codex: Codex[]
  wiki: Wiki[]
  notes: Note[]
}

export interface BuildStoryGraphInput {
  scope: 'story' | 'characters'
  entities: StoryGraphEntities
  relationships: Relationship[]
  referenceLinks: RawReferenceEdge[]
  enabledKinds: Set<GraphEntityKind>
  includeMentions: boolean
  showOrphans: boolean
  colorMode: 'category' | 'monochrome'
  nodeSizeScale: number
}

const GENERIC_SKIP_TITLES = new Set([
  'untitled',
  'new note',
  'note',
  'notes',
  'character',
  'characters',
  'location',
  'locations',
  'overview',
  'chapter',
  'prologue',
  'epilogue',
  'summary',
  'history',
])

function stripHtml(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function nodeKey(kind: GraphEntityKind, entityId: string): string {
  return `${kind}:${entityId}`
}

function computeNodeRadius(degree: number, nodeSizeScale: number): number {
  const base = 5.5 + Math.sqrt(Math.max(0, degree)) * 3.1
  return Math.max(4.5, Math.min(30, base * nodeSizeScale))
}

interface SearchTermSpec {
  targetNodeId: string
  fullTitleRegex: RegExp | null
  firstNameRegex: RegExp | null
}

export function buildStoryGraphData(input: BuildStoryGraphInput): {
  nodes: Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy' | 'fx' | 'fy' | 'highlightAlpha'>[]
  edges: GraphEdge[]
} {
  const {
    scope,
    entities,
    relationships,
    referenceLinks,
    enabledKinds,
    includeMentions,
    showOrphans,
    colorMode,
    nodeSizeScale,
  } = input

  const isKindActive = (kind: GraphEntityKind) =>
    scope === 'characters' ? kind === 'character' : enabledKinds.has(kind)

  const getColor = (kind: GraphEntityKind) =>
    colorMode === 'monochrome' ? CATEGORY_MAP[kind].monochromeColor : CATEGORY_MAP[kind].color

  interface DraftNode {
    id: string
    entityId: string
    kind: GraphEntityKind
    title: string
    color: string
    imageUrl?: string
    searchableText: string
  }

  const nodeMap = new Map<string, DraftNode>()

  const addDraft = (
    kind: GraphEntityKind,
    entityId: string,
    title: string,
    searchableText: string,
    imageUrl?: string
  ) => {
    if (!isKindActive(kind)) return
    const id = nodeKey(kind, entityId)
    nodeMap.set(id, {
      id,
      entityId,
      kind,
      title: title || 'Untitled',
      color: getColor(kind),
      imageUrl,
      searchableText,
    })
  }

  for (const c of entities.characters) {
    const text = [
      c.nickname,
      c.appearance,
      c.personality,
      c.goals,
      c.relationships,
      c.notes,
    ]
      .filter(Boolean)
      .join(' ')
    addDraft('character', c.id, c.name, text, c.image_url)
  }

  if (scope === 'story') {
    for (const ch of entities.chapters) {
      addDraft('chapter', ch.id, ch.title, stripHtml(ch.content || ''))
    }
    for (const loc of entities.locations) {
      const text = [loc.description, loc.culture, loc.history, loc.notes].filter(Boolean).join(' ')
      addDraft('location', loc.id, loc.name, text, loc.image_url)
    }
    for (const org of entities.organizations) {
      addDraft('organization', org.id, org.title, stripHtml(org.content || ''))
    }
    for (const wr of entities.worldRules) {
      addDraft('world_rule', wr.id, wr.title, stripHtml(wr.content || ''))
    }
    for (const cdx of entities.codex) {
      addDraft('codex', cdx.id, cdx.title, stripHtml(cdx.content || ''))
    }
    for (const wk of entities.wiki) {
      addDraft('wiki', wk.id, wk.title, stripHtml(wk.content || ''))
    }
    for (const nt of entities.notes) {
      addDraft('note', nt.id, nt.title, stripHtml(nt.content || ''))
    }
  }

  const edges: GraphEdge[] = []
  const explicitPairs = new Set<string>()
  const mentionPairs = new Set<string>()

  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  // 1. Explicit character relationships
  for (const rel of relationships) {
    const src = nodeKey('character', rel.source_character_id)
    const tgt = nodeKey('character', rel.target_character_id)
    if (!nodeMap.has(src) || !nodeMap.has(tgt) || src === tgt) continue
    explicitPairs.add(pairKey(src, tgt))
    edges.push({
      id: `rel:${rel.id}`,
      source: src,
      target: tgt,
      kind: 'relationship',
      color: getRelColor(rel.relationship_type),
      label: rel.relationship_type,
      weight: 2.2,
      relationship: rel,
    })
  }

  // 2. Explicit ReferencePage links & organization members
  for (const ref of referenceLinks) {
    if (!nodeMap.has(ref.sourceNodeId) || !nodeMap.has(ref.targetNodeId)) continue
    if (ref.sourceNodeId === ref.targetNodeId) continue
    const pk = pairKey(ref.sourceNodeId, ref.targetNodeId)
    if (explicitPairs.has(pk)) continue
    explicitPairs.add(pk)
    edges.push({
      id: `ref:${ref.sourceNodeId}->${ref.targetNodeId}`,
      source: ref.sourceNodeId,
      target: ref.targetNodeId,
      kind: 'reference',
      color: '#94a3b8',
      label: ref.role || undefined,
      weight: 1.5,
    })
  }

  // 3. Auto-detected cross-entity mentions
  if (includeMentions && nodeMap.size > 1) {
    const firstNameCounts = new Map<string, number>()
    for (const c of entities.characters) {
      const first = (c.name || '').trim().split(/\s+/)[0] || ''
      if (first.length >= 3) {
        const lower = first.toLowerCase()
        firstNameCounts.set(lower, (firstNameCounts.get(lower) || 0) + 1)
      }
    }

    const searchSpecs: SearchTermSpec[] = []
    for (const node of nodeMap.values()) {
      if (node.kind === 'chapter') continue
      const cleanTitle = node.title.trim()
      const lowerTitle = cleanTitle.toLowerCase()
      if (cleanTitle.length < 3 || GENERIC_SKIP_TITLES.has(lowerTitle)) continue

      const fullTitleRegex = new RegExp(`\\b${escapeRegex(cleanTitle)}\\b`, 'i')
      let firstNameRegex: RegExp | null = null

      if (node.kind === 'character') {
        const first = cleanTitle.split(/\s+/)[0] || ''
        if (
          first.length >= 3 &&
          first.toLowerCase() !== lowerTitle &&
          !GENERIC_SKIP_TITLES.has(first.toLowerCase()) &&
          (firstNameCounts.get(first.toLowerCase()) || 0) === 1
        ) {
          // Case-sensitive for first name to avoid false matches (e.g. "red" vs "Red")
          firstNameRegex = new RegExp(`\\b${escapeRegex(first)}\\b`)
        }
      }

      searchSpecs.push({
        targetNodeId: node.id,
        fullTitleRegex,
        firstNameRegex,
      })
    }

    for (const srcNode of nodeMap.values()) {
      if (!srcNode.searchableText) continue
      for (const spec of searchSpecs) {
        if (spec.targetNodeId === srcNode.id) continue
        const pk = pairKey(srcNode.id, spec.targetNodeId)
        if (explicitPairs.has(pk) || mentionPairs.has(pk)) continue

        const matched =
          (spec.fullTitleRegex && spec.fullTitleRegex.test(srcNode.searchableText)) ||
          (spec.firstNameRegex && spec.firstNameRegex.test(srcNode.searchableText))

        if (matched) {
          mentionPairs.add(pk)
          edges.push({
            id: `mention:${pk}`,
            source: srcNode.id,
            target: spec.targetNodeId,
            kind: 'mention',
            color: '#64748b',
            weight: 1.0,
          })
        }
      }
    }
  }

  // Calculate degrees
  const degrees = new Map<string, number>()
  for (const edge of edges) {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1)
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1)
  }

  const finalNodes: Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy' | 'fx' | 'fy' | 'highlightAlpha'>[] = []
  const keptIds = new Set<string>()

  for (const node of nodeMap.values()) {
    const degree = degrees.get(node.id) || 0
    if (!showOrphans && degree === 0) continue
    keptIds.add(node.id)
    finalNodes.push({
      id: node.id,
      entityId: node.entityId,
      kind: node.kind,
      title: node.title,
      color: node.color,
      imageUrl: node.imageUrl,
      degree,
      radius: computeNodeRadius(degree, nodeSizeScale),
    })
  }

  const finalEdges = edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target))
  return { nodes: finalNodes, edges: finalEdges }
}

export class ForceGraphSimulation {
  nodes: GraphNode[] = []
  nodeMap: Map<string, GraphNode> = new Map()
  edges: GraphEdge[] = []
  alpha = 1

  syncGraph(
    nextNodes: Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy' | 'fx' | 'fy' | 'highlightAlpha'>[],
    nextEdges: GraphEdge[]
  ): void {
    const prevMap = this.nodeMap
    const merged: GraphNode[] = []
    const nextMap = new Map<string, GraphNode>()

    const hasStructureChanged =
      nextNodes.length !== this.nodes.length ||
      nextEdges.length !== this.edges.length ||
      nextNodes.some((n) => !prevMap.has(n.id))

    for (let i = 0; i < nextNodes.length; i++) {
      const spec = nextNodes[i]
      const prev = prevMap.get(spec.id)
      const angle = i * 2.399963229728653
      const spiralR = nextNodes.length <= 1 ? 0 : 34 * Math.sqrt(i + 1)
      const node: GraphNode = prev
        ? {
            ...spec,
            x: prev.x,
            y: prev.y,
            vx: prev.vx,
            vy: prev.vy,
            fx: prev.fx,
            fy: prev.fy,
            highlightAlpha: prev.highlightAlpha,
          }
        : {
            ...spec,
            x: Math.cos(angle) * spiralR,
            y: Math.sin(angle) * spiralR,
            vx: 0,
            vy: 0,
            fx: null,
            fy: null,
            highlightAlpha: 1,
          }
      merged.push(node)
      nextMap.set(node.id, node)
    }

    this.nodes = merged
    this.nodeMap = nextMap
    this.edges = nextEdges

    if (hasStructureChanged) {
      this.alpha = Math.max(this.alpha, 0.85)
    }
  }

  reheat(targetAlpha = 0.85): void {
    this.alpha = Math.max(this.alpha, targetAlpha)
  }

  step(params: ForceParams): boolean {
    const hasPinned = this.nodes.some((n) => n.fx !== null && n.fy !== null)
    if (this.alpha < 0.002 && !hasPinned) {
      return false
    }

    const activeAlpha = hasPinned ? Math.max(this.alpha, 0.25) : this.alpha
    const count = this.nodes.length

    // 1. Center gravity
    const gravity = params.centerForce * 0.08 * activeAlpha
    for (let i = 0; i < count; i++) {
      const n = this.nodes[i]
      n.vx -= n.x * gravity
      n.vy -= n.y * gravity
    }

    // 2. Pairwise charge repulsion & soft collision separation
    const repelStrength = params.repelForce * 1.45 * activeAlpha
    for (let i = 0; i < count; i++) {
      const a = this.nodes[i]
      for (let j = i + 1; j < count; j++) {
        const b = this.nodes[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        if (dx === 0 && dy === 0) {
          dx = 0.01 * ((i % 3) - 1 || 1)
          dy = 0.01 * ((j % 3) - 1 || -1)
        }
        const distSq = dx * dx + dy * dy + 24
        const dist = Math.sqrt(distSq)
        const nx = dx / dist
        const ny = dy / dist

        let force = repelStrength / distSq
        const minDist = a.radius + b.radius + 18
        if (dist < minDist) {
          force += (minDist - dist) * 0.14 * activeAlpha
        }

        const fx = nx * force
        const fy = ny * force
        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }

    // 3. Spring attraction along edges
    const baseSpring = params.linkForce * 0.075 * activeAlpha
    for (let i = 0; i < this.edges.length; i++) {
      const edge = this.edges[i]
      const src = this.nodeMap.get(edge.source)
      const tgt = this.nodeMap.get(edge.target)
      if (!src || !tgt) continue

      const dx = tgt.x - src.x
      const dy = tgt.y - src.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const targetDist = Math.max(
        35,
        params.linkDistance + (src.radius + tgt.radius) * 0.85
      )
      const displacement = dist - targetDist
      const k = baseSpring * (0.65 + edge.weight * 0.25)
      const fx = (dx / dist) * displacement * k
      const fy = (dy / dist) * displacement * k

      src.vx += fx
      src.vy += fy
      tgt.vx -= fx
      tgt.vy -= fy
    }

    // 4. Integrate with damping & pin constraints
    const damping = 0.82
    const maxVel = 30
    for (let i = 0; i < count; i++) {
      const n = this.nodes[i]
      if (n.fx !== null && n.fy !== null) {
        n.x = n.fx
        n.y = n.fy
        n.vx = 0
        n.vy = 0
        continue
      }
      n.vx = Math.max(-maxVel, Math.min(maxVel, n.vx * damping))
      n.vy = Math.max(-maxVel, Math.min(maxVel, n.vy * damping))
      n.x += n.vx
      n.y += n.vy
    }

    this.alpha = hasPinned ? Math.max(0.25, this.alpha * 0.99) : this.alpha * 0.985
    if (this.alpha < 0.002 && !hasPinned) {
      this.alpha = 0
    }
    return true
  }

  findNodeAt(worldX: number, worldY: number, zoom: number): GraphNode | null {
    const pad = Math.max(4, 6 / zoom)
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i]
      const dx = worldX - n.x
      const dy = worldY - n.y
      const hitR = n.radius + pad
      if (dx * dx + dy * dy <= hitR * hitR) {
        return n
      }
    }
    return null
  }

  findEdgeAt(worldX: number, worldY: number, zoom: number): GraphEdge | null {
    const maxDist = Math.max(7, 9 / zoom)
    let best: GraphEdge | null = null
    let bestDist = maxDist

    for (const edge of this.edges) {
      // Prefer clickable explicit relationship edges
      if (edge.kind !== 'relationship' && best?.kind === 'relationship') continue
      const src = this.nodeMap.get(edge.source)
      const tgt = this.nodeMap.get(edge.target)
      if (!src || !tgt) continue

      const abx = tgt.x - src.x
      const aby = tgt.y - src.y
      const lenSq = abx * abx + aby * aby
      if (lenSq < 1) continue

      const t = Math.max(0, Math.min(1, ((worldX - src.x) * abx + (worldY - src.y) * aby) / lenSq))
      const cx = src.x + t * abx
      const cy = src.y + t * aby
      const d = Math.hypot(worldX - cx, worldY - cy)

      if (d <= bestDist) {
        bestDist = d
        best = edge
      }
    }
    return best
  }

  getBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    if (this.nodes.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of this.nodes) {
      const r = n.radius + 26
      if (n.x - r < minX) minX = n.x - r
      if (n.y - r < minY) minY = n.y - r
      if (n.x + r > maxX) maxX = n.x + r
      if (n.y + r > maxY) maxY = n.y + r
    }
    return { minX, minY, maxX, maxY }
  }
}
