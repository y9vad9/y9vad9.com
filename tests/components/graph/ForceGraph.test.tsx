import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { ForceGraph } from '@components/graph/ForceGraph'
import type { MentionGraph } from '@core/graph/MentionGraph'

/**
 * A graph node can be named two ways: the library's own HTML tooltip
 * (`nodeLabel`) and the canvas chip this component paints on long press.
 * The tooltip is a hover affordance, but force-graph reads the pointer
 * position from `pointerdown` too — so a touch raised it as well, and a
 * held node ended up wearing both names at once, the chip above it and the
 * tooltip below the finger.
 *
 * These tests are about which of the two the library is handed, so the
 * canvas renderer is replaced with something that just records its props.
 */
let props: Record<string, unknown> | null = null

// Standing in for the renderer means standing in for `next/dynamic` too: its
// loadable wrapper owns the ref, so a mock behind it never receives the one
// the component seeds its d3 forces through. Nothing here tests the dynamic
// import — only which props the renderer is handed.
vi.mock('next/dynamic', async () => {
  const { useImperativeHandle } = await import('react')
  // jsdom has no canvas to build a simulation on, so the stand-in just
  // answers the imperative API the component reaches for on attach.
  const instance = {
    d3Force: () => ({ strength: () => {}, distance: () => {} }),
    d3ReheatSimulation: () => {},
    centerAt: () => {},
    zoom: () => {},
    zoomToFit: () => {},
    screen2GraphCoords: (x: number, y: number) => ({ x, y }),
  }
  return {
    default: () =>
      function ForceGraph2DStub({ ref, ...rest }: Record<string, unknown> & { ref?: unknown }) {
        props = rest
        useImperativeHandle(ref as never, () => instance)
        return <canvas data-testid="force-graph" />
      },
  }
})

const GRAPH: MentionGraph = {
  nodes: [
    { slug: 'a', title: 'Alpha', connectionCount: 1, isEpic: false },
    { slug: 'b', title: 'Beta', connectionCount: 1, isEpic: false },
  ],
  edges: [{ source: 'a', target: 'b', type: 'link' }],
}

const NODE = { id: 'a', name: 'Alpha', val: 1, isEpic: false }

beforeEach(() => {
  props = null
})

/** Renders and waits for the dynamically imported canvas to attach. */
async function mount() {
  const { container } = render(<ForceGraph graph={GRAPH} />)
  await waitFor(() => expect(props).not.toBeNull())
  return container.firstElementChild as HTMLElement
}

/** What the library would put in its tooltip for the given node right now. */
function tooltipFor(node: typeof NODE): string {
  const label = props!.nodeLabel as (n: typeof NODE) => string
  return label(node)
}

describe('ForceGraph tooltips', () => {
  it('names the node under a mouse', async () => {
    const el = await mount()
    fireEvent.pointerMove(el, { pointerType: 'mouse', clientX: 10, clientY: 10 })
    // Nothing about the fix may cost a mouse user their tooltip — hover is
    // the one input where it works.
    expect(tooltipFor(NODE)).toBe('Alpha')
  })

  it('withholds the tooltip once the reader touches the canvas', async () => {
    const el = await mount()
    fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 10, clientY: 10 })
    // Empty is how force-graph is told there is no tooltip: it nulls falsy
    // content, and null content hides the element. Anything truthy here is
    // the second label the reader was seeing.
    expect(tooltipFor(NODE)).toBe('')
  })

  it('withholds it on a plain tap too, not just a completed hold', async () => {
    const el = await mount()
    fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 10, clientY: 10 })
    fireEvent.pointerUp(el)
    // A tap opens the note. Flashing a tooltip on the way out — one nothing
    // takes back down, since hover-out never comes without a hover — is the
    // same bug with a shorter press.
    expect(tooltipFor(NODE)).toBe('')
  })

  it('gives the tooltip back when a mouse returns to a hybrid device', async () => {
    const el = await mount()
    fireEvent.pointerDown(el, { pointerType: 'touch', clientX: 10, clientY: 10 })
    fireEvent.pointerMove(el, { pointerType: 'mouse', clientX: 40, clientY: 40 })
    // A touchscreen laptop is one device with both inputs; the last pointer
    // used decides, not the hardware present.
    expect(tooltipFor(NODE)).toBe('Alpha')
  })
})
