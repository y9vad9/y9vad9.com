import { describe, it, expect, vi } from 'vitest'
import {
  buildWebMcpTools,
  findModelContextHost,
  registerWebMcpTools,
  type WebMcpTool,
} from '@lib/agents/webmcp'

const INDEX = [
  { slug: 'kotlin', title: 'Kotlin', preview: 'Everything about Kotlin', rawText: 'hub note' },
  {
    slug: 'deep-modules',
    title: 'Deep Modules',
    preview: 'On interface depth.',
    rawText: 'A deep module hides a lot behind a small interface. Written in Kotlin.',
  },
  {
    slug: 'semantic-typing',
    title: 'Semantic Typing We Ignore',
    preview: 'Types as concepts.',
    rawText: 'Stop calling it a string.',
  },
]

function ctx(overrides: Partial<Parameters<typeof buildWebMcpTools>[0]> = {}) {
  return {
    locale: 'en',
    searchIndexUrl: '/_static/en/search-index.json',
    noteUrl: (slug: string) => `https://example.com/en/notes/${slug}/`,
    mirrorUrl: (slug: string) => `https://example.com/en/notes/${slug}.md`,
    fetchJson: async () => INDEX,
    ...overrides,
  }
}

function tool(name: string, c = ctx()): WebMcpTool {
  const hit = buildWebMcpTools(c).find((t) => t.name === name)
  expect(hit, `tool ${name} must exist`).toBeDefined()
  return hit!
}

async function run(name: string, params: Record<string, unknown>, c = ctx()): Promise<string> {
  const result = await tool(name, c).execute(params)
  return result.content.map((p) => p.text).join('\n')
}

describe('buildWebMcpTools', () => {
  it('exposes exactly the read-only tools a garden can answer', () => {
    expect(buildWebMcpTools(ctx()).map((t) => t.name)).toEqual([
      'search_notes',
      'list_notes',
      'get_note',
    ])
  })

  it('declares required params so an agent need not guess the call shape', () => {
    expect(tool('search_notes').inputSchema.required).toEqual(['query'])
    expect(tool('get_note').inputSchema.required).toEqual(['slug'])
    expect(tool('list_notes').inputSchema.required).toBeUndefined()
  })

  it('returns the MCP content envelope, not a bare string', () => {
    expect(tool('list_notes').execute({})).resolves.toMatchObject({
      content: [{ type: 'text' }],
    })
  })
})

describe('search_notes', () => {
  it('ranks an exact title match above a body mention of the same word', () => {
    // "Kotlin" appears in the body of Deep Modules; the note actually titled
    // Kotlin is the one being asked about.
    return expect(run('search_notes', { query: 'Kotlin' })).resolves.toMatch(
      /## Kotlin[\s\S]*## Deep Modules/,
    )
  })

  it('gives each hit a canonical URL and a markdown URL', async () => {
    const out = await run('search_notes', { query: 'deep modules' })
    expect(out).toContain('URL: https://example.com/en/notes/deep-modules/')
    expect(out).toContain('Markdown: https://example.com/en/notes/deep-modules.md')
  })

  it('omits the markdown line when mirrors are not published', async () => {
    const out = await run('search_notes', { query: 'deep' }, ctx({ mirrorUrl: null }))
    expect(out).toContain('URL: ')
    expect(out).not.toContain('Markdown: ')
  })

  it('says so plainly when nothing matches', () => {
    return expect(run('search_notes', { query: 'zzzz' })).resolves.toContain('No notes match')
  })

  it('rejects an empty query instead of returning the whole site', () => {
    return expect(run('search_notes', { query: '   ' })).resolves.toContain('non-empty')
  })

  it('honours limit and caps it so one call cannot pull the whole corpus', async () => {
    const one = await run('search_notes', { query: 'a', limit: 1 })
    expect(one.match(/^## /gm) ?? []).toHaveLength(1)
    const capped = await run('search_notes', { query: 'a', limit: 9999 })
    expect((capped.match(/^## /gm) ?? []).length).toBeLessThanOrEqual(25)
  })

  it('is case-insensitive', () => {
    return expect(run('search_notes', { query: 'DEEP MODULES' })).resolves.toContain(
      '## Deep Modules',
    )
  })
})

describe('get_note', () => {
  it('returns the note body with both URLs', async () => {
    const out = await run('get_note', { slug: 'deep-modules' })
    expect(out).toContain('# Deep Modules')
    expect(out).toContain('https://example.com/en/notes/deep-modules.md')
    expect(out).toContain('small interface')
  })

  it('points an agent at list_notes rather than failing silently', () => {
    return expect(run('get_note', { slug: 'nope' })).resolves.toContain('list_notes')
  })

  it('accepts a slug in any case', () => {
    return expect(run('get_note', { slug: 'Deep-Modules' })).resolves.toContain('# Deep Modules')
  })
})

describe('list_notes', () => {
  it('lists every note alphabetically with its URL', async () => {
    const out = await run('list_notes', {})
    expect(out.split('\n')).toHaveLength(3)
    expect(out.startsWith('- Deep Modules — https://example.com/en/notes/deep-modules/')).toBe(true)
  })

  it('handles an empty site without crashing', () => {
    return expect(run('list_notes', {}, ctx({ fetchJson: async () => [] }))).resolves.toContain(
      'no notes',
    )
  })

  it('survives an index that is not an array', () => {
    return expect(
      run('list_notes', {}, ctx({ fetchJson: async () => ({ oops: true }) })),
    ).resolves.toContain('no notes')
  })
})

describe('findModelContextHost', () => {
  it('prefers document.modelContext — where Chrome 150 moved it', () => {
    const doc = { modelContext: { id: 'doc' } }
    const nav = { modelContext: { id: 'nav' } }
    expect(findModelContextHost({ document: doc, navigator: nav })).toMatchObject({ id: 'doc' })
  })

  it('falls back to the older navigator.modelContext location', () => {
    expect(findModelContextHost({ navigator: { modelContext: { id: 'nav' } } })).toMatchObject({
      id: 'nav',
    })
  })

  it('returns null in a browser without WebMCP, which is most of them', () => {
    expect(findModelContextHost({ document: {}, navigator: {} })).toBeNull()
    expect(findModelContextHost({})).toBeNull()
  })
})

describe('registerWebMcpTools', () => {
  const tools = buildWebMcpTools(ctx())

  it('registers each tool through the current registerTool API', () => {
    const registerTool = vi.fn()
    expect(registerWebMcpTools({ registerTool }, tools)).toBe(3)
    expect(registerTool).toHaveBeenCalledTimes(3)
  })

  it('passes the abort signal so unmounting tears the tools back down', () => {
    const registerTool = vi.fn()
    const signal = new AbortController().signal
    registerWebMcpTools({ registerTool }, tools, signal)
    expect(registerTool.mock.calls[0][1]).toEqual({ signal })
  })

  it('falls back to the provideContext batch call it replaced', () => {
    const provideContext = vi.fn()
    expect(registerWebMcpTools({ provideContext }, tools)).toBe(3)
    expect(provideContext).toHaveBeenCalledWith({ tools })
  })

  it('does not let one rejected tool take down the rest', () => {
    let n = 0
    const registerTool = vi.fn(() => {
      if (++n === 1) throw new Error('unsupported schema')
    })
    expect(registerWebMcpTools({ registerTool }, tools)).toBe(2)
  })

  it('no-ops on a host with neither API, and on no host at all', () => {
    expect(registerWebMcpTools({}, tools)).toBe(0)
    expect(registerWebMcpTools(null, tools)).toBe(0)
  })
})
