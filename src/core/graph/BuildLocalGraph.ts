import type { MentionGraph } from './MentionGraph'

/**
 * The 1-hop neighbourhood of a note: the note itself, whatever it links to or
 * is linked from, and only the edges that physically touch it.
 *
 * Edges between two neighbours that don't involve the centre are dropped on
 * purpose. They make a side-panel view look like a clump and say nothing
 * about *this* note's incoming and outgoing relationships, which is the whole
 * point of a local view.
 */
export function buildLocalGraph(full: MentionGraph, slug: string): MentionGraph {
  const neighbours = new Set<string>([slug])
  const edges = full.edges.filter((e) => e.source === slug || e.target === slug)
  for (const edge of edges) {
    neighbours.add(edge.source)
    neighbours.add(edge.target)
  }
  return {
    nodes: full.nodes.filter((n) => neighbours.has(n.slug)),
    edges,
  }
}

/**
 * Whether a local graph is worth drawing.
 *
 * A lone node is a worse answer than a sentence: it renders as a single dot
 * floating in the panel, which reads as a broken or still-loading graph
 * rather than as "nothing connects here yet". Callers should show text
 * instead. Also false when the note is missing from the graph entirely.
 */
export function hasRelations(local: MentionGraph): boolean {
  return local.nodes.length > 1 && local.edges.length > 0
}
