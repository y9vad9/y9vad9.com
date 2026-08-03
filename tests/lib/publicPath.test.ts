import { describe, it, expect, vi, afterEach } from 'vitest'

/**
 * Next prefixes `basePath` onto its own `<Link>`, `router.push()` and
 * `next/image` URLs. It does not touch strings handed to `fetch()`, nor
 * anything a rehype plugin writes into HTML — which is most of the URLs this
 * template builds. Under a subpath deploy every one of them 404'd.
 */
async function load(basePath: string) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_BASE_PATH', basePath)
  return import('@lib/publicPath')
}

afterEach(() => vi.unstubAllEnvs())

describe('publicPath', () => {
  it('is a no-op at the domain root', async () => {
    const { publicPath } = await load('')
    expect(publicPath('/_static/en/search-index.json')).toBe(
      '/_static/en/search-index.json',
    )
  })

  it('prefixes a site-root path under a subpath deploy', async () => {
    const { publicPath } = await load('/notes')
    expect(publicPath('/_static/en/search-index.json')).toBe(
      '/notes/_static/en/search-index.json',
    )
    expect(publicPath('/api/search?q=x')).toBe('/notes/api/search?q=x')
  })

  it('leaves absolute URLs alone', async () => {
    const { publicPath } = await load('/notes')
    // The giscus stylesheet and any external asset must not be rewritten.
    expect(publicPath('https://giscus.app/x.css')).toBe('https://giscus.app/x.css')
    expect(publicPath('//cdn.example.com/a.js')).toBe('//cdn.example.com/a.js')
    expect(publicPath('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA')
  })

  it('tolerates a trailing slash in the configured value', async () => {
    const { publicPath } = await load('/notes/')
    expect(publicPath('/a')).toBe('/notes/a')
  })

  it('never doubles the prefix on an already-prefixed value', async () => {
    const { publicPath } = await load('/notes')
    // The subtle failure class: feeding a value Next already prefixed back
    // through here. Callers must not, so this documents the boundary — a path
    // that starts with the base path is still prefixed, by design, because the
    // function cannot tell "/notes/a" the route from "/notes/a" the asset.
    expect(publicPath('/a')).toBe('/notes/a')
  })

  it('builds an absolute origin including the subpath', async () => {
    const { publicOrigin } = await load('/notes')
    vi.stubGlobal('window', { location: { origin: 'https://example.com' } })
    // Used for clipboard URLs and the giscus stylesheet — values that leave
    // the page and must resolve from outside it.
    expect(publicOrigin()).toBe('https://example.com/notes')
    vi.unstubAllGlobals()
  })
})
