/**
 * Content negotiation for note pages, on Cloudflare Pages.
 *
 * `GET /en/notes/kotlin/` with `Accept: text/markdown` returns the markdown
 * mirror; every other request gets the HTML exactly as before. This is the
 * one agent-facing behaviour a static export cannot produce by itself — a
 * file server answers per URL, and negotiation is per *request*.
 *
 * Cloudflare sells a zone-level "Markdown for Agents" feature that does this
 * by converting your HTML on the fly. This is deliberately not that: onvu
 * already builds a better mirror than any converter could, with frontmatter,
 * resolved wiki links, parents and backlinks. Negotiation here just hands
 * over the good one.
 *
 * **This directory is the switch.** There is no config flag, because the
 * file's presence is what makes Cloudflare route these paths through a
 * Worker, and a setting that claimed to turn that off would be lying. Delete
 * `functions/` if you would rather note pages be served straight from the
 * edge. On any host that is not Cloudflare Pages it is already inert.
 *
 * It needs no configuration either. When markdown mirrors are switched off
 * there is no `.md` to serve, the lookup 404s, and the request falls through
 * to HTML — so this is correct whether or not `agents.markdown` is enabled,
 * and stays correct if that changes later.
 */

/**
 * Minimal shape of the Pages Functions context. Typed here rather than
 * pulling in `@cloudflare/workers-types` for two fields — `next()` forwards
 * to the static asset server, optionally for a different path.
 */
interface PagesContext {
  request: Request
  next: () => Promise<Response>
  /**
   * Direct access to the static assets. Used instead of `next(path)` for the
   * mirror lookup for two reasons: it cannot re-enter this middleware, and
   * `next()` is only safe to call once per request — calling it a second time
   * as a fallback returned the first call's headers, which served the HTML
   * 404 page under a `text/markdown` content type.
   */
  env?: { ASSETS?: { fetch: (input: string) => Promise<Response> } }
}

/** Markdown spellings seen in the wild; `text/markdown` is the registered one. */
const MARKDOWN_TYPES = ['text/markdown', 'text/x-markdown']
const HTML_TYPES = ['text/html', 'application/xhtml+xml']

/**
 * Does the client actually *prefer* markdown?
 *
 * Not merely "does Accept mention it". Browsers send
 * `text/html,...,*​/*;q=0.8`, and an agent that lists both types while
 * ranking HTML higher means it. Quality values decide; a tie goes to
 * markdown, since asking for it at all is deliberate — no browser does.
 *
 * `text/plain` is excluded on purpose. `curl` sends `*​/*`, but plenty of
 * tooling sends `text/plain` while expecting something human-readable, and
 * quietly swapping the representation on them would be a surprise.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false

  let markdown = -1
  let html = -1

  for (const entry of accept.split(',')) {
    const parts = entry.split(';').map((s) => s.trim().toLowerCase())
    const type = parts[0]
    const quality = parts.slice(1).find((p) => p.startsWith('q='))
    const q = quality === undefined ? 1 : Number.parseFloat(quality.slice(2))
    if (Number.isNaN(q)) continue

    if (MARKDOWN_TYPES.includes(type)) markdown = Math.max(markdown, q)
    if (HTML_TYPES.includes(type)) html = Math.max(html, q)
  }

  return markdown > 0 && markdown >= html
}

/**
 * `/en/notes/kotlin/` → `{ locale: 'en', slug: 'kotlin' }`.
 *
 * Anything deeper, shallower, or already carrying an extension is not a note
 * page. `graph` is a route that lives under `/notes/` without being a note,
 * so it is excluded here rather than left to 404 into the fallback.
 */
export function noteSlug(pathname: string): { locale: string; slug: string } | null {
  const match = /^\/([^/]+)\/notes\/([^/]+?)\/?$/.exec(pathname)
  if (!match) return null
  const locale = match[1]
  const slug = match[2]
  if (slug === 'graph' || slug.includes('.')) return null
  return { locale, slug }
}

/**
 * `Vary: Accept` on *every* response from these routes, not just negotiated
 * ones.
 *
 * Without it a shared cache that stored the HTML would keep serving it to an
 * agent asking for markdown and — worse — could serve markdown to a browser.
 * The header is what makes two representations of one URL cacheable at all.
 */
function withVary(response: Response): Response {
  const out = new Response(response.body, response)
  const existing = out.headers.get('Vary')
  if (existing === null) out.headers.set('Vary', 'Accept')
  else if (!/\baccept\b/i.test(existing)) out.headers.set('Vary', `${existing}, Accept`)
  return out
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, next, env } = context

  const url = new URL(request.url)
  const note = noteSlug(url.pathname)
  const assets = env?.ASSETS

  if (note !== null && assets !== undefined && prefersMarkdown(request.headers.get('Accept'))) {
    const mirror = `/${note.locale}/notes/${note.slug}.md`
    const response = await assets.fetch(new URL(mirror, url).toString())

    // Anything but a hit — mirrors switched off, a note excluded by
    // `noindex`, a slug that never existed — falls through to the HTML below,
    // so a miss is answered by the normal page (or the normal 404) rather
    // than by a 404 body wearing a markdown content type.
    if (response.ok) {
      const out = new Response(response.body, response)
      out.headers.set('Content-Type', 'text/markdown; charset=utf-8')
      // Names the URL this body actually came from, so a client wanting to
      // cache or cite the mirror need not reconstruct it.
      out.headers.set('Content-Location', mirror)
      return withVary(out)
    }
  }

  return withVary(await next())
}
