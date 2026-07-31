/**
 * Geometry shared between the graph's pointer hitbox and its touch hit-test.
 *
 * `react-force-graph` resolves taps for us, but only through pointer events
 * that a touch-and-hold never produces — so the long-press label has to work
 * out which node is under the finger itself. Keeping both paths on the same
 * radius is what stops a press and a tap disagreeing about which node (or
 * whether any node) was under the same pixel.
 *
 * Lives outside the component so it can be tested without pulling in the
 * canvas renderer, the router, or the theme store.
 */

export interface HitTestNode {
  val: number
  x?: number
  y?: number
}

/**
 * Clickable radius of a node, in simulation units.
 *
 * The painted circle scales with `val` and is often only a couple of pixels
 * across, which is unusably small as a touch target — so the hitbox has a
 * floor well above the visual size.
 */
export function hitRadius(val: number): number {
  return Math.max(8, Math.sqrt(val) * 3 + 4)
}

/**
 * The node whose hitbox contains `(x, y)`, or null. When hitboxes overlap —
 * common in a dense cluster — the nearest centre wins, so the node the user
 * most plausibly aimed at is chosen rather than whichever happens to come
 * first in the array.
 *
 * Nodes without coordinates are skipped: the simulation has not placed them
 * yet, and treating a missing position as the origin would make every
 * unplaced node a hit at the centre of the canvas.
 */
export function pickNodeAt<T extends HitTestNode>(
  nodes: readonly T[],
  x: number,
  y: number,
): T | null {
  let best: T | null = null
  let bestDistance = Infinity
  for (const node of nodes) {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') continue
    const distance = Math.hypot(node.x - x, node.y - y)
    if (distance <= hitRadius(node.val) && distance < bestDistance) {
      bestDistance = distance
      best = node
    }
  }
  return best
}
