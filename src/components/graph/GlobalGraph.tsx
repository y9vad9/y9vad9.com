'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Maximize2, Minimize2, Search } from 'lucide-react'
import { ForceGraph } from './ForceGraph'
import { usePanelStore } from '@store/panelStore'
import type { MentionGraph } from '@core/graph/MentionGraph'

export function GlobalGraph({ graph }: { graph: MentionGraph }) {
  const t = useTranslations('graph')
  const [isFullscreen, setIsFullscreen] = useState(false)
  /** Panel state to put back when leaving fullscreen. */
  const restore = useRef<{ left: boolean; right: boolean } | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [repulsion, setRepulsion] = useState(120)
  const [linkDistance, setLinkDistance] = useState(80)

  // Multi-match: every node whose title contains the query (case-insensitive).
  // Empty query → empty set → graph renders unhighlighted, no animation reheat.
  const highlightSlugs = useMemo<ReadonlySet<string>>(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return new Set()
    const matches = new Set<string>()
    for (const node of graph.nodes) {
      if (node.title.toLowerCase().includes(q)) matches.add(node.slug)
    }
    return matches
  }, [searchQ, graph.nodes])

  const matchCount = highlightSlugs.size

  /**
   * Fullscreen gives the graph the whole body area by collapsing the side
   * panels — it does not overlay the page.
   *
   * It used to be `fixed inset-0`, which reached under the header rather than
   * over it: the header is `sticky z-40`, and `#notes-scroll` (this graph's
   * ancestor) is sticky too, so it opens a stacking context that caps
   * everything inside it. No z-index here could ever beat a sibling of that
   * ancestor, which is why the control panel sat *behind* the top bar. The
   * side panels stayed reachable as well, and rendered over the canvas.
   *
   * Filling the space below the header instead sidesteps both: the panel is
   * positioned inside a box that already starts under the top bar, so there
   * is nothing to collide with, and the sidebars are simply not open.
   */
  function toggleFullscreen() {
    const next = !isFullscreen
    const panels = usePanelStore.getState()
    if (next) {
      restore.current = { left: panels.leftOpen, right: panels.rightOpen }
      panels.closeLeft()
      panels.closeRight()
    } else if (restore.current) {
      // Put the reader's layout back rather than leaving them to rebuild it.
      usePanelStore.setState({
        leftOpen: restore.current.left,
        rightOpen: restore.current.right,
      })
      restore.current = null
    }
    setIsFullscreen(next)
  }

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleFullscreen()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen])

  return (
    <div className="graph-canvas-zoom relative w-full h-[calc(100dvh-2.75rem)] bg-bg">
      <ForceGraph
        graph={graph}
        highlightSlugs={highlightSlugs}
        repulsion={repulsion}
        linkDistance={linkDistance}
      />

      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-card/95 backdrop-blur border border-border rounded-xl p-3 w-60 shadow-lg">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('title')}</p>

        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={t('search')}
              // 16px below `sm`: iOS Safari zooms the viewport on focus for
              // anything smaller, and never zooms back out. The two range
              // sliders below are exempt — iOS doesn't zoom on those.
              className="w-full pl-6 pr-12 py-1 text-base sm:text-xs bg-card-hover border border-border rounded focus:outline-none focus:border-primary"
            />
            {searchQ && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted tabular-nums">
                {matchCount}
              </span>
            )}
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-card-hover transition-colors text-muted hover:text-fg"
            aria-label={isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>

        <label className="flex flex-col gap-0.5 text-xs text-muted">
          <span className="flex justify-between">
            <span>{t('repulsion')}</span>
            <span className="font-mono">{repulsion}</span>
          </span>
          <input
            type="range" min={20} max={400} value={repulsion}
            onChange={(e) => setRepulsion(+e.target.value)}
            className="w-full"
          />
        </label>

        <label className="flex flex-col gap-0.5 text-xs text-muted">
          <span className="flex justify-between">
            <span>{t('linkDistance')}</span>
            <span className="font-mono">{linkDistance}</span>
          </span>
          <input
            type="range" min={20} max={300} value={linkDistance}
            onChange={(e) => setLinkDistance(+e.target.value)}
            className="w-full"
          />
        </label>
      </div>
    </div>
  )
}
