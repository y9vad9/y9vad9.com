'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useThemeStore } from '@store/themeStore'
import type { MentionGraph } from '@core/graph/MentionGraph'

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
}

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
      return { primary: '#6366f1', muted: '#9ca3af', border: '#e5e7eb', dim: 'rgba(0,0,0,0.05)' }
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

  const handleNodeClick = useCallback(
    (node: GraphNodeData) => {
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
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])
  useEffect(() => {
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
  }, [singleMatch])

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
      style={{
        width: width ?? '100%',
        height: height ?? '100%',
        // Pointer cursor while hovering a node — the canvas itself can't
        // self-set this per-region, so we toggle on the container based on
        // the current hover state.
        cursor: hoverId ? 'pointer' : 'default',
      }}
    >
      {dims && (
        <ForceGraph2D
          ref={setFgRef}
          graphData={data}
          width={dims.w}
          height={dims.h}
          backgroundColor="transparent"
          nodeLabel="name"
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
          onNodeHover={(node: GraphNodeData | null) => setHoverId(node?.id ?? null)}
          onEngineStop={
            autoFit
              ? () => {
                  // Fit-to-viewport once layout settles. 40px padding
                  // keeps node circles + labels away from the canvas
                  // edge; 400ms feels considered without lagging.
                  fgRef.current?.zoomToFit(400, 40)
                }
              : undefined
          }
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
