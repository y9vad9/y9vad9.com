import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { config as baseConfig } from '~/site.config'

/**
 * On a single-locale site the language control opens a menu whose only entry
 * is the language already in use — a dead affordance in the top bar, the
 * mobile drawer, and (via its own filter) the command palette.
 *
 * `MULTILINGUAL` is derived from the configured locales at module load, so
 * the routing module is mocked per suite rather than reassigned.
 */
function mockLocales(locales: string[]) {
  vi.doMock('@i18n/routing', () => ({
    LOCALES: locales,
    DEFAULT_LOCALE: locales[0],
    MULTILINGUAL: locales.length > 1,
    routing: { locales, defaultLocale: locales[0] },
  }))
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

async function renderNotesHeader() {
  const { NotesHeader } = await import('@components/shell/NotesHeader')
  // The header reads `shortcuts.enabled` (to decide whether to show the `/`
  // badge), so it needs the provider its production tree already gives it.
  //
  // Imported here, not at module scope: `vi.resetModules()` rebuilds the
  // registry each test, so a statically-imported provider would carry a
  // different React context object than the one this fresh `NotesHeader`
  // reads from — and the value would never reach it.
  const { SiteConfigProvider } = await import('@lib/config/SiteConfigProvider')
  return render(
    <SiteConfigProvider value={baseConfig}>
      <NotesHeader />
    </SiteConfigProvider>,
  )
}

describe('language switcher visibility', () => {
  it('renders the switcher when more than one locale is configured', async () => {
    mockLocales(['en', 'de', 'uk'])
    await renderNotesHeader()
    expect(screen.getByLabelText('Switch language')).toBeInTheDocument()
  })

  it('hides the switcher when only one locale is configured', async () => {
    mockLocales(['en'])
    await renderNotesHeader()
    expect(screen.queryByLabelText('Switch language')).not.toBeInTheDocument()
  })

  it('still renders the rest of the header on a single-locale site', async () => {
    // Guards against "fixed" by removing too much — the theme toggle sits
    // right beside the language control in the same cluster.
    mockLocales(['en'])
    await renderNotesHeader()
    expect(screen.getByLabelText(/^Theme:/)).toBeInTheDocument()
  })
})
