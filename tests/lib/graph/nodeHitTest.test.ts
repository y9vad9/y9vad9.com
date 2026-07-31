import { describe, it, expect } from 'vitest'
import { hitRadius, pickNodeAt } from '@lib/graph/nodeHitTest'

/**
 * Backs the graph's long-press labels on touch. `react-force-graph` resolves
 * taps itself, but only from pointer events a touch-and-hold never produces,
 * so the press path has to decide which node is under the finger on its own —
 * and it has to agree with the tap path, or holding and tapping the same
 * pixel would pick different nodes.
 */
describe('hitRadius', () => {
  it('keeps a floor well above the painted circle', () => {
    // A `val: 1` node paints ~3px across, which is not a touch target.
    expect(hitRadius(1)).toBe(8)
  })

  it('grows with connection count once past the floor', () => {
    expect(hitRadius(25)).toBeGreaterThan(hitRadius(1))
    expect(hitRadius(100)).toBeGreaterThan(hitRadius(25))
  })
})

describe('pickNodeAt', () => {
  const node = (id: string, x: number, y: number, val = 1) => ({ id, x, y, val })

  it('returns the node under the point', () => {
    const nodes = [node('a', 0, 0), node('b', 100, 100)]
    expect(pickNodeAt(nodes, 2, 2)?.id).toBe('a')
    expect(pickNodeAt(nodes, 98, 101)?.id).toBe('b')
  })

  it('returns null when the point is in empty space', () => {
    expect(pickNodeAt([node('a', 0, 0)], 50, 50)).toBeNull()
  })

  it('respects the hit radius boundary', () => {
    const nodes = [node('a', 0, 0)] // radius 8
    expect(pickNodeAt(nodes, 7.9, 0)?.id).toBe('a')
    expect(pickNodeAt(nodes, 8.1, 0)).toBeNull()
  })

  it('picks the nearest centre when hitboxes overlap', () => {
    // Dense clusters routinely overlap; taking the first match in array order
    // would label whichever node the data happened to list first rather than
    // the one the finger was actually closest to.
    const nodes = [node('far', 0, 0), node('near', 6, 0)]
    expect(pickNodeAt(nodes, 5, 0)?.id).toBe('near')
    // …and the same holds with the array order reversed.
    expect(pickNodeAt([...nodes].reverse(), 5, 0)?.id).toBe('near')
  })

  it('ignores nodes the simulation has not placed yet', () => {
    // Treating a missing coordinate as 0 would make every unplaced node a hit
    // at the canvas origin during the first frames of the layout.
    const nodes = [{ id: 'unplaced', val: 1 } as { id: string; val: number; x?: number; y?: number }]
    expect(pickNodeAt(nodes, 0, 0)).toBeNull()
  })

  it('uses each node’s own radius, not a shared one', () => {
    // A big hub should be grabbable from further out than a leaf.
    const hub = node('hub', 0, 0, 100) // radius 34
    const leaf = node('leaf', 0, 0, 1) // radius 8
    expect(pickNodeAt([hub], 20, 0)?.id).toBe('hub')
    expect(pickNodeAt([leaf], 20, 0)).toBeNull()
  })
})
