import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react'
import { CommandPalette } from '@components/search/CommandPalette'
import { useSearchStore } from '@store/searchStore'
import { useTabStore } from '@store/tabStore'
import { usePanelStore } from '@store/panelStore'
import { useShortcutsStore } from '@store/shortcutsStore'
import { getRouterMock } from '../../utils/nextRouter'
import { SiteConfigProvider } from '@lib/config/SiteConfigProvider'
import { config as baseConfig } from '~/site.config'
import type { SiteConfig } from '@config/site'
import { scopedCommandLabel } from '@lib/shortcuts/gardenShortcuts'


/**
 * A palette row's visible text, built the way the component builds it.
 *
 * Commands read `Scope: Action` so they can be found by where they act, not
 * only by the verb someone picked. The next-intl mock returns keys verbatim,
 * so composing here keeps the assertions honest — hardcoding
 * `'scopes.explorer: toggleLeft'` in a dozen places would pass even if the
 * component stopped scoping altogether.
 */
const cmd = (scope: string, id: string) => scopedCommandLabel(`scopes.${scope}`, id)

/** `true` = a fine pointer is available, which stands in for "has a keyboard". */
function mockPointer(fine: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('any-pointer: fine') ? fine : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const INDEX = [
  { slug: 'kotlin', title: 'Kotlin', preview: 'JVM lang', parents: ['Engineering'], rawText: '', date: null, coverImage: null },
  { slug: 'coroutines', title: 'Kotlin Coroutines', preview: 'Suspending', parents: ['Engineering'], rawText: '', date: null, coverImage: null },
  { slug: 'next', title: 'Next.js', preview: 'React framework', parents: ['Frontend'], rawText: '', date: null, coverImage: null },
]

beforeEach(() => {
  useSearchStore.setState({ isOpen: true, query: '' })
  useTabStore.setState({ tabs: [], activeSlug: null })
  useShortcutsStore.setState({ preference: null })
  // Default the suite to a keyboard-capable device — `useHasKeyboard`
  // reads `(any-pointer: fine)`, and jsdom ships no `matchMedia` at all.
  mockPointer(true)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => INDEX,
  } as Response))
})


/**
 * The palette reads `shortcuts.enabled` from site config to decide whether to
 * advertise key chords, so it now needs the provider its production tree
 * already gives it (`ClientProviders` sits inside `SiteConfigProvider`).
 */
function renderPalette(overrides: Partial<SiteConfig> = {}) {
  return render(
    <SiteConfigProvider value={{ ...baseConfig, ...overrides }}>
      <CommandPalette />
    </SiteConfigProvider>,
  )
}

describe('CommandPalette', () => {
  describe('touch devices', () => {
    it('drops the chord hints, which cannot be typed', async () => {
      mockPointer(false)
      const { state } = await getRouterMock()
      state.pathname = '/en/notes/some-note'
      renderPalette()
      // The commands themselves stay — tapping one is the whole point here.
      await waitFor(() => expect(screen.getByText(cmd('explorer', 'toggleLeft'))).toBeInTheDocument())
      expect(screen.queryByText(/^(⌘|Ctrl) \[$/)).not.toBeInTheDocument()
      expect(screen.queryByText('G')).not.toBeInTheDocument()
      state.pathname = '/en'
    })

    it('hides the shortcuts switch, since there is nothing to switch off', async () => {
      // On the landing page this left a Commands group whose only row was an
      // offer to disable keys the device does not have.
      mockPointer(false)
      renderPalette()
      await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument())
      expect(screen.queryByText(cmd('shortcuts', 'disableShortcuts'))).not.toBeInTheDocument()
      expect(screen.queryByText(cmd('shortcuts', 'enableShortcuts'))).not.toBeInTheDocument()
    })
  })

  describe('user-side shortcut toggle', () => {
    it('offers the toggle everywhere, not just in the garden', async () => {
      // It governs the palette's own `/` too, so it has to be reachable from
      // wherever the reader turned shortcuts off.
      const { state } = await getRouterMock()
      state.pathname = '/en'
      renderPalette()
      await waitFor(() => expect(screen.getByText(cmd('shortcuts', 'disableShortcuts'))).toBeInTheDocument())
      expect(screen.queryByText(cmd('explorer', 'toggleLeft'))).not.toBeInTheDocument()
    })

    it('flips the stored preference and relabels itself', async () => {
      renderPalette()
      await waitFor(() => expect(screen.getByText(cmd('shortcuts', 'disableShortcuts'))).toBeInTheDocument())
      fireEvent.click(screen.getByText(cmd('shortcuts', 'disableShortcuts')))
      expect(useShortcutsStore.getState().preference).toBe(false)
      // Selecting a command closes the palette, as every other command does,
      // so the relabel is only visible on the next open.
      act(() => useSearchStore.setState({ isOpen: true }))
      await waitFor(() => expect(screen.getByText(cmd('shortcuts', 'enableShortcuts'))).toBeInTheDocument())
    })

    it("the reader's choice overrides the site default", async () => {
      // Site config says off; the reader turned them back on.
      useShortcutsStore.setState({ preference: true })
      renderPalette({ shortcuts: { enabled: false } })
      await waitFor(() => expect(screen.getByText(cmd('shortcuts', 'disableShortcuts'))).toBeInTheDocument())
    })

    it('falls back to the site default when nothing is chosen', async () => {
      useShortcutsStore.setState({ preference: null })
  // Default the suite to a keyboard-capable device — `useHasKeyboard`
  // reads `(any-pointer: fine)`, and jsdom ships no `matchMedia` at all.
  mockPointer(true)
      renderPalette({ shortcuts: { enabled: false } })
      await waitFor(() => expect(screen.getByText(cmd('shortcuts', 'enableShortcuts'))).toBeInTheDocument())
    })

    it('stops the / key opening the palette once disabled', async () => {
      useShortcutsStore.setState({ preference: false })
      useSearchStore.setState({ isOpen: false, query: '' })
      renderPalette()
      fireEvent.keyDown(document, { key: '/' })
      expect(useSearchStore.getState().isOpen).toBe(false)
      // …and works again when re-enabled.
      useShortcutsStore.setState({ preference: true })
      await waitFor(() => {
        fireEvent.keyDown(document, { key: '/' })
        expect(useSearchStore.getState().isOpen).toBe(true)
      })
    })
  })

  describe('garden commands', () => {
    it('lists the shortcuts with their chords on a garden route', async () => {
      // The palette is where these shortcuts become discoverable at all —
      // nothing else in the UI names them.
      const { state } = await getRouterMock()
      state.pathname = '/en/notes/some-note'
      renderPalette()
      await waitFor(() => expect(screen.getByText(cmd('explorer', 'toggleLeft'))).toBeInTheDocument())
      expect(screen.getByText(cmd('tools', 'graph'))).toBeInTheDocument()
      // Chord rendered beside the row, platform-resolved.
      expect(screen.getByText(/^(⌘|Ctrl) \[$/)).toBeInTheDocument()
      expect(screen.getByText('G')).toBeInTheDocument()
      state.pathname = '/en'
    })

    it('offers no commands outside the garden, where they would do nothing', async () => {
      const { state } = await getRouterMock()
      state.pathname = '/en'
      renderPalette()
      await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument())
      expect(screen.queryByText(cmd('explorer', 'toggleLeft'))).not.toBeInTheDocument()
    })

    it('keeps the commands but drops the chords when shortcuts are disabled', async () => {
      // Turning the keys off must not remove the actions: the palette is the
      // non-keyboard way to reach them. It must also stop printing a key that
      // no longer fires.
      const { state } = await getRouterMock()
      state.pathname = '/en/notes/some-note'
      renderPalette({ shortcuts: { enabled: false } })
      await waitFor(() => expect(screen.getByText(cmd('explorer', 'toggleLeft'))).toBeInTheDocument())
      expect(screen.queryByText(/^(⌘|Ctrl) \[$/)).not.toBeInTheDocument()
      expect(screen.queryByText('G')).not.toBeInTheDocument()
      state.pathname = '/en'
    })

    it('finds commands by their scope, not just by the verb', async () => {
      // The reason the labels carry a `Scope:` prefix at all. Someone who
      // knows they want to do something to the tools panel can type "tools"
      // and see everything it can do, without guessing whether the author
      // called it "open", "show", "focus" or "reveal".
      const { state } = await getRouterMock()
      state.pathname = '/en/notes/some-note'
      renderPalette()
      await waitFor(() => expect(screen.getByText(cmd('tools', 'graph'))).toBeInTheDocument())

      fireEvent.change(screen.getByPlaceholderText('placeholder'), {
        target: { value: 'scopes.tools' },
      })

      await waitFor(() => expect(screen.getByText(cmd('tools', 'graph'))).toBeInTheDocument())
      expect(screen.getByText(cmd('tools', 'toc'))).toBeInTheDocument()
      // ...and only that scope: the explorer's commands are filtered out.
      expect(screen.queryByText(cmd('explorer', 'toggleLeft'))).not.toBeInTheDocument()
      state.pathname = '/en'
    })

    it('still finds a command by its action alone', async () => {
      // The prefix must not cost the old way of searching.
      const { state } = await getRouterMock()
      state.pathname = '/en/notes/some-note'
      renderPalette()
      await waitFor(() => expect(screen.getByText(cmd('tools', 'graph'))).toBeInTheDocument())

      fireEvent.change(screen.getByPlaceholderText('placeholder'), {
        target: { value: 'graph' },
      })

      await waitFor(() => expect(screen.getByText(cmd('tools', 'graph'))).toBeInTheDocument())
      state.pathname = '/en'
    })

    it('offers the knowledge graph, which had no palette entry at all', async () => {
      // The tools-panel graph shows the open note's neighbourhood; this is
      // the whole-garden one. It was reachable from the header and the index
      // action row, and from nowhere a reader would think to look for it.
      const { state } = await getRouterMock()
      state.pathname = '/en/notes/some-note'
      renderPalette()
      await waitFor(() => expect(screen.getByText(cmd('garden', 'globalGraph'))).toBeInTheDocument())
      state.pathname = '/en'
    })

    it('navigates to the graph when that command is selected', async () => {
      const { router, state } = await getRouterMock()
      state.pathname = '/en/notes/some-note'
      renderPalette()
      await waitFor(() => expect(screen.getByText(cmd('garden', 'globalGraph'))).toBeInTheDocument())

      fireEvent.click(screen.getByText(cmd('garden', 'globalGraph')))
      // The page itself claims the tab on arrival via RouteTabSync, so
      // navigating is the whole job.
      expect(router.push).toHaveBeenCalledWith('/en/notes/graph')
      state.pathname = '/en'
    })

    it('keeps the graph command out of the landing page', async () => {
      const { state } = await getRouterMock()
      state.pathname = '/en'
      renderPalette()
      await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument())
      // It would still work off a garden route, but a command that navigates
      // into the garden belongs with the garden's other commands rather than
      // duplicating the Navigation group.
      expect(screen.queryByText(cmd('garden', 'globalGraph'))).not.toBeInTheDocument()
    })

    it('finds a command whose words the reader typed out of order', async () => {
      // The palette used to match the query as one contiguous substring of
      // the whole label, so anything but the author's exact phrasing found
      // nothing — in the real catalogue, "search notes" missed
      // `Explorer: Search in notes` over the preposition between them, and
      // the command read as missing. (The real labels are asserted in
      // tests/lib/shortcuts; next-intl returns keys verbatim here.)
      const { state } = await getRouterMock()
      state.pathname = '/en/notes/some-note'
      renderPalette()
      await waitFor(() => expect(screen.getByText(cmd('explorer', 'search'))).toBeInTheDocument())

      fireEvent.change(screen.getByPlaceholderText('placeholder'), {
        target: { value: 'search scopes.explorer' },
      })

      await waitFor(() => expect(screen.getByText(cmd('explorer', 'search'))).toBeInTheDocument())
      state.pathname = '/en'
    })

    it('runs the action when a command is selected', async () => {
      const { state } = await getRouterMock()
      state.pathname = '/en/notes/some-note'
      renderPalette()
      await waitFor(() => expect(screen.getByText(cmd('explorer', 'toggleLeft'))).toBeInTheDocument())
      const before = usePanelStore.getState().leftOpen
      fireEvent.click(screen.getByText(cmd('explorer', 'toggleLeft')))
      expect(usePanelStore.getState().leftOpen).toBe(!before)
      state.pathname = '/en'
    })
  })

  it('renders results once the index has loaded', async () => {
    renderPalette()
    await waitFor(() => {
      expect(screen.getByText('Kotlin')).toBeInTheDocument()
    })
  })

  it('filters by parent:filter syntax', async () => {
    renderPalette()
    await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('placeholder'), {
      target: { value: 'parent:Frontend' },
    })
    await waitFor(() => {
      expect(screen.queryByText('Kotlin')).not.toBeInTheDocument()
      expect(screen.getByText('Next.js')).toBeInTheDocument()
    })
  })

  it('Enter on a highlighted note navigates via router', async () => {
    const { router } = await getRouterMock()
    renderPalette()
    await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument())
    const input = screen.getByPlaceholderText('placeholder')
    fireEvent.change(input, { target: { value: 'kotlin' } })
    await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'Enter' })
    // The first note result is highlighted after typing — Enter routes to it.
    expect(router.push).toHaveBeenCalledWith(expect.stringContaining('/en/notes/'))
  })

  it('Ctrl+Enter pins a note as a new tab and navigates', async () => {
    const { router } = await getRouterMock()
    renderPalette()
    await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument())
    const input = screen.getByPlaceholderText('placeholder')
    fireEvent.change(input, { target: { value: 'kotlin' } })
    await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument())
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    expect(router.push).toHaveBeenCalled()
    expect(useTabStore.getState().tabs.length).toBeGreaterThan(0)
  })

  it('Escape closes the palette', async () => {
    renderPalette()
    await waitFor(() => expect(screen.getByText('Kotlin')).toBeInTheDocument())
    fireEvent.keyDown(screen.getByPlaceholderText('placeholder'), { key: 'Escape' })
    expect(useSearchStore.getState().isOpen).toBe(false)
  })
})
