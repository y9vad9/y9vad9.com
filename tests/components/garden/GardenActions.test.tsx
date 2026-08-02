import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GardenActions } from '@components/garden/GardenActions'
import { getRouterMock } from '../../utils/nextRouter'
import { usePanelStore } from '@store/panelStore'

// The dynamic icon loader fetches a chunk per name in an effect; jsdom has no
// bundler to serve those. The names are what matters here, not the glyphs.
vi.mock('lucide-react/dynamic', () => ({
  DynamicIcon: ({ name }: { name: string }) => <span data-icon={name} />,
}))

const SLUGS = ['alpha', 'beta', 'gamma']

let writeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function router() {
  const { router } = await getRouterMock()
  return router
}

describe('GardenActions', () => {
  it('renders the built-ins the site asked for, in that order', () => {
    const { container } = render(
      <GardenActions actions={['rss', 'graph', 'random']} locale="en" randomSlugs={SLUGS} />,
    )
    const labels = [...container.querySelectorAll('span.font-medium')].map((n) => n.textContent)
    // Order is the config's. Being able to drop an entry but not move it
    // would be half a feature.
    expect(labels).toEqual(['rssFeed', 'knowledgeGraph', 'randomNote'])
  })

  it('renders nothing at all when the site opts out', () => {
    const { container } = render(
      <GardenActions actions={[]} locale="en" randomSlugs={SLUGS} />,
    )
    // The index hides the section heading separately; this is the component
    // refusing to render an empty grid.
    expect(container.firstChild).toBeNull()
  })

  it('copies the feed URL instead of navigating to it', async () => {
    render(<GardenActions actions={['rss']} locale="uk" randomSlugs={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /rssFeed/ }))

    // Navigating is the bug this replaces: browsers stopped rendering XML
    // feeds, so Firefox downloads the file and Chrome shows raw markup.
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/uk/feed.xml')),
    )
    expect((await router()).push).not.toHaveBeenCalled()
  })

  it('confirms the copy, then reverts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GardenActions actions={['rss']} locale="en" randomSlugs={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /rssFeed/ }))

    await waitFor(() => expect(screen.getByText('copied')).toBeInTheDocument())
    await vi.advanceTimersByTimeAsync(2100)
    await waitFor(() => expect(screen.getByText('rssFeed')).toBeInTheDocument())
    vi.useRealTimers()
  })

  it('drops the random action when nothing is eligible', () => {
    render(<GardenActions actions={['graph', 'random']} locale="en" randomSlugs={[]} />)
    expect(screen.queryByText('randomNote')).not.toBeInTheDocument()
    expect(screen.getByText('knowledgeGraph')).toBeInTheDocument()
  })

  it('routes a custom entry inside the app when the href is a bare path', () => {
    render(
      <GardenActions
        actions={[{ label: 'RSS feeds', href: 'notes/rss', icon: 'rss' }]}
        locale="uk"
        randomSlugs={[]}
      />,
    )
    const link = screen.getByRole('link', { name: /RSS feeds/ })
    expect(link).toHaveAttribute('href', '/uk/notes/rss')
    expect(link).not.toHaveAttribute('target')
    expect(link.querySelector('[data-icon="rss"]')).toBeTruthy()
  })

  it('opens a custom entry externally when the href carries a scheme', () => {
    render(
      <GardenActions
        actions={[{ label: 'Mastodon', href: 'https://example.social/@me' }]}
        locale="en"
        randomSlugs={[]}
      />,
    )
    const link = screen.getByRole('link', { name: /Mastodon/ })
    expect(link).toHaveAttribute('href', 'https://example.social/@me')
    expect(link).toHaveAttribute('target', '_blank')
    // Without this an external tab can reach back through window.opener.
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('survives a clipboard the browser refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<GardenActions actions={['rss']} locale="en" randomSlugs={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /rssFeed/ }))

    // No throw, and it must not fall back to opening the feed.
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(screen.getByText('rssFeed')).toBeInTheDocument()
    expect((await router()).push).not.toHaveBeenCalled()
  })

  it('copies a site-relative value against the deployed origin', async () => {
    render(
      <GardenActions
        actions={[{ label: 'Feed', copy: '/en/feed.xml', icon: 'rss' }]}
        locale="en"
        randomSlugs={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Feed/ }))
    // Config cannot know where the site is deployed, so the origin is joined
    // on at click time rather than baked into the value.
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/en/feed.xml`),
    )
  })

  it('copies an absolute value untouched', async () => {
    render(
      <GardenActions
        actions={[{ label: 'Mail', copy: 'hello@example.com' }]}
        locale="en"
        randomSlugs={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Mail/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('hello@example.com'))
  })

  it('confirms only the action that was copied', async () => {
    render(
      <GardenActions
        actions={[
          { label: 'First', copy: 'a' },
          { label: 'Second', copy: 'b' },
        ]}
        locale="en"
        randomSlugs={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /First/ }))
    // A single shared flag would flip both rows to "Copied!" at once.
    await waitFor(() => expect(screen.getByText('copied')).toBeInTheDocument())
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('runs a garden command', () => {
    usePanelStore.setState({ leftOpen: false })
    render(
      <GardenActions
        actions={[{ label: 'Explorer', command: 'toggleLeft' }]}
        locale="en"
        randomSlugs={[]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Explorer/ }))
    // Dispatches through the same registry the palette and the keyboard use,
    // so the three cannot drift apart on what an id means.
    expect(usePanelStore.getState().leftOpen).toBe(true)
  })
})
