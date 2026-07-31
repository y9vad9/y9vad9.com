import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import { PanelWrapper } from '@components/garden/PanelWrapper'
import { usePanelStore } from '@store/panelStore'

/**
 * The garden's side panels are persisted so a desktop reader keeps the layout
 * they arranged. On mobile the same panels are modal drawers, and restoring a
 * modal open is a bug rather than a preference — opening a note from the
 * landing page dropped the reader into the file explorer because an earlier
 * visit had left `leftOpen: true` in localStorage.
 */
function mockViewport(isMobile: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    // The component asks for `(max-width: 639px)`.
    matches: isMobile,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const NOTES = [{ slug: 'a', title: 'A', series: null, order: null }]

beforeEach(() => {
  localStorage.clear()
  usePanelStore.setState({ leftOpen: false, rightOpen: false })
})

describe('PanelWrapper — mobile drawers', () => {
  it('closes a persisted-open drawer when the mobile layout mounts', () => {
    mockViewport(true)
    // Exactly the state a previous visit leaves behind.
    usePanelStore.setState({ leftOpen: true, rightOpen: false })

    render(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)

    expect(usePanelStore.getState().leftOpen).toBe(false)
    expect(usePanelStore.getState().rightOpen).toBe(false)
  })

  it('locks the article scroller while a drawer is open', () => {
    mockViewport(true)
    const { container, rerender } = render(
      <PanelWrapper noteList={NOTES}>body</PanelWrapper>,
    )
    // Mount closes the drawers; open one the way the reader would.
    usePanelStore.setState({ leftOpen: true })
    rerender(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)

    const scroller = container.querySelector('#notes-scroll')!
    // The garden scrolls inside this element, not the document, so the
    // landing page's body-pinning does nothing here — taking the overflow
    // away is what stops the article moving under the drawer.
    expect(scroller.className).toContain('overflow-y-hidden')
    expect(scroller.className).not.toContain('overflow-y-auto')
  })

  it('leaves the article scrollable when no drawer is open', () => {
    mockViewport(true)
    const { container } = render(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)
    const scroller = container.querySelector('#notes-scroll')!
    expect(scroller.className).toContain('overflow-y-auto')
  })

  it('pins the document while a drawer is open, so the header cannot slide away', () => {
    mockViewport(true)
    const { rerender } = render(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)
    expect(document.body.style.position).not.toBe('fixed')

    usePanelStore.setState({ leftOpen: true })
    rerender(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)

    // Locking `#notes-scroll` alone left the swipe to reach the document,
    // which rubber-bands and carries `NotesHeader` with it — the header is
    // sticky against the shell's non-scrolling `overflow-hidden` div, so it
    // has nothing to stick to when the page itself moves.
    expect(document.body.style.position).toBe('fixed')

    usePanelStore.setState({ leftOpen: false })
    rerender(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)
    expect(document.body.style.position).not.toBe('fixed')
  })

  it('does not pin the document on desktop, where panels are inline', () => {
    mockViewport(false)
    usePanelStore.setState({ leftOpen: true })
    render(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)
    expect(document.body.style.position).not.toBe('fixed')
  })

  it('does not force panels closed on desktop', () => {
    mockViewport(false)
    usePanelStore.setState({ leftOpen: true, rightOpen: true })

    render(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)

    // Desktop persistence is the feature; only the mobile branch resets.
    expect(usePanelStore.getState().leftOpen).toBe(true)
    expect(usePanelStore.getState().rightOpen).toBe(true)
  })
})
