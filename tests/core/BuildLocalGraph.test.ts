import { describe, it, expect } from 'vitest'
import { buildLocalGraph, hasRelations } from '@core/graph/BuildLocalGraph'
import type { MentionGraph } from '@core/graph/MentionGraph'

function node(slug: string) {
  return { slug, title: slug, connectionCount: 0, isEpic: false }
}

const GRAPH: MentionGraph = {
  nodes: ['a', 'b', 'c', 'lonely', 'far'].map(node),
  edges: [
    { source: 'a', target: 'b', type: 'link' },
    { source: 'c', target: 'a', type: 'parent' },
    // Between two of a's neighbours — must not be pulled in.
    { source: 'b', target: 'c', type: 'link' },
    // Nowhere near a.
    { source: 'far', target: 'b', type: 'link' },
  ],
}

describe('buildLocalGraph', () => {
  it('keeps the centre and its direct neighbours', () => {
    const local = buildLocalGraph(GRAPH, 'a')
    expect(local.nodes.map((n) => n.slug).sort()).toEqual(['a', 'b', 'c'])
  })

  it('follows edges in both directions', () => {
    const local = buildLocalGraph(GRAPH, 'a')
    // a→b is outgoing, c→a is incoming; both count.
    expect(local.edges).toHaveLength(2)
  })

  it('drops edges between neighbours that do not touch the centre', () => {
    // b→c would clump the panel without saying anything about `a`.
    const local = buildLocalGraph(GRAPH, 'a')
    const pairs = local.edges.map((e) => `${e.source}->${e.target}`)
    expect(pairs).not.toContain('b->c')
    expect(pairs).not.toContain('far->b')
  })

  it('returns just the centre for a note with no edges', () => {
    const local = buildLocalGraph(GRAPH, 'lonely')
    expect(local.nodes.map((n) => n.slug)).toEqual(['lonely'])
    expect(local.edges).toEqual([])
  })

  it('returns an empty graph for a slug not in the graph at all', () => {
    const local = buildLocalGraph(GRAPH, 'ghost')
    expect(local.nodes).toEqual([])
    expect(local.edges).toEqual([])
  })
})

describe('hasRelations', () => {
  it('is true when the centre actually connects to something', () => {
    expect(hasRelations(buildLocalGraph(GRAPH, 'a'))).toBe(true)
  })

  it('is false for a lone node — one dot reads as a broken graph', () => {
    expect(hasRelations(buildLocalGraph(GRAPH, 'lonely'))).toBe(false)
  })

  it('is false when the note is missing from the graph', () => {
    expect(hasRelations(buildLocalGraph(GRAPH, 'ghost'))).toBe(false)
  })

  it('is false for nodes without edges, even if several are present', () => {
    // Defensive: node count alone must not be the test.
    expect(hasRelations({ nodes: [node('a'), node('b')], edges: [] })).toBe(false)
  })
})
