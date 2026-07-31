/**
 * WebMCP — tools a browser-resident agent can call on this page.
 *
 * Everything else under `agents/` is a *file*: llms.txt, markdown mirrors,
 * robots directives. Those reach any agent that can make an HTTP request,
 * which is the overwhelming majority of them. This module is the one surface
 * that only reaches an agent running inside the user's browser, and it is
 * worth being clear-eyed about that trade before switching it on.
 *
 * A caveat on stability, since it affects how this is written: the spec moved
 * twice in 2026 — `provideContext()` was removed in March in favour of
 * `registerTool()`, and the entry point moved from `navigator.modelContext`
 * to `document.modelContext` in Chrome 150. So registration probes for what
 * the browser actually exposes rather than assuming a shape, and no-ops when
 * it finds nothing. A site that opts in and later meets a browser that moved
 * on again gets silence, not a broken page.
 */

export interface WebMcpToolResult {
  content: Array<{ type: 'text'; text: string }>
}

export interface WebMcpTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
  execute: (params: Record<string, unknown>) => Promise<WebMcpToolResult>
}

/** One entry of `/_static/<locale>/search-index.json`. */
interface IndexEntry {
  slug: string
  title: string
  preview: string
  rawText: string
}

export interface WebMcpContext {
  locale: string
  searchIndexUrl: string
  noteUrl: (slug: string) => string
  /** Mirror URL builder, or null when markdown mirrors are not published. */
  mirrorUrl: ((slug: string) => string) | null
  fetchJson: (url: string) => Promise<unknown>
}

function text(value: string): WebMcpToolResult {
  return { content: [{ type: 'text', text: value }] }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Rank by where the match landed, not just whether it did.
 *
 * A note whose *title* is the query is almost always the one being asked
 * about; a note that merely says the word somewhere in its body usually
 * isn't. Without this the short hub notes ("Kotlin", "Meta") drown out
 * everything, which is the same failure mode that made unlinked mentions
 * unusable elsewhere in this codebase.
 */
function score(entry: IndexEntry, query: string): number {
  const q = query.toLowerCase()
  const title = entry.title.toLowerCase()
  if (title === q) return 100
  if (title.startsWith(q)) return 50
  if (title.includes(q)) return 25
  if (entry.preview.toLowerCase().includes(q)) return 10
  if (entry.rawText.toLowerCase().includes(q)) return 1
  return 0
}

/** A result line an agent can act on without a second lookup. */
function describe(entry: IndexEntry, ctx: WebMcpContext): string {
  const lines = [`## ${entry.title}`, `URL: ${ctx.noteUrl(entry.slug)}`]
  if (ctx.mirrorUrl) lines.push(`Markdown: ${ctx.mirrorUrl(entry.slug)}`)
  if (entry.preview) lines.push('', entry.preview)
  return lines.join('\n')
}

export function buildWebMcpTools(ctx: WebMcpContext): WebMcpTool[] {
  const load = async (): Promise<IndexEntry[]> => {
    const data = await ctx.fetchJson(ctx.searchIndexUrl)
    if (!Array.isArray(data)) return []
    return data
      .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
      .map((e) => ({
        slug: asString(e.slug),
        title: asString(e.title),
        preview: asString(e.preview),
        rawText: asString(e.rawText),
      }))
      .filter((e) => e.slug !== '' && e.title !== '')
  }

  return [
    {
      name: 'search_notes',
      description:
        'Full-text search across every note published on this site, ranked by ' +
        'relevance. Returns each match with its title, canonical URL and a ' +
        'short preview. Use this before guessing a URL.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words or phrase to search for.' },
          limit: { type: 'number', description: 'Maximum results (default 5).' },
        },
        required: ['query'],
      },
      execute: async (params) => {
        const query = asString(params.query).trim()
        if (!query) return text('Provide a non-empty `query`.')
        const limit =
          typeof params.limit === 'number' && params.limit > 0
            ? Math.min(Math.floor(params.limit), 25)
            : 5

        const hits = (await load())
          .map((entry) => ({ entry, rank: score(entry, query) }))
          .filter((h) => h.rank > 0)
          .sort((a, b) => b.rank - a.rank || a.entry.title.localeCompare(b.entry.title))
          .slice(0, limit)

        if (hits.length === 0) return text(`No notes match "${query}".`)
        return text(hits.map((h) => describe(h.entry, ctx)).join('\n\n'))
      },
    },
    {
      name: 'list_notes',
      description:
        'List every note on this site with its title and canonical URL. Use ' +
        'this to see what exists before searching.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const notes = await load()
        if (notes.length === 0) return text('This site publishes no notes.')
        return text(
          notes
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((n) => `- ${n.title} — ${ctx.noteUrl(n.slug)}`)
            .join('\n'),
        )
      },
    },
    {
      name: 'get_note',
      description:
        'Read the full text of one note by its slug, as it appears in the URL ' +
        '(for example "deep-modules" for /notes/deep-modules).',
      inputSchema: {
        type: 'object',
        properties: { slug: { type: 'string', description: 'The note slug from its URL.' } },
        required: ['slug'],
      },
      execute: async (params) => {
        const slug = asString(params.slug).trim().toLowerCase()
        if (!slug) return text('Provide a non-empty `slug`.')
        const hit = (await load()).find((n) => n.slug.toLowerCase() === slug)
        if (!hit) {
          return text(`No note with slug "${slug}". Call list_notes to see what exists.`)
        }
        const header = ctx.mirrorUrl
          ? `# ${hit.title}\n\nURL: ${ctx.noteUrl(hit.slug)}\nMarkdown: ${ctx.mirrorUrl(hit.slug)}`
          : `# ${hit.title}\n\nURL: ${ctx.noteUrl(hit.slug)}`
        return text(`${header}\n\n${hit.rawText}`)
      },
    },
  ]
}

interface ModelContextHost {
  registerTool?: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => unknown
  provideContext?: (context: { tools: WebMcpTool[] }) => unknown
}

/**
 * Find whichever `modelContext` this browser exposes.
 *
 * `document` first: that is where Chrome 150 moved it, and where the spec
 * settled. `navigator` is the older location, kept because browsers that
 * shipped the earlier draft still work.
 */
export function findModelContextHost(scope: {
  document?: unknown
  navigator?: unknown
}): ModelContextHost | null {
  for (const carrier of [scope.document, scope.navigator]) {
    if (typeof carrier !== 'object' || carrier === null) continue
    const host = (carrier as { modelContext?: unknown }).modelContext
    if (typeof host === 'object' && host !== null) return host as ModelContextHost
  }
  return null
}

/**
 * Register the tools, returning how many the host accepted.
 *
 * Handles both generations of the API: `registerTool` per tool (current), and
 * the `provideContext({ tools })` batch call it replaced. Returns 0 rather
 * than throwing when neither is present, so the caller can stay indifferent.
 */
export function registerWebMcpTools(
  host: ModelContextHost | null,
  tools: WebMcpTool[],
  signal?: AbortSignal,
): number {
  if (!host) return 0

  if (typeof host.registerTool === 'function') {
    let registered = 0
    for (const tool of tools) {
      try {
        host.registerTool(tool, signal ? { signal } : undefined)
        registered++
      } catch {
        // One malformed tool must not take the rest down with it.
      }
    }
    return registered
  }

  if (typeof host.provideContext === 'function') {
    try {
      host.provideContext({ tools })
      return tools.length
    } catch {
      return 0
    }
  }

  return 0
}
