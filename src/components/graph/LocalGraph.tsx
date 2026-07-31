'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { ForceGraph } from './ForceGraph'
import { GraphLoading } from './GraphLoading'
import type { MentionGraph } from '@core/graph/MentionGraph'
import { buildLocalGraph, hasRelations } from '@core/graph/BuildLocalGraph'
import { RouteLink } from '@components/garden/RouteLink'
import { GRAPH_TAB_SLUG } from '@store/tabStore'

export function LocalGraph({ slug }: { slug: string }) {
  const t = useTranslations('graph')
  const params = useParams<{ locale: string }>()
  const [fullGraph, setFullGraph] = useState<MentionGraph | null>(null)

  useEffect(() => {
    let aborted = false
    const url = process.env.NEXT_PUBLIC_ONVU_MODE === 'static'
      ? `/_static/${params.locale}/graph.json`
      : `/api/graph?locale=${encodeURIComponent(params.locale)}`
    fetch(url)
      .then((r) => r.json())
      .then((g: MentionGraph) => { if (!aborted) setFullGraph(g) })
      .catch(() => {})
    return () => { aborted = true }
  }, [params.locale])

  // Memoized so unrelated re-renders (key presses, theme changes, panel
  // state) don't rebuild the graph object and reheat the physics simulation
  // downstream. The subgraph rule itself lives in core — see `buildLocalGraph`.
  const localGraph: MentionGraph | null = useMemo(
    () => (fullGraph ? buildLocalGraph(fullGraph, slug) : null),
    [fullGraph, slug],
  )

  const highlightSet = useMemo<ReadonlySet<string>>(() => new Set([slug]), [slug])

  if (!localGraph) return <GraphLoading text={t('loading')} />

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-[300px]">
        {hasRelations(localGraph) ? (
          <ForceGraph graph={localGraph} highlightSlugs={highlightSet} autoFit />
        ) : (
          // A note with nothing linked to it would otherwise render as one
          // dot alone in the panel, which reads as a broken or half-loaded
          // graph. Say it in words instead. The full-graph link stays put —
          // there's still somewhere to go from here.
          <p className="h-full flex items-center justify-center px-6 py-10 text-xs text-muted italic text-center">
            {t('noRelations')}
          </p>
        )}
      </div>
      <RouteLink
        href={`/${params.locale}/notes/graph`}
        routeSlug={GRAPH_TAB_SLUG}
        // RouteTabSync refreshes the title to the localized garden label
        // once the user lands on the page; this placeholder only matters
        // for the moment between Ctrl-click and the destination mount.
        routeTitle="Knowledge Graph"
        routeKind="graph"
        className="flex items-center justify-center gap-1 m-2 py-1.5 text-xs text-muted hover:text-primary border border-border hover:border-primary rounded transition-colors"
      >
        {t('viewFullGraph')} <ArrowRight size={11} />
      </RouteLink>
    </div>
  )
}
