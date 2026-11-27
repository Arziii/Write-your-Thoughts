import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ExternalLink,
  Link2,
  Maximize2,
  Minus,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { Button, Select, Switch, Textarea } from '../ui/primitives'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import type { Relationship } from '../../types'
import type { ReferenceDetails, ReferenceKind } from '../../../../shared/referencePages'
import {
  CATEGORY_MAP,
  DEFAULT_FORCE_PARAMS,
  ForceGraphSimulation,
  GRAPH_CATEGORIES,
  REL_TYPES,
  buildStoryGraphData,
  getRelColor,
  type ForceParams,
  type GraphEdge,
  type GraphEntityKind,
  type GraphNode,
  type RawReferenceEdge,
} from './storyGraphEngine'

const PREFS_STORAGE_KEY = 'wyt-story-graph-prefs'

interface GraphPrefs {
  scope: 'story' | 'characters'
  themeMode: 'obsidian' | 'studio'
  colorMode: 'category' | 'monochrome'
  includeMentions: boolean
  showOrphans: boolean
  showArrows: boolean
  showEdgeLabels: boolean
  textFadeZoom: number
  enabledKinds: GraphEntityKind[]
  forces: ForceParams
}

const DEFAULT_PREFS: GraphPrefs = {
  scope: 'story',
  themeMode: 'obsidian',
  colorMode: 'category',
  includeMentions: true,
  showOrphans: true,
  showArrows: true,
  showEdgeLabels: true,
  textFadeZoom: 0.65,
  enabledKinds: GRAPH_CATEGORIES.map((c) => c.kind),
  forces: { ...DEFAULT_FORCE_PARAMS },
}

function loadGraphPrefs(): GraphPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<GraphPrefs>
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      enabledKinds: Array.isArray(parsed.enabledKinds) && parsed.enabledKinds.length > 0
        ? parsed.enabledKinds
        : DEFAULT_PREFS.enabledKinds,
      forces: {
        ...DEFAULT_FORCE_PARAMS,
        ...(parsed.forces || {}),
      },
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export default function RelationshipGraphView() {
  const {
    currentBook,
    chapters,
    characters,
    locations,
    organizations,
    worldRules,
    codex,
    wiki,
    notes,
    openTab,
  } = useWorkspaceStore()
  const { addToast } = useToastStore()

  const [prefs, setPrefs] = useState<GraphPrefs>(() => loadGraphPrefs())
  const [displayOpen, setDisplayOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [connectMode, setConnectMode] = useState(false)
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null)

  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [referenceLinks, setReferenceLinks] = useState<RawReferenceEdge[]>([])
  const [loading, setLoading] = useState(true)

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [zoomDisplay, setZoomDisplay] = useState(100)

  const [editModal, setEditModal] = useState<{
    rel: Relationship | null
    isNew: boolean
    sourceId: string
    targetId: string
    type: string
    history: string
    currentState: string
  } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<ForceGraphSimulation>(new ForceGraphSimulation())
  const cameraRef = useRef({ panX: 0, panY: 0, zoom: 1 })
  const sizeRef = useRef({ w: 900, h: 600, dpr: 1 })

  // Keep interactive state mirrored in refs for 60fps Canvas loop
  const interactionRef = useRef<{
    hoveredNodeId: string | null
    hoveredEdgeId: string | null
    selectedNodeId: string | null
    connectSourceId: string | null
    searchLower: string
    prefs: GraphPrefs
  }>({
    hoveredNodeId: null,
    hoveredEdgeId: null,
    selectedNodeId: null,
    connectSourceId: null,
    searchLower: '',
    prefs,
  })

  interactionRef.current = {
    hoveredNodeId,
    hoveredEdgeId,
    selectedNodeId,
    connectSourceId,
    searchLower: searchQuery.trim().toLowerCase(),
    prefs,
  }

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs])

  // Load relationships + ReferencePage explicit links/members
  const loadGraphConnections = useCallback(async () => {
    if (!currentBook?.id) return
    setLoading(true)
    try {
      const rels = (await window.api.relationships.getByBook(currentBook.id)) as Relationship[]
      setRelationships(Array.isArray(rels) ? rels : [])

      if (!window.api.isMock) {
        const refItems: Array<{ kind: ReferenceKind; id: string }> = [
          ...organizations.map((o) => ({ kind: 'organization' as const, id: o.id })),
          ...worldRules.map((w) => ({ kind: 'world_rule' as const, id: w.id })),
          ...codex.map((c) => ({ kind: 'codex' as const, id: c.id })),
          ...wiki.map((w) => ({ kind: 'wiki' as const, id: w.id })),
          ...notes.map((n) => ({ kind: 'note' as const, id: n.id })),
        ]

        const loadedDetails = await Promise.all(
          refItems.map(async (item) => {
            try {
              const details = (await window.api.referencePages.load(item)) as ReferenceDetails
              return { item, details }
            } catch {
              return null
            }
          })
        )

        const rawEdges: RawReferenceEdge[] = []
        for (const entry of loadedDetails) {
          if (!entry?.details) continue
          const sourceNodeId = `${entry.item.kind}:${entry.item.id}`

          if (Array.isArray(entry.details.links)) {
            for (const link of entry.details.links) {
              if (link?.id && link?.type) {
                rawEdges.push({
                  sourceNodeId,
                  targetNodeId: `${link.type}:${link.id}`,
                  role: link.role,
                })
              }
            }
          }

          if (entry.item.kind === 'organization' && Array.isArray(entry.details.members)) {
            for (const member of entry.details.members) {
              if (member?.characterId) {
                rawEdges.push({
                  sourceNodeId,
                  targetNodeId: `character:${member.characterId}`,
                  role: member.rank || 'Member',
                })
              }
            }
          }
        }
        setReferenceLinks(rawEdges)
      } else {
        setReferenceLinks([])
      }
    } catch (err) {
      console.error('Failed to load story graph:', err)
    } finally {
      setLoading(false)
    }
  }, [currentBook?.id, organizations, worldRules, codex, wiki, notes])

  useEffect(() => {
    void loadGraphConnections()
  }, [loadGraphConnections])

  const enabledKindsSet = useMemo(() => new Set(prefs.enabledKinds), [prefs.enabledKinds])

  const graphData = useMemo(
    () =>
      buildStoryGraphData({
        scope: prefs.scope,
        entities: {
          chapters,
          characters,
          locations,
          organizations,
          worldRules,
          codex,
          wiki,
          notes,
        },
        relationships,
        referenceLinks,
        enabledKinds: enabledKindsSet,
        includeMentions: prefs.includeMentions,
        showOrphans: prefs.showOrphans,
        colorMode: prefs.colorMode,
        nodeSizeScale: prefs.forces.nodeSizeScale,
      }),
    [
      prefs.scope,
      prefs.includeMentions,
      prefs.showOrphans,
      prefs.colorMode,
      prefs.forces.nodeSizeScale,
      enabledKindsSet,
      chapters,
      characters,
      locations,
      organizations,
      worldRules,
      codex,
      wiki,
      notes,
      relationships,
      referenceLinks,
    ]
  )

  // Fit view helper
  const fitView = useCallback(() => {
    const sim = simRef.current
    const bounds = sim.getBounds()
    const { w, h } = sizeRef.current
    if (!bounds || w < 40 || h < 40) {
      cameraRef.current = { panX: 0, panY: 0, zoom: 1 }
      setZoomDisplay(100)
      return
    }
    const bw = Math.max(80, bounds.maxX - bounds.minX)
    const bh = Math.max(80, bounds.maxY - bounds.minY)
    const pad = 90
    const nextZoom = Math.max(
      0.22,
      Math.min(1.65, Math.min((w - pad) / bw, (h - pad) / bh))
    )
    const cx = (bounds.minX + bounds.maxX) / 2
    const cy = (bounds.minY + bounds.maxY) / 2
    cameraRef.current = {
      panX: -cx * nextZoom,
      panY: -cy * nextZoom,
      zoom: nextZoom,
    }
    setZoomDisplay(Math.round(nextZoom * 100))
  }, [])

  const didInitialFitRef = useRef(false)
  useEffect(() => {
    simRef.current.syncGraph(graphData.nodes, graphData.edges)
    if (selectedNodeId && !simRef.current.nodeMap.has(selectedNodeId)) {
      setSelectedNodeId(null)
    }
    if (!didInitialFitRef.current && graphData.nodes.length > 0) {
      didInitialFitRef.current = true
      const timer = setTimeout(() => fitView(), 420)
      return () => clearTimeout(timer)
    }
  }, [graphData, fitView, selectedNodeId])

  useEffect(() => {
    didInitialFitRef.current = false
  }, [currentBook?.id])

  // ResizeObserver for HiDPI Canvas sizing
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(100, Math.round(rect.width))
      const h = Math.max(100, Math.round(rect.height))
      sizeRef.current = { w, h, dpr }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }

    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // 60 FPS Simulation + Canvas 2D Render Loop
  useEffect(() => {
    let rafId = 0

    const renderFrame = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const { w, h, dpr } = sizeRef.current
          const cam = cameraRef.current
          const sim = simRef.current
          const {
            hoveredNodeId: hovId,
            hoveredEdgeId: hovEdgeId,
            selectedNodeId: selId,
            connectSourceId: connId,
            searchLower,
            prefs: curPrefs,
          } = interactionRef.current

          sim.step(curPrefs.forces)

          const isDarkCanvas = curPrefs.themeMode === 'obsidian'
          const focusId = hovId || selId

          // Determine spotlighted neighborhood nodes & edges
          const focusNeighbors = new Set<string>()
          const focusEdges = new Set<string>()
          if (focusId) {
            focusNeighbors.add(focusId)
            for (const edge of sim.edges) {
              if (edge.source === focusId || edge.target === focusId) {
                focusEdges.add(edge.id)
                focusNeighbors.add(edge.source)
                focusNeighbors.add(edge.target)
              }
            }
          }

          const hasSearch = searchLower.length > 0
          const searchMatches = new Set<string>()
          if (hasSearch) {
            for (const n of sim.nodes) {
              if (n.title.toLowerCase().includes(searchLower)) {
                searchMatches.add(n.id)
              }
            }
          }

          ctx.save()
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

          // Backdrop
          if (isDarkCanvas) {
            ctx.fillStyle = '#131417'
            ctx.fillRect(0, 0, w, h)
          } else {
            ctx.fillStyle = '#f6f3ec'
            ctx.fillRect(0, 0, w, h)
          }

          ctx.translate(w / 2 + cam.panX, h / 2 + cam.panY)
          ctx.scale(cam.zoom, cam.zoom)

          // Update smooth node highlight interpolation
          for (const n of sim.nodes) {
            let target = 1
            if (focusId) {
              target = focusNeighbors.has(n.id) ? 1 : 0.14
            } else if (hasSearch) {
              target = searchMatches.has(n.id) ? 1 : 0.16
            }
            n.highlightAlpha += (target - n.highlightAlpha) * 0.22
          }

          // ── Draw Edges ──
          for (const edge of sim.edges) {
            const src = sim.nodeMap.get(edge.source)
            const tgt = sim.nodeMap.get(edge.target)
            if (!src || !tgt) continue

            const isEdgeHovered = edge.id === hovEdgeId
            const isSpotlighted = focusId
              ? focusEdges.has(edge.id) || isEdgeHovered
              : hasSearch
                ? searchMatches.has(edge.source) && searchMatches.has(edge.target)
                : true

            let alpha: number
            if (!isSpotlighted) {
              alpha = isDarkCanvas ? 0.06 : 0.09
            } else if (isEdgeHovered || (focusId && focusEdges.has(edge.id))) {
              alpha = edge.kind === 'relationship' ? 0.95 : 0.72
            } else if (edge.kind === 'relationship') {
              alpha = isDarkCanvas ? 0.65 : 0.72
            } else if (edge.kind === 'reference') {
              alpha = isDarkCanvas ? 0.34 : 0.38
            } else {
              alpha = isDarkCanvas ? 0.22 : 0.22
            }

            ctx.save()
            ctx.globalAlpha = alpha
            ctx.strokeStyle =
              edge.kind === 'relationship'
                ? edge.color
                : isSpotlighted && (focusId || isEdgeHovered)
                  ? '#a78bfa'
                  : isDarkCanvas
                    ? '#717684'
                    : '#78716c'

            const baseWidth =
              edge.kind === 'relationship' ? 1.7 : edge.kind === 'reference' ? 1.25 : 0.95
            ctx.lineWidth = (isEdgeHovered ? baseWidth + 1.2 : baseWidth) / Math.max(0.55, Math.sqrt(cam.zoom))

            const dx = tgt.x - src.x
            const dy = tgt.y - src.y
            const dist = Math.hypot(dx, dy) || 1
            const ux = dx / dist
            const uy = dy / dist
            const sx = src.x + ux * (src.radius + 1.5)
            const sy = src.y + uy * (src.radius + 1.5)
            const ex = tgt.x - ux * (tgt.radius + 2.5)
            const ey = tgt.y - uy * (tgt.radius + 2.5)

            if (dist > src.radius + tgt.radius + 4) {
              ctx.beginPath()
              ctx.moveTo(sx, sy)
              ctx.lineTo(ex, ey)
              ctx.stroke()

              // Directional arrowheads
              const drawArrow =
                curPrefs.showArrows &&
                (edge.kind === 'relationship' || edge.kind === 'reference' || isEdgeHovered)
              if (drawArrow && dist > 26) {
                const headLen = 7 / Math.max(0.65, Math.sqrt(cam.zoom))
                const angle = Math.atan2(uy, ux)
                ctx.fillStyle = ctx.strokeStyle
                ctx.beginPath()
                ctx.moveTo(ex, ey)
                ctx.lineTo(
                  ex - headLen * Math.cos(angle - Math.PI / 7),
                  ey - headLen * Math.sin(angle - Math.PI / 7)
                )
                ctx.lineTo(
                  ex - headLen * Math.cos(angle + Math.PI / 7),
                  ey - headLen * Math.sin(angle + Math.PI / 7)
                )
                ctx.closePath()
                ctx.fill()
              }

              // Edge label pill for explicit relationships or hovered reference edges
              if (
                edge.label &&
                ((curPrefs.showEdgeLabels && edge.kind === 'relationship' && cam.zoom >= 0.48) ||
                  isEdgeHovered ||
                  (focusId && focusEdges.has(edge.id) && edge.kind !== 'mention'))
              ) {
                const mx = (sx + ex) / 2
                const my = (sy + ey) / 2
                const labelFont = Math.max(8.5, 10 / Math.max(0.75, Math.sqrt(cam.zoom)))
                ctx.font = `600 ${labelFont}px "DM Sans", sans-serif`
                const textW = ctx.measureText(edge.label).width
                const pillW = textW + 12
                const pillH = labelFont + 7

                ctx.fillStyle = isDarkCanvas ? 'rgba(19, 20, 23, 0.92)' : 'rgba(252, 249, 242, 0.94)'
                ctx.strokeStyle = edge.color
                ctx.lineWidth = 1 / Math.max(0.7, Math.sqrt(cam.zoom))
                ctx.beginPath()
                ctx.roundRect(mx - pillW / 2, my - pillH / 2, pillW, pillH, pillH / 2)
                ctx.fill()
                ctx.stroke()

                ctx.fillStyle = edge.kind === 'relationship'
                  ? edge.color
                  : isDarkCanvas
                    ? '#e2e8f0'
                    : '#334155'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText(edge.label, mx, my + 0.5)
              }
            }
            ctx.restore()
          }

          // ── Draw Nodes ──
          for (const n of sim.nodes) {
            const isHovered = n.id === hovId
            const isSelected = n.id === selId
            const isConnectSrc = n.id === connId
            const isSearchHit = hasSearch && searchMatches.has(n.id)

            ctx.save()
            ctx.globalAlpha = n.highlightAlpha

            // Active glow ring
            if (isHovered || isSelected || isConnectSrc || isSearchHit) {
              ctx.beginPath()
              ctx.arc(n.x, n.y, n.radius + 5 / Math.sqrt(cam.zoom), 0, Math.PI * 2)
              ctx.fillStyle = isConnectSrc
                ? 'rgba(56, 189, 248, 0.25)'
                : isHovered
                  ? 'rgba(167, 139, 250, 0.28)'
                  : 'rgba(148, 163, 184, 0.22)'
              ctx.fill()
            }

            // Main node circle (Obsidian style dot)
            ctx.beginPath()
            ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
            ctx.fillStyle = isHovered
              ? '#a78bfa'
              : isConnectSrc
                ? '#38bdf8'
                : n.color
            ctx.fill()

            ctx.lineWidth = (isHovered || isSelected ? 2 : 1) / Math.max(0.65, Math.sqrt(cam.zoom))
            ctx.strokeStyle =
              isHovered || isSelected || isConnectSrc
                ? '#ffffff'
                : isDarkCanvas
                  ? 'rgba(19, 20, 23, 0.7)'
                  : 'rgba(255, 255, 255, 0.85)'
            ctx.stroke()
            ctx.restore()
          }

          // ── Draw Labels (Obsidian zoom-fade + hub emphasis) ──
          const baseFontSize = Math.max(8.5, Math.min(13.5, 11.5 / Math.pow(cam.zoom, 0.45)))
          ctx.font = `500 ${baseFontSize}px "DM Sans", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'

          for (const n of sim.nodes) {
            const isFocused =
              n.id === hovId ||
              n.id === selId ||
              n.id === connId ||
              (hovId !== null && focusNeighbors.has(n.id)) ||
              (selId !== null && focusNeighbors.has(n.id)) ||
              (hasSearch && searchMatches.has(n.id))

            // Major hubs remain softly readable slightly earlier than leaf nodes
            const hubBoost = Math.min(0.28, n.degree * 0.032)
            const zoomLabelAlpha = Math.max(
              0,
              Math.min(1, (cam.zoom + hubBoost - curPrefs.textFadeZoom) * 2.1)
            )

            const finalLabelAlpha = isFocused
              ? 1
              : (hovId || selId || hasSearch)
                ? Math.min(n.highlightAlpha, zoomLabelAlpha) * 0.4
                : zoomLabelAlpha

            if (finalLabelAlpha <= 0.04) continue

            const labelText = n.title.length > 34 ? `${n.title.slice(0, 32).trimEnd()}…` : n.title
            const labelY = n.y + n.radius + 5 / Math.pow(cam.zoom, 0.35)

            ctx.save()
            ctx.globalAlpha = finalLabelAlpha
            if (isFocused) {
              ctx.font = `600 ${baseFontSize}px "DM Sans", sans-serif`
            } else {
              ctx.font = `500 ${baseFontSize}px "DM Sans", sans-serif`
            }
            // Subtle legibility halo behind text
            ctx.lineWidth = 3 / Math.pow(cam.zoom, 0.45)
            ctx.strokeStyle = isDarkCanvas ? 'rgba(19, 20, 23, 0.86)' : 'rgba(246, 243, 236, 0.9)'
            ctx.strokeText(labelText, n.x, labelY)
            ctx.fillStyle = isFocused
              ? (isDarkCanvas ? '#ffffff' : '#111827')
              : (isDarkCanvas ? '#cfd3dc' : '#292524')
            ctx.fillText(labelText, n.x, labelY)
            ctx.restore()
          }

          ctx.restore()
        }
      }

      rafId = requestAnimationFrame(renderFrame)
    }

    rafId = requestAnimationFrame(renderFrame)
    return () => cancelAnimationFrame(rafId)
  }, [])

  // Coordinate conversions
  const screenToWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const cam = cameraRef.current
    return {
      x: (clientX - rect.left - rect.width / 2 - cam.panX) / cam.zoom,
      y: (clientY - rect.top - rect.height / 2 - cam.panY) / cam.zoom,
    }
  }

  // Interactive Pointer Handlers
  const pointerStateRef = useRef<{
    mode: 'none' | 'node' | 'pan'
    nodeId?: string
    startClientX: number
    startClientY: number
    startPanX: number
    startPanY: number
    moved: boolean
  }>({
    mode: 'none',
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
    moved: false,
  })

  const [cursorStyle, setCursorStyle] = useState<'grab' | 'grabbing' | 'pointer'>('grab')

  const openAddRelationshipModal = (sourceId: string, targetId = '') => {
    setEditModal({
      rel: null,
      isNew: true,
      sourceId,
      targetId,
      type: 'Friend',
      history: '',
      currentState: '',
    })
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    const world = screenToWorld(e.clientX, e.clientY)
    const hitNode = simRef.current.findNodeAt(world.x, world.y, cameraRef.current.zoom)

    if (hitNode && e.button === 0) {
      hitNode.fx = hitNode.x
      hitNode.fy = hitNode.y
      simRef.current.reheat(0.45)
      pointerStateRef.current = {
        mode: 'node',
        nodeId: hitNode.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: cameraRef.current.panX,
        startPanY: cameraRef.current.panY,
        moved: false,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
      setCursorStyle('grabbing')
      return
    }

    pointerStateRef.current = {
      mode: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: cameraRef.current.panX,
      startPanY: cameraRef.current.panY,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setCursorStyle('grabbing')
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ps = pointerStateRef.current
    const world = screenToWorld(e.clientX, e.clientY)

    if (ps.mode === 'node' && ps.nodeId) {
      const dist = Math.hypot(e.clientX - ps.startClientX, e.clientY - ps.startClientY)
      if (dist > 4) ps.moved = true
      const node = simRef.current.nodeMap.get(ps.nodeId)
      if (node) {
        node.fx = world.x
        node.fy = world.y
        node.x = world.x
        node.y = world.y
        simRef.current.alpha = Math.max(simRef.current.alpha, 0.35)
      }
      return
    }

    if (ps.mode === 'pan') {
      const dx = e.clientX - ps.startClientX
      const dy = e.clientY - ps.startClientY
      if (Math.hypot(dx, dy) > 4) ps.moved = true
      cameraRef.current.panX = ps.startPanX + dx
      cameraRef.current.panY = ps.startPanY + dy
      return
    }

    // Idle hover hit-testing
    const hitNode = simRef.current.findNodeAt(world.x, world.y, cameraRef.current.zoom)
    if (hitNode) {
      if (hoveredNodeId !== hitNode.id) setHoveredNodeId(hitNode.id)
      if (hoveredEdgeId !== null) setHoveredEdgeId(null)
      setCursorStyle('pointer')
      return
    }
    if (hoveredNodeId !== null) setHoveredNodeId(null)

    const hitEdge = simRef.current.findEdgeAt(world.x, world.y, cameraRef.current.zoom)
    if (hitEdge) {
      if (hoveredEdgeId !== hitEdge.id) setHoveredEdgeId(hitEdge.id)
      setCursorStyle(hitEdge.kind === 'relationship' ? 'pointer' : 'grab')
    } else {
      if (hoveredEdgeId !== null) setHoveredEdgeId(null)
      setCursorStyle('grab')
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ps = pointerStateRef.current
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    if (ps.mode === 'node' && ps.nodeId) {
      const node = simRef.current.nodeMap.get(ps.nodeId)
      if (node) {
        node.fx = null
        node.fy = null
      }
      if (!ps.moved && node) {
        handleNodeClick(node)
      }
    } else if (ps.mode === 'pan' && !ps.moved) {
      const world = screenToWorld(e.clientX, e.clientY)
      const hitEdge = simRef.current.findEdgeAt(world.x, world.y, cameraRef.current.zoom)
      if (hitEdge?.kind === 'relationship' && hitEdge.relationship) {
        const rel = hitEdge.relationship
        setEditModal({
          rel,
          isNew: false,
          sourceId: rel.source_character_id,
          targetId: rel.target_character_id,
          type: rel.relationship_type,
          history: rel.history || '',
          currentState: rel.current_state || '',
        })
      } else {
        setSelectedNodeId(null)
        if (connectSourceId) setConnectSourceId(null)
      }
    }

    pointerStateRef.current = {
      mode: 'none',
      startClientX: 0,
      startClientY: 0,
      startPanX: 0,
      startPanY: 0,
      moved: false,
    }
    setCursorStyle('grab')
  }

  const handleNodeClick = (node: GraphNode) => {
    if (connectMode) {
      if (node.kind !== 'character') {
        addToast('Select Character nodes to create a character relationship.', 'info')
        return
      }
      if (!connectSourceId) {
        setConnectSourceId(node.entityId)
        setSelectedNodeId(node.id)
        return
      }
      if (connectSourceId === node.entityId) {
        setConnectSourceId(null)
        return
      }
      openAddRelationshipModal(connectSourceId, node.entityId)
      setConnectSourceId(null)
      setConnectMode(false)
      return
    }
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
  }

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const world = screenToWorld(e.clientX, e.clientY)
    const hitNode = simRef.current.findNodeAt(world.x, world.y, cameraRef.current.zoom)
    if (hitNode) {
      openTab(hitNode.entityId, hitNode.kind, hitNode.title)
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left - rect.width / 2
    const my = e.clientY - rect.top - rect.height / 2

    const cam = cameraRef.current
    const worldX = (mx - cam.panX) / cam.zoom
    const worldY = (my - cam.panY) / cam.zoom

    const factor = Math.exp(-e.deltaY * 0.0012)
    const nextZoom = Math.max(0.18, Math.min(4.5, cam.zoom * factor))

    cam.zoom = nextZoom
    cam.panX = mx - worldX * nextZoom
    cam.panY = my - worldY * nextZoom
    setZoomDisplay(Math.round(nextZoom * 100))
  }

  const adjustZoom = (factor: number) => {
    const cam = cameraRef.current
    const nextZoom = Math.max(0.18, Math.min(4.5, cam.zoom * factor))
    cam.panX *= nextZoom / cam.zoom
    cam.panY *= nextZoom / cam.zoom
    cam.zoom = nextZoom
    setZoomDisplay(Math.round(nextZoom * 100))
  }

  // ── Save / Delete Relationship CRUD ──
  async function saveEditModal() {
    if (!editModal || !currentBook) return
    try {
      if (editModal.rel) {
        const updated = await window.api.relationships.upsert({
          ...editModal.rel,
          relationship_type: editModal.type,
          history: editModal.history,
          current_state: editModal.currentState,
        })
        setRelationships((prev) =>
          prev.map((r) => (r.id === editModal.rel!.id ? (updated as Relationship) : r))
        )
        addToast('Relationship updated', 'success')
      } else {
        if (!editModal.targetId || editModal.targetId === editModal.sourceId) return
        const created = await window.api.relationships.upsert({
          book_id: currentBook.id,
          source_character_id: editModal.sourceId,
          target_character_id: editModal.targetId,
          relationship_type: editModal.type,
          trust_level: 5,
          affection_level: 5,
          history: editModal.history,
          current_state: editModal.currentState,
        })
        setRelationships((prev) => [...prev, created as Relationship])
        addToast('Relationship created', 'success')
      }
      setEditModal(null)
    } catch (e: any) {
      addToast(e.message || 'Failed to save relationship', 'error')
    }
  }

  async function deleteRelationship() {
    if (!editModal?.rel) return
    try {
      await window.api.relationships.delete(editModal.rel.id)
      setRelationships((prev) => prev.filter((r) => r.id !== editModal.rel!.id))
      addToast('Relationship deleted', 'info')
      setEditModal(null)
    } catch {
      addToast('Failed to delete relationship', 'error')
    }
  }

  const toggleEntityKind = (kind: GraphEntityKind) => {
    setPrefs((prev) => {
      const has = prev.enabledKinds.includes(kind)
      const next = has
        ? prev.enabledKinds.filter((k) => k !== kind)
        : [...prev.enabledKinds, kind]
      return { ...prev, enabledKinds: next.length > 0 ? next : prev.enabledKinds }
    })
  }

  const updateForce = <K extends keyof ForceParams>(key: K, value: number) => {
    simRef.current.reheat(0.75)
    setPrefs((prev) => ({
      ...prev,
      forces: {
        ...prev.forces,
        [key]: value,
      },
    }))
  }

  const selectedNode = useMemo(
    () => (selectedNodeId ? simRef.current.nodeMap.get(selectedNodeId) || null : null),
    [selectedNodeId, graphData]
  )

  const isObsidian = prefs.themeMode === 'obsidian'
  const hudClass = isObsidian
    ? 'border-white/10 bg-[#1a1c22]/90 text-zinc-100 backdrop-blur-md shadow-xl'
    : 'border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))]/95 text-surface-100 backdrop-blur-md shadow-lg'

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col overflow-hidden select-none',
        isObsidian ? 'bg-[#131417]' : 'bg-[#f6f3ec]'
      )}
    >
      {/* Main Canvas */}
      <div ref={containerRef} className="relative flex-1 min-h-0 w-full">
        <canvas
          ref={canvasRef}
          style={{ cursor: cursorStyle, display: 'block' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
        />

        {/* Top Floating Controls Bar */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2">
          {/* Left: Scope + Search */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <div className={cn('inline-flex items-center rounded-lg border p-0.5', hudClass)}>
              {(['story', 'characters'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => {
                    setPrefs((p) => ({ ...p, scope: sc }))
                    setConnectMode(false)
                    setConnectSourceId(null)
                    simRef.current.reheat(0.85)
                  }}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                    prefs.scope === sc
                      ? isObsidian
                        ? 'bg-violet-500/25 text-violet-200'
                        : 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                      : isObsidian
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-surface-400 hover:text-surface-100'
                  )}
                >
                  {sc === 'story' ? 'Story Web' : 'Characters'}
                </button>
              ))}
            </div>

            <div className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1', hudClass)}>
              <Search className="h-3.5 w-3.5 opacity-60" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes…"
                aria-label="Search graph nodes"
                className={cn(
                  'w-36 bg-transparent text-xs focus:outline-none sm:w-44',
                  isObsidian ? 'text-zinc-100 placeholder:text-zinc-500' : 'text-surface-100 placeholder:text-surface-500'
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear graph search"
                  className="rounded p-0.5 opacity-70 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div
              className={cn(
                'hidden rounded-lg border px-2.5 py-1 text-[11px] tabular-nums sm:block',
                hudClass,
                isObsidian ? 'text-zinc-400' : 'text-surface-400'
              )}
            >
              {graphData.nodes.length} nodes · {graphData.edges.length} links
            </div>
          </div>

          {/* Right: Connect + Add Relationship + Theme + Display */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            {connectMode && (
              <div className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-300 backdrop-blur-md">
                {connectSourceId
                  ? 'Click second Character to link…'
                  : 'Click first Character to connect'}
              </div>
            )}

            {characters.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  setConnectMode((m) => !m)
                  setConnectSourceId(null)
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  connectMode
                    ? 'border-sky-400/60 bg-sky-500/20 text-sky-200'
                    : cn(hudClass, isObsidian ? 'hover:bg-white/5' : 'hover:bg-surface-850')
                )}
                title="Click two Character nodes to connect them"
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect
              </button>
            )}

            <button
              type="button"
              disabled={characters.length < 2 || loading}
              onClick={() => openAddRelationshipModal(characters[0].id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--brand-green))] px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Relationship
            </button>

            <button
              type="button"
              onClick={() =>
                setPrefs((p) => ({
                  ...p,
                  themeMode: p.themeMode === 'obsidian' ? 'studio' : 'obsidian',
                }))
              }
              title={isObsidian ? 'Switch to light Studio canvas' : 'Switch to dark Obsidian cosmos'}
              aria-label="Toggle graph theme"
              className={cn('rounded-lg border p-1.5 transition-colors', hudClass)}
            >
              {isObsidian ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setDisplayOpen((o) => !o)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                displayOpen
                  ? isObsidian
                    ? 'border-violet-400/60 bg-violet-500/25 text-violet-100'
                    : 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                  : cn(hudClass, isObsidian ? 'hover:bg-white/5' : 'hover:bg-surface-850')
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Display
            </button>
          </div>
        </div>

        {/* Obsidian-style Display & Forces Popover */}
        {displayOpen && (
          <div
            className={cn(
              'absolute right-3 top-14 z-20 flex max-h-[calc(100%-7.5rem)] w-72 flex-col gap-3 overflow-y-auto rounded-xl border p-3.5 text-xs',
              hudClass
            )}
          >
            <div className="flex items-center justify-between border-b border-current/10 pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                Graph Controls
              </span>
              <button
                type="button"
                onClick={() => {
                  setPrefs(DEFAULT_PREFS)
                  simRef.current.reheat(0.9)
                }}
                className="inline-flex items-center gap-1 text-[11px] opacity-70 hover:opacity-100"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            {/* Filters Section */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                Filters
              </div>

              {prefs.scope === 'story' && (
                <div className="flex flex-wrap gap-1.5">
                  {GRAPH_CATEGORIES.map((cat) => {
                    const active = prefs.enabledKinds.includes(cat.kind)
                    return (
                      <button
                        key={cat.kind}
                        type="button"
                        onClick={() => toggleEntityKind(cat.kind)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-opacity',
                          active
                            ? isObsidian
                              ? 'border-white/20 bg-white/10 text-zinc-100'
                              : 'border-[hsl(var(--studio-edge))] bg-surface-850 text-surface-100'
                            : 'border-current/10 opacity-40'
                        )}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: cat.color }}
                        />
                        {cat.label}
                      </button>
                    )
                  })}
                </div>
              )}

              <label className="flex items-center justify-between gap-2 pt-1">
                <span>Auto-link story mentions</span>
                <Switch
                  checked={prefs.includeMentions}
                  onCheckedChange={(v) => {
                    simRef.current.reheat(0.8)
                    setPrefs((p) => ({ ...p, includeMentions: v }))
                  }}
                />
              </label>

              <label className="flex items-center justify-between gap-2">
                <span>Show isolated nodes (Orphans)</span>
                <Switch
                  checked={prefs.showOrphans}
                  onCheckedChange={(v) => {
                    simRef.current.reheat(0.6)
                    setPrefs((p) => ({ ...p, showOrphans: v }))
                  }}
                />
              </label>
            </div>

            {/* Display Section */}
            <div className="space-y-2 border-t border-current/10 pt-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                Display
              </div>

              <div className="flex items-center justify-between gap-2">
                <span>Node colors</span>
                <div className="inline-flex rounded-md border border-current/15 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, colorMode: 'category' }))}
                    className={cn(
                      'rounded px-2 py-0.5',
                      prefs.colorMode === 'category' && 'bg-violet-500/30 font-semibold'
                    )}
                  >
                    Category
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrefs((p) => ({ ...p, colorMode: 'monochrome' }))}
                    className={cn(
                      'rounded px-2 py-0.5',
                      prefs.colorMode === 'monochrome' && 'bg-violet-500/30 font-semibold'
                    )}
                  >
                    Mono
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between gap-2">
                <span>Directional arrows</span>
                <Switch
                  checked={prefs.showArrows}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, showArrows: v }))}
                />
              </label>

              <label className="flex items-center justify-between gap-2">
                <span>Relationship badges</span>
                <Switch
                  checked={prefs.showEdgeLabels}
                  onCheckedChange={(v) => setPrefs((p) => ({ ...p, showEdgeLabels: v }))}
                />
              </label>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="opacity-80">Text fade threshold</span>
                  <span className="tabular-nums opacity-60">{prefs.textFadeZoom.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={1.45}
                  step={0.05}
                  value={prefs.textFadeZoom}
                  onChange={(e) =>
                    setPrefs((p) => ({ ...p, textFadeZoom: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-violet-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="opacity-80">Node size</span>
                  <span className="tabular-nums opacity-60">
                    {prefs.forces.nodeSizeScale.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.55}
                  max={1.75}
                  step={0.05}
                  value={prefs.forces.nodeSizeScale}
                  onChange={(e) => updateForce('nodeSizeScale', parseFloat(e.target.value))}
                  className="w-full accent-violet-400"
                />
              </div>
            </div>

            {/* Forces Section */}
            <div className="space-y-2 border-t border-current/10 pt-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                Forces
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="opacity-80">Center force</span>
                  <span className="tabular-nums opacity-60">
                    {prefs.forces.centerForce.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.01}
                  max={0.25}
                  step={0.01}
                  value={prefs.forces.centerForce}
                  onChange={(e) => updateForce('centerForce', parseFloat(e.target.value))}
                  className="w-full accent-violet-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="opacity-80">Repel force</span>
                  <span className="tabular-nums opacity-60">{prefs.forces.repelForce}</span>
                </div>
                <input
                  type="range"
                  min={120}
                  max={1200}
                  step={20}
                  value={prefs.forces.repelForce}
                  onChange={(e) => updateForce('repelForce', parseFloat(e.target.value))}
                  className="w-full accent-violet-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="opacity-80">Link force</span>
                  <span className="tabular-nums opacity-60">
                    {prefs.forces.linkForce.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.6}
                  step={0.02}
                  value={prefs.forces.linkForce}
                  onChange={(e) => updateForce('linkForce', parseFloat(e.target.value))}
                  className="w-full accent-violet-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="opacity-80">Link distance</span>
                  <span className="tabular-nums opacity-60">{prefs.forces.linkDistance}px</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={300}
                  step={5}
                  value={prefs.forces.linkDistance}
                  onChange={(e) => updateForce('linkDistance', parseFloat(e.target.value))}
                  className="w-full accent-violet-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom-Left Floating Selection Card */}
        {selectedNode && (
          <div
            className={cn(
              'absolute bottom-3 left-3 z-10 flex max-w-sm items-center gap-3 rounded-xl border px-3.5 py-2.5',
              hudClass
            )}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: selectedNode.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{selectedNode.title}</div>
              <div className="text-[11px] opacity-65">
                {CATEGORY_MAP[selectedNode.kind].label.replace(/s$/, '')} · {selectedNode.degree}{' '}
                {selectedNode.degree === 1 ? 'connection' : 'connections'}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {selectedNode.kind === 'character' && characters.length >= 2 && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => openAddRelationshipModal(selectedNode.entityId)}
                  title="Add character relationship"
                >
                  <Plus className="h-3 w-3" />
                  Rel
                </Button>
              )}
              <Button
                variant="primary"
                size="xs"
                onClick={() => openTab(selectedNode.entityId, selectedNode.kind, selectedNode.title)}
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </Button>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                aria-label="Close selection card"
                className="rounded p-1 opacity-60 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom-Right Legend & Camera HUD */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex flex-wrap items-center justify-end gap-2">
          {/* Compact Category / Relationship Legend */}
          {prefs.scope === 'story' && prefs.colorMode === 'category' ? (
            <div
              className={cn(
                'pointer-events-auto hidden flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1 text-[10px] lg:flex',
                hudClass
              )}
            >
              {GRAPH_CATEGORIES.filter((c) => prefs.enabledKinds.includes(c.kind)).map((c) => (
                <span key={c.kind} className="inline-flex items-center gap-1 opacity-85">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </span>
              ))}
            </div>
          ) : prefs.scope === 'characters' ? (
            <div
              className={cn(
                'pointer-events-auto hidden flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1 text-[10px] lg:flex',
                hudClass
              )}
            >
              {REL_TYPES.slice(0, 6).map((rt) => (
                <span key={rt.label} className="inline-flex items-center gap-1 opacity-85">
                  <span className="h-2 w-2 rounded-full" style={{ background: rt.color }} />
                  {rt.label}
                </span>
              ))}
            </div>
          ) : null}

          <div className={cn('pointer-events-auto inline-flex items-center gap-1 rounded-lg border p-1', hudClass)}>
            <button
              type="button"
              onClick={() => adjustZoom(1 / 1.25)}
              title="Zoom out"
              aria-label="Zoom out"
              className="rounded p-1 opacity-75 hover:bg-white/10 hover:opacity-100"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[40px] text-center text-[11px] font-medium tabular-nums">
              {zoomDisplay}%
            </span>
            <button
              type="button"
              onClick={() => adjustZoom(1.25)}
              title="Zoom in"
              aria-label="Zoom in"
              className="rounded p-1 opacity-75 hover:bg-white/10 hover:opacity-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="mx-0.5 h-3.5 w-px bg-current opacity-15" />
            <button
              type="button"
              onClick={fitView}
              title="Fit all nodes in view"
              aria-label="Fit graph to view"
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] opacity-80 hover:bg-white/10 hover:opacity-100"
            >
              <Maximize2 className="h-3 w-3" />
              Fit
            </button>
            <button
              type="button"
              onClick={() => simRef.current.reheat(1)}
              title="Re-run layout physics"
              aria-label="Reheat graph physics"
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] opacity-80 hover:bg-white/10 hover:opacity-100"
            >
              <RefreshCw className="h-3 w-3" />
              Settle
            </button>
          </div>
        </div>

        {/* Empty State */}
        {!loading && graphData.nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
            <div className={cn('max-w-sm rounded-2xl border p-5', hudClass)}>
              <p className="text-sm font-semibold">Nothing to plot yet</p>
              <p className="mt-1 text-xs opacity-70">
                {prefs.scope === 'characters'
                  ? 'Create characters or enable "Show isolated nodes" / "Auto-link story mentions" under Display.'
                  : 'Add chapters, characters, locations, or lore pages to see your interactive story web.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Relationship Modal */}
      <Modal
        isOpen={Boolean(editModal)}
        onClose={() => setEditModal(null)}
        title={editModal?.isNew ? 'Add Character Relationship' : 'Edit Relationship'}
        size="md"
      >
        {editModal && (
          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-300">
                From Character
              </label>
              <Select
                value={editModal.sourceId}
                disabled={!editModal.isNew}
                onChange={(e) =>
                  setEditModal((m) =>
                    m && {
                      ...m,
                      sourceId: e.target.value,
                      targetId: m.targetId === e.target.value ? '' : m.targetId,
                    }
                  )
                }
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-surface-300">
                To Character
              </label>
              <Select
                value={editModal.targetId}
                disabled={!editModal.isNew}
                onChange={(e) => setEditModal((m) => m && { ...m, targetId: e.target.value })}
              >
                <option value="">Select a character…</option>
                {characters
                  .filter((c) => c.id !== editModal.sourceId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-surface-300">
                Relationship Type
              </label>
              <Select
                value={editModal.type}
                onChange={(e) => setEditModal((m) => m && { ...m, type: e.target.value })}
              >
                {REL_TYPES.map((rt) => (
                  <option key={rt.label} value={rt.label}>
                    {rt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-surface-300">
                Shared History
              </label>
              <Textarea
                rows={2}
                value={editModal.history}
                onChange={(e) => setEditModal((m) => m && { ...m, history: e.target.value })}
                placeholder="How did they meet? Past conflicts?"
                className="resize-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-surface-300">
                Current State
              </label>
              <Textarea
                rows={2}
                value={editModal.currentState}
                onChange={(e) => setEditModal((m) => m && { ...m, currentState: e.target.value })}
                placeholder="Current dynamic…"
                className="resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              {!editModal.isNew && (
                <Button variant="danger" size="md" onClick={deleteRelationship}>
                  Delete
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="secondary" size="md" onClick={() => setEditModal(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={saveEditModal}
                disabled={!editModal.targetId || editModal.sourceId === editModal.targetId}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
