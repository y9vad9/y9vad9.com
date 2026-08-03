'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useThemeStore } from '@store/themeStore'
import type { MentionGraph } from '@core/graph/MentionGraph'
import { hitRadius, pickNodeAt } from '@lib/graph/nodeHitTest'

// react-force-graph-2d ships strict generics that fight our domain types.
// The component is fundamentally a canvas renderer with object accessors —
// loosen the typing at the boundary and keep our domain types clean.
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
}) as unknown as React.ComponentType<Record<string, unknown>>

export interface ForceGraphProps {
  graph: MentionGraph
  /**
   * Slugs to colour as matches. Pass a Set (or undefined) — the set
   * identity is irrelevant to the physics simulation, so updating it on
   * every keystroke does NOT rebuild graph data or reheat forces.
   */
  highlightSlugs?: ReadonlySet<string>
  height?: number | string
  width?: number | string
  repulsion?: number
  linkDistance?: number
  onNodeClickAction?: 'navigate' | ((slug: string) => void)
  /**
   * When `true`, the camera fits all nodes to the viewport once the
   * simulation cools down (and on every subsequent reheat). Used by the
   * side-panel `LocalGraph` — small canvas, small node set, no reason
   * for the user to pan/zoom manually. The full-page `GlobalGraph`
   * leaves this off so the user keeps control of the view.
   */
  autoFit?: boolean
}

interface GraphNodeData {
  id: string
  name: string
  val: number
  isEpic: boolean
  x?: number
  y?: number
}

interface GraphLinkData {
  source: string | GraphNodeData
  target: string | GraphNodeData
  edgeType: 'parent' | 'link'
}

interface ForceGraphInstance {
  d3Force: (name: string, force?: unknown) => unknown
  d3ReheatSimulation: () => void
  centerAt: (x?: number, y?: number, ms?: number) => void
  zoom: (scale: number, ms?: number) => void
  /** Fits the camera to the bounding box of all nodes.
   *  `ms` = animation duration, `px` = padding pixels around the box. */
  zoomToFit: (ms?: number, px?: number) => void
  /** Canvas-relative pixels → simulation coordinates. Used to work out
   *  which node sits under a touch, since touch produces no hover. */
  screen2GraphCoords: (x: number, y: number) => { x: number; y: number }
}

/** Hold time before a press counts as "label this node" rather than a tap. */
const LONG_PRESS_MS = 450
/** Finger drift allowed during the hold; beyond this it's a pan, not a press. */
const LONG_PRESS_SLOP_PX = 10

/**
 * Push the charge + link-distance values into the live d3 simulation.
 * Safe to call before or after the first tick — the forces are picked up
 * by the next tick either way.
 */
function applyForcesTo(
  inst: ForceGraphInstance,
  repulsion: number,
  linkDistance: number,
): void {
  const charge = inst.d3Force('charge') as { strength: (n: number) => unknown } | undefined
  charge?.strength(-repulsion)
  const link = inst.d3Force('link') as { distance: (n: number) => unknown } | undefined
  link?.distance(linkDistance)
}

const EMPTY_SET: ReadonlySet<string> = new Set()

export function ForceGraph({
  graph,
  highlightSlugs = EMPTY_SET,
  height,
  width,
  repulsion = 120,
  linkDistance = 80,
  onNodeClickAction = 'navigate',
  autoFit = false,
}: ForceGraphProps) {
  const router = useRouter()
  const params = useParams<{ locale: string }>()
  const [hoverId, setHoverId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphInstance | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  // Canvas needs resolved color values — CSS variables don't apply inside a
  // canvas context. Re-resolve when the theme changes so nodes follow the
  // active palette.
  const theme = useThemeStore((s) => s.theme)
  const colors = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        primary: '#6366f1',
        muted: '#9ca3af',
        border: '#e5e7eb',
        dim: 'rgba(0,0,0,0.05)',
        bg: '#ffffff',
        fg: '#111827',
      }
    }
    const cs = getComputedStyle(document.documentElement)
    const read = (name: string, fallback: string) => {
      const v = cs.getPropertyValue(name).trim()
      return v || fallback
    }
    return {
      primary: read('--primary', '#6366f1'),
      muted: read('--muted', '#9ca3af'),
      border: read('--border', '#e5e7eb'),
      dim: read('--border', 'rgba(0,0,0,0.05)'),
      // For the long-press label chip: canvas can't read CSS variables, so
      // the card/foreground pair is resolved here alongside the rest.
      bg: read('--card', read('--bg', '#ffffff')),
      fg: read('--fg', '#111827'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Memoize the graph payload so react-force-graph doesn't restart its
  // physics simulation on every hover-induced re-render. Highlights are
  // read from `highlightSlugs` via accessor at draw time — they MUST NOT
  // participate in this identity, or each keystroke reheats the layout.
  const data = useMemo(
    () => ({
      nodes: graph.nodes.map<GraphNodeData>((n) => ({
        id: n.slug,
        name: n.title,
        val: Math.max(1, n.connectionCount),
        isEpic: n.isEpic,
      })),
      links: graph.edges.map<GraphLinkData>((e) => ({
        source: e.source,
        target: e.target,
        edgeType: e.type,
      })),
    }),
    [graph],
  )

  // ── Long-press labels (touch only) ──────────────────────────────────────
  //
  // `nodeLabel` renders a tooltip on hover, which a touch device never
  // produces — so on a phone the graph is a field of anonymous dots with no
  // way to tell what any of them are short of navigating to one. A press-and-
  // hold names the node under the finger, and the label stays put afterwards
  // so it's readable once the finger that was covering it lifts.
  //
  // Gated on `pointerType === 'touch'` rather than a viewport width: the
  // thing that's actually missing is hover, not screen size. A mouse user at
  // any width keeps the tooltip and never triggers this; a tablet, which a
  // width check would have left broken, gets the fix.
  const [labelNodeId, setLabelNodeId] = useState<string | null>(null)
  const pressTimer = useRef<number | null>(null)
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)
  // Set when a hold completes, so the `click` that follows the release
  // doesn't also navigate — labelling and opening are different intents.
  const suppressClick = useRef(false)

  // Which kind of pointer the reader last used. Not state: this only feeds
  // the `nodeLabel` accessor, which the library calls on its own animation
  // frame — re-rendering on it would buy nothing and reheat nothing.
  const pointerIsTouch = useRef(false)
  const notePointerType = useCallback((e: React.PointerEvent) => {
    pointerIsTouch.current = e.pointerType === 'touch'
  }, [])

  // `nodeLabel` is the library's own HTML tooltip, and a touch raises it just
  // as a hover does — it takes the pointer position from `pointerdown` too.
  // So a held node ended up wearing two names: the canvas chip above it and
  // the tooltip below the finger.
  //
  // The tooltip is the one that goes, because it's the one that doesn't work
  // on touch. It appears under the finger that summoned it, a plain tap
  // raises it on the way to opening the note, and nothing takes it back down
  // afterwards — hover-out never comes without a hover. The chip is placed
  // clear of the fingertip and dismissed by tapping the background.
  //
  // An empty label is how force-graph is told there is no tooltip: it nulls
  // any falsy content, and null content hides the element.
  const nodeLabel = useCallback(
    (n: GraphNodeData) => (pointerIsTouch.current ? '' : n.name),
    [],
  )

  const cancelPress = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    pressOrigin.current = null
  }, [])

  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  /** Nearest node whose hitbox contains the given viewport point, if any. */
  const nodeAtPoint = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current
    const fg = fgRef.current
    if (!el || !fg) return null
    const rect = el.getBoundingClientRect()
    const pos = fg.screen2GraphCoords(clientX - rect.left, clientY - rect.top)
    return pickNodeAt(dataRef.current.nodes, pos.x, pos.y)
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Recorded before the early return: a mouse press must still be able to
      // put the tooltip back after a touch, on the hybrid devices that have
      // both.
      notePointerType(e)
      if (e.pointerType !== 'touch') return
      cancelPress()
      suppressClick.current = false
      const { clientX, clientY } = e
      pressOrigin.current = { x: clientX, y: clientY }
      pressTimer.current = window.setTimeout(() => {
        pressTimer.current = null
        const node = nodeAtPoint(clientX, clientY)
        if (!node) return
        setLabelNodeId(node.id)
        suppressClick.current = true
      }, LONG_PRESS_MS)
    },
    [cancelPress, nodeAtPoint, notePointerType],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // A mouse hovering the canvas never presses, so this is the only place
      // that hears about it.
      notePointerType(e)
      const origin = pressOrigin.current
      if (!origin) return
      // Drifting means the user is panning the canvas, not holding a node.
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > LONG_PRESS_SLOP_PX) {
        cancelPress()
      }
    },
    [cancelPress, notePointerType],
  )

  const handleNodeClick = useCallback(
    (node: GraphNodeData) => {
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      if (typeof onNodeClickAction === 'function') {
        onNodeClickAction(node.id)
      } else if (onNodeClickAction === 'navigate') {
        router.push(`/${params.locale}/notes/${node.id}`)
      }
    },
    [onNodeClickAction, router, params.locale],
  )

  // Re-apply forces when the user actually moves a slider. The first
  // application happens in the ref callback below so the very first tick
  // already uses our values — without that, the simulation runs its first
  // batch of ticks with d3's defaults (charge ≈ -30) and a dense layout
  // bakes in before this effect fires.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    applyForcesTo(fg, repulsion, linkDistance)
    fg.d3ReheatSimulation()
  }, [repulsion, linkDistance])

  // The simulation budget needs to scale with graph size. cooldownTime is a
  // wall-clock cap that starts from t=0 regardless of reheats, so a fixed
  // 3-second limit silently strangles big graphs: by the time the user
  // sees the result the nodes are still clumped from the early high-energy
  // phase. Tick budget scales with node count instead — every node gets a
  // few hundred ticks to find a stable seat — and the wall-clock cap is
  // generous enough that a sluggish device still finishes the budget.
  const nodeCount = data.nodes.length
  const cooldownTicks = Math.min(800, Math.max(150, nodeCount * 4))
  const cooldownTimeMs = Math.min(30_000, Math.max(8_000, nodeCount * 80))

  // Auto-fitting graphs settle before their first painted frame rather than
  // after. `warmupTicks` dry-runs the layout during ingestion, so by the time
  // anything is drawn the nodes already sit roughly where they'll end up and
  // a zero-duration fit reads as "it was always framed" instead of a camera
  // move the reader has to sit through. Only the side-panel local graph opts
  // in — it's a handful of nodes, so the dry run is cheap, and it's an
  // overview the reader glances at rather than a canvas they explore.
  const warmupTicks = autoFit ? Math.min(300, Math.max(60, nodeCount * 20)) : 0

  // 40px padding keeps node circles + labels off the canvas edge. Duration 0
  // throughout: any easing here is the "weird" zoom-out we're removing.
  const fitToViewport = useCallback(() => {
    fgRef.current?.zoomToFit(0, 40)
  }, [])

  const setFgRef = useCallback(
    (el: unknown) => {
      const inst = (el as ForceGraphInstance) ?? null
      const previouslyAttached = fgRef.current !== null
      fgRef.current = inst
      // On first attach (and on remount after data identity change), seed
      // the simulation's forces synchronously so warmup / early ticks use
      // the right values rather than d3's defaults.
      if (inst && !previouslyAttached) {
        applyForcesTo(inst, repulsion, linkDistance)
      }
    },
    [repulsion, linkDistance],
  )

  // Zoom & center on a single match. Skipped for zero or multiple matches.
  // Keyed on the singleton slug only so a fresh data identity doesn't re-zoom.
  const singleMatch =
    highlightSlugs.size === 1 ? [...highlightSlugs][0] : undefined
  useEffect(() => {
    // Never on an auto-fitting graph: "frame everything" and "zoom 3x onto
    // one node" are contradictory camera instructions. This exists for the
    // global graph's search box, but `LocalGraph` marks its centre note with
    // a single highlight slug too — so the side panel was zooming in to 3x
    // and then visibly zooming back out once the layout settled.
    if (autoFit) return
    if (!singleMatch) return
    const fg = fgRef.current
    if (!fg) return
    const id = window.setTimeout(() => {
      const node = dataRef.current.nodes.find((n) => n.id === singleMatch)
      if (node && typeof node.x === 'number' && typeof node.y === 'number') {
        fg.centerAt(node.x, node.y, 600)
        fg.zoom(3, 600)
      }
    }, 50)
    return () => window.clearTimeout(id)
  }, [singleMatch, autoFit])

  // Hover highlights the direct neighbourhood only — every node one edge
  // away from the hovered node, in either direction. The previous version
  // walked *downstream* transitively, which meant a single cross-cutting
  // link between two parents' subtrees dragged the entire second subtree
  // into the highlight (hover "Personal" → also light up "Programming"'s
  // chain). One-hop keeps the signal scoped to "what's actually connected
  // to this node?"; anything further is one hover away.
  const { highlightedNodes, highlightedEdges } = useMemo(() => {
    const nodes = new Set<string>()
    const edgeKeys = new Set<string>()
    if (!hoverId) return { highlightedNodes: nodes, highlightedEdges: edgeKeys }
    nodes.add(hoverId)
    for (const edge of graph.edges) {
      if (edge.source !== hoverId && edge.target !== hoverId) continue
      nodes.add(edge.source)
      nodes.add(edge.target)
      edgeKeys.add(`${edge.source}\x00${edge.target}\x00${edge.type}`)
    }
    return { highlightedNodes: nodes, highlightedEdges: edgeKeys }
  }, [hoverId, graph.edges])

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      // A long press on a canvas otherwise raises the platform's own
      // selection callout / context menu on top of the label.
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: width ?? '100%',
        height: height ?? '100%',
        // Pointer cursor while hovering a node — the canvas itself can't
        // self-set this per-region, so we toggle on the container based on
        // the current hover state.
        cursor: hoverId ? 'pointer' : 'default',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      {dims && (
        <ForceGraph2D
          ref={setFgRef}
          graphData={data}
          width={dims.w}
          height={dims.h}
          backgroundColor="transparent"
          nodeLabel={nodeLabel}
          nodeRelSize={3}
          // Default hitbox is the painted circle — tiny nodes are almost
          // impossible to click. Paint a wider transparent disc so the
          // pointer area is generous regardless of node val.
          nodePointerAreaPaint={(
            n: GraphNodeData,
            color: string,
            ctx: CanvasRenderingContext2D,
          ) => {
            const x = (n as { x?: number }).x
            const y = (n as { y?: number }).y
            if (typeof x !== 'number' || typeof y !== 'number') return
            const r = Math.max(8, Math.sqrt(n.val) * 3 + 4)
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(x, y, r, 0, Math.PI * 2)
            ctx.fill()
          }}
          nodeColor={(n: GraphNodeData) => {
            if (highlightSlugs.size > 0) {
              return highlightSlugs.has(n.id) ? colors.primary : colors.border
            }
            if (hoverId && !highlightedNodes.has(n.id)) return colors.border
            if (n.isEpic) return colors.primary
            return colors.muted
          }}
          linkColor={(l: GraphLinkData) => {
            if (!hoverId) return colors.border
            const sid = typeof l.source === 'string' ? l.source : l.source.id
            const tid = typeof l.target === 'string' ? l.target : l.target.id
            const key = `${sid}\x00${tid}\x00${l.edgeType}`
            return highlightedEdges.has(key) ? colors.primary : colors.dim
          }}
          onNodeClick={handleNodeClick}
          onBackgroundClick={() => setLabelNodeId(null)}
          onNodeHover={(node: GraphNodeData | null) => setHoverId(node?.id ?? null)}
          // `after` keeps the library's own node painting — the colour rules
          // above stay in one place and this only adds the label on top.
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(
            n: GraphNodeData,
            ctx: CanvasRenderingContext2D,
            globalScale: number,
          ) => {
            if (n.id !== labelNodeId) return
            const { x, y } = n
            if (typeof x !== 'number' || typeof y !== 'number') return
            // Sizes divide by the zoom so the chip stays legible at any scale
            // rather than growing and shrinking with the canvas.
            const fontSize = 12 / globalScale
            const padX = 5 / globalScale
            const padY = 3 / globalScale
            const gap = 4 / globalScale
            ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`
            const textWidth = ctx.measureText(n.name).width
            const boxW = textWidth + padX * 2
            const boxH = fontSize + padY * 2
            const boxX = x - boxW / 2
            const boxY = y - hitRadius(n.val) - gap - boxH
            ctx.fillStyle = colors.bg
            ctx.strokeStyle = colors.border
            ctx.lineWidth = 1 / globalScale
            ctx.beginPath()
            ctx.roundRect(boxX, boxY, boxW, boxH, 4 / globalScale)
            ctx.fill()
            ctx.stroke()
            ctx.fillStyle = colors.fg
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(n.name, x, boxY + boxH / 2)
          }}
          warmupTicks={warmupTicks}
          // Re-fit on every rendered tick, not just at engine stop. Warmup
          // gets the layout close, but the residual ticks still drift the
          // bounding box — fitting continuously keeps the graph framed the
          // whole time instead of snapping into place at the end.
          onEngineTick={autoFit ? fitToViewport : undefined}
          onEngineStop={autoFit ? fitToViewport : undefined}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
          cooldownTime={cooldownTimeMs}
          cooldownTicks={cooldownTicks}
          enableNodeDrag={false}
        />
      )}
    </div>
  )
}
