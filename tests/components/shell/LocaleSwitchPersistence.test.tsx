import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { config as baseConfig } from '~/site.config'
import * as nav from 'next/navigation'

/**
 * Switching language has to persist the choice, from every surface that offers
 * it.
 *
 * The unprefixed `/notes/<slug>` route reads a stored locale before falling
 * back to `navigator.language`. Nothing ever wrote it, so a reader who chose
 * German was sent back to their browser's language the next time they followed
 * a link without a prefix. Three separate switchers each rebuilt the path by
 * hand and none of them recorded anything, which is why the persistence lives
 * in the hook they now share rather than at the call sites.
 */
const router = (nav as unknown as { __router: { push: ReturnType<typeof vi.fn> } }).__router
const navState = (nav as unknown as { __state: { pathname: string } }).__state

beforeEach(() => {
  localStorage.clear()
  router.push.mockClear()
  navState.pathname = '/en/notes/deep-modules'
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

async function renderNotesHeader() {
  const { NotesHeader } = await import('@components/shell/NotesHeader')
  const { SiteConfigProvider } = await import('@lib/config/SiteConfigProvider')
  return render(
    <SiteConfigProvider value={baseConfig}>
      <NotesHeader />
    </SiteConfigProvider>,
  )
}

/**
 * Open the language menu and pick a language.
 *
 * By the label the menu actually renders, which comes from the `language`
 * namespace in `tests/setup.ts` rather than from `Intl.DisplayNames`. Matching
 * on the locale code would find nothing, since a reader is never shown one.
 */
function chooseLanguage(label: string) {
  fireEvent.click(screen.getByLabelText('switchLanguage'))
  fireEvent.click(screen.getByRole('button', { name: label }))
}

describe('the garden header language switcher', () => {
  it('navigates to the same note in the chosen language', async () => {
    await renderNotesHeader()
    chooseLanguage('Deutsch')
    expect(router.push).toHaveBeenCalledWith('/de/notes/deep-modules')
  })

  it('remembers the choice for the unprefixed note route', async () => {
    await renderNotesHeader()
    chooseLanguage('Deutsch')
    const { readLocalePreference } = await import('@lib/i18n/localePreference')
    expect(readLocalePreference()).toBe('de')
  })

  it('records nothing when the reader picks the language they are already in', async () => {
    await renderNotesHeader()
    chooseLanguage('English')
    expect(router.push).not.toHaveBeenCalled()
    expect(localStorage.getItem('locale')).toBeNull()
  })
})
