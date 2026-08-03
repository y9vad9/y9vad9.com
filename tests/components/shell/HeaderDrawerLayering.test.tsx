import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NotesHeader } from '@components/shell/NotesHeader'
import { PanelWrapper } from '@components/garden/PanelWrapper'
import { SiteConfigProvider } from '@lib/config/SiteConfigProvider'
import { usePanelStore } from '@store/panelStore'
import { config as baseConfig } from '~/site.config'

/**
 * The garden header must outrank the mobile drawers.
 *
 * Both used to sit on `z-40`, and `PanelWrapper` renders after `NotesHeader`
 * in the notes layout — they are siblings under the shell — so the tie broke
 * in the drawer's favour. Nothing showed while the header held only icons,
 * but the language menu drops *out* of the bar into the drawer's band, and it
 * opened behind the drawer.
 *
 * Raising the menu's own z-index cannot fix that: `NotesHeader` is `sticky`,
 * which opens a stacking context, so no descendant of it can outrank a
 * sibling of the header itself. The layering has to be settled between the
 * header and the drawer, which is what these tests pin.
 */
function layerOf(el: Element): number {
  const match = /(?:^|\s)z-(\d+)(?:\s|$)/.exec(el.className)
  if (!match) throw new Error(`no z-N class on: ${el.className}`)
  return Number(match[1])
}

function mockViewport(isMobile: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isMobile,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const NOTES = [{ slug: 'a', title: 'A', series: null, order: null }]

function renderHeader() {
  return render(
    <SiteConfigProvider value={baseConfig}>
      <NotesHeader />
    </SiteConfigProvider>,
  )
}

/** Renders the mobile layout with the right-hand tools drawer open. */
function renderOpenDrawer() {
  const view = render(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)
  // Mount force-closes the drawers on mobile; open one as the reader would.
  usePanelStore.setState({ rightOpen: true })
  view.rerender(<PanelWrapper noteList={NOTES}>body</PanelWrapper>)
  return view
}

beforeEach(() => {
  localStorage.clear()
  usePanelStore.setState({ leftOpen: false, rightOpen: false })
  mockViewport(true)
})

describe('garden header vs mobile drawer layering', () => {
  it('puts the header above the drawer', () => {
    const { container: headerBox } = renderHeader()
    const header = headerBox.querySelector('header')!

    const { container: panelBox } = renderOpenDrawer()
    const drawer = panelBox.querySelector('aside')!

    // Strictly greater, not merely different: equal values fall through to
    // DOM order, and the drawer is always painted later.
    expect(layerOf(header)).toBeGreaterThan(layerOf(drawer))
  })

  it('puts the drawer above its own backdrop', () => {
    const { container } = renderOpenDrawer()
    const drawer = container.querySelector('aside')!
    const backdrop = container.querySelector('.backdrop-blur-sm')!
    expect(layerOf(drawer)).toBeGreaterThan(layerOf(backdrop))
  })

  it('leaves the header lit while a drawer is open', () => {
    const { container: headerBox } = renderHeader()
    const header = headerBox.querySelector('header')!

    const { container: panelBox } = renderOpenDrawer()
    const backdrop = panelBox.querySelector('.backdrop-blur-sm')!

    // The bar carries the toggle that closes the drawer, so dimming it would
    // strand the reader behind their own overlay.
    expect(layerOf(header)).toBeGreaterThan(layerOf(backdrop))
  })

  it('keeps the language menu inside the header, so it inherits that layer', () => {
    const { container } = renderHeader()
    const header = container.querySelector('header')!

    fireEvent.click(screen.getByLabelText('switchLanguage'))

    // `Українська` is one of the configured locales; finding it proves the
    // menu opened. It has to be a *descendant* of the header — a menu
    // portalled elsewhere would be back to racing the drawer on its own.
    const entry = screen.getByRole('button', { name: 'Українська' })
    expect(header.contains(entry)).toBe(true)
  })
})
