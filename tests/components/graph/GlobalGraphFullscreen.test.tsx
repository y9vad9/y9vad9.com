import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GlobalGraph } from '@components/graph/GlobalGraph'
import { usePanelStore } from '@store/panelStore'
import type { MentionGraph } from '@core/graph/MentionGraph'

// The canvas renderer is a dynamic import that needs a real WebGL-ish
// environment; jsdom gets as far as `inst.d3Force is not a function`. These
// tests are about the fullscreen wiring around it, not the drawing.
vi.mock('@components/graph/ForceGraph', () => ({ ForceGraph: () => null }))

/**
 * Fullscreen collapses the side panels rather than overlaying the page.
 *
 * The overlay version was `fixed inset-0`, which reached *under* the header:
 * `#notes-scroll` is `position: sticky` and therefore opens a stacking
 * context, capping every z-index inside it below the header's own. The
 * control panel rendered behind the top bar, and the sidebars stayed
 * reachable and drew over the canvas.
 */
const GRAPH: MentionGraph = {
  nodes: [
    { slug: 'a', title: 'Alpha', connectionCount: 1, isEpic: false },
    { slug: 'b', title: 'Beta', connectionCount: 1, isEpic: false },
  ],
  edges: [{ source: 'a', target: 'b', type: 'link' }],
}

beforeEach(() => {
  usePanelStore.setState({ leftOpen: true, rightOpen: true })
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {},
  }))
})

function enterFullscreen() {
  // The control panel's only unlabelled-by-text button.
  fireEvent.click(screen.getByLabelText('fullscreen'))
}

describe('GlobalGraph fullscreen', () => {
  it('closes both side panels on entry', () => {
    render(<GlobalGraph graph={GRAPH} />)
    enterFullscreen()
    expect(usePanelStore.getState().leftOpen).toBe(false)
    expect(usePanelStore.getState().rightOpen).toBe(false)
  })

  it('restores the panels the reader had open on exit', () => {
    usePanelStore.setState({ leftOpen: false, rightOpen: true })
    render(<GlobalGraph graph={GRAPH} />)
    enterFullscreen()
    expect(usePanelStore.getState().rightOpen).toBe(false)

    fireEvent.click(screen.getByLabelText('exitFullscreen'))
    // Exactly what they had, not "both open" — leaving them to rebuild the
    // layout would be worse than not collapsing it in the first place.
    expect(usePanelStore.getState().leftOpen).toBe(false)
    expect(usePanelStore.getState().rightOpen).toBe(true)
  })

  it('exits on Escape', () => {
    render(<GlobalGraph graph={GRAPH} />)
    enterFullscreen()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByLabelText('fullscreen')).toBeInTheDocument()
    expect(usePanelStore.getState().leftOpen).toBe(true)
  })

  it('never positions the canvas over the page chrome', () => {
    const { container } = render(<GlobalGraph graph={GRAPH} />)
    const shell = container.firstElementChild as HTMLElement
    enterFullscreen()
    // `fixed inset-0` is what put the control panel under the header; the
    // graph must stay inside the body box, which already starts below it.
    expect(shell.className).not.toContain('fixed')
    expect(shell.className).toContain('relative')
  })
})
