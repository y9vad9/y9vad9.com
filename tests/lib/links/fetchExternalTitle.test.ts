import { describe, it, expect, vi, beforeEach } from 'vitest'

// Each test resets vi.mocks() (see tests/setup.ts), so we can stub fetch
// per-case. We import the module fresh inside each block to get a clean
// title cache — the cache is module-scoped so it persists across calls
// within one test file load.
async function importFresh(fetchExternalTitles = true) {
  vi.resetModules()
  // The fetcher is off unless the site opts in — an unconditional network call
  // per external link made every build depend on third-party uptime. These
  // cases are about the parsing, so they opt in.
  const actual = await vi.importActual<typeof import('~/site.config')>('~/site.config')
  vi.doMock('~/site.config', () => ({
    config: { ...actual.config, links: { fetchExternalTitles } },
  }))
  return await import('@lib/links/fetchExternalTitle')
}

describe('fetchExternalTitle', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('makes no network call unless the site opts in', async () => {
    const { fetchExternalTitle } = await importFresh(false)
    expect(await fetchExternalTitle('https://example.com')).toBeNull()
    // The point of the flag: a build stays hermetic and reproducible, and CI
    // stops pinging every site the author has ever cited.
    expect(fetch).not.toHaveBeenCalled()
  })

  it('extracts <title> when available', async () => {
    const { fetchExternalTitle } = await importFresh()
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      text: async () => '<html><head><title>Example Site</title></head></html>',
    } as Response)
    expect(await fetchExternalTitle('https://example.com')).toBe('Example Site')
  })

  it('prefers Open Graph title over <title>', async () => {
    const { fetchExternalTitle } = await importFresh()
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () =>
        '<head><meta property="og:title" content="The OG One"><title>Fallback</title></head>',
    } as Response)
    expect(await fetchExternalTitle('https://x.example')).toBe('The OG One')
  })

  it('decodes basic HTML entities', async () => {
    const { fetchExternalTitle } = await importFresh()
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<title>A &amp; B &#38; C</title>',
    } as Response)
    expect(await fetchExternalTitle('https://y.example')).toBe('A & B & C')
  })

  it('returns null on non-OK responses', async () => {
    const { fetchExternalTitle } = await importFresh()
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '',
    } as Response)
    expect(await fetchExternalTitle('https://z.example')).toBeNull()
  })

  it('returns null on non-HTML responses', async () => {
    const { fetchExternalTitle } = await importFresh()
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => '{}',
    } as Response)
    expect(await fetchExternalTitle('https://api.example')).toBeNull()
  })

  it('returns null on network errors', async () => {
    const { fetchExternalTitle } = await importFresh()
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network'))
    expect(await fetchExternalTitle('https://nope.example')).toBeNull()
  })

  it('caches results — the second call does not hit the network', async () => {
    const { fetchExternalTitle } = await importFresh()
    const f = vi.mocked(fetch)
    f.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<title>Cached</title>',
    } as Response)
    expect(await fetchExternalTitle('https://cache.example')).toBe('Cached')
    expect(await fetchExternalTitle('https://cache.example')).toBe('Cached')
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('urlLabel', () => {
  it('strips www. and trims trailing slash', async () => {
    const { urlLabel } = await importFresh()
    expect(urlLabel('https://www.example.com/')).toBe('example.com')
  })

  it('preserves path and query when present', async () => {
    const { urlLabel } = await importFresh()
    expect(urlLabel('https://example.com/blog/post')).toBe('example.com/blog/post')
  })

  it('falls back to the raw URL when parsing fails', async () => {
    const { urlLabel } = await importFresh()
    expect(urlLabel('not a url')).toBe('not a url')
  })
})
