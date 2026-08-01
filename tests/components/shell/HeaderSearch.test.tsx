import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from '@components/shell/Header'
import { SiteConfigProvider } from '@lib/config/SiteConfigProvider'
import { config as baseConfig } from '~/site.config'
import { useSearchStore } from '@store/searchStore'

/**
 * The landing header's full search control is `hidden md:flex`, so a phone
 * had no way into the command palette at all — and once shortcuts were turned
 * off, no way back, since the toggle lives inside the palette and `/` is
 * disabled with everything else. The compact button is that escape hatch.
 *
 * Visibility is a Tailwind breakpoint rather than JS, so these assert the
 * class that controls it; jsdom applies no stylesheet to query.
 */
beforeEach(() => {
  useSearchStore.setState({ isOpen: false, query: '' })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

function renderHeader() {
  return render(
    <SiteConfigProvider value={baseConfig}>
      <Header />
    </SiteConfigProvider>,
  )
}

describe('landing header search', () => {
  it('exposes a phone-only search control', () => {
    renderHeader()
    const button = screen.getByLabelText('search')
    // `md:hidden` — the counterpart to the full control's `hidden md:flex`,
    // so exactly one of the two is ever on screen.
    expect(button.className).toContain('md:hidden')
  })

  it('opens the palette', () => {
    renderHeader()
    fireEvent.click(screen.getByLabelText('search'))
    expect(useSearchStore.getState().isOpen).toBe(true)
  })

  it('names the control, since it has no visible text to be named by', () => {
    // The wide control deliberately has no `aria-label` (its visible text is
    // the name). This one is icon-only, so the label is required rather than
    // a duplicate — and there is no visible text for it to contradict.
    renderHeader()
    const button = screen.getByLabelText('search')
    expect(button.textContent).toBe('')
    expect(button.getAttribute('aria-label')).toBeTruthy()
  })
})
