/**
 * Site-root-relative path → a URL that survives a subpath deployment.
 *
 * Next prefixes `basePath` onto `<Link href>`, `router.push()` and
 * `next/image` sources by itself. It does **not** touch string URLs handed to
 * `fetch()`, `new URL()`, `window.location.origin + …`, or anything a rehype
 * plugin writes straight into HTML. Those are exactly the URLs this template
 * builds by hand — the static search index, the API routes, the generated
 * asset paths, the giscus stylesheet — so a site served from
 * `example.com/notes/` fetched every one of them from the domain root and got
 * a 404 apiece.
 *
 * Read from `NEXT_PUBLIC_BASE_PATH` rather than Next's own config because
 * `next.config.ts` is not importable from the browser bundle. The two are
 * wired to the same value there, so they cannot drift.
 *
 * Deliberately *not* for values that already went through Next: feeding an
 * `href` read back off the DOM through this would prefix it a second time.
 * That class of bug is why `useNoteLinkClick`, `RouteLink` and
 * `ArticleEnhancer` read `getAttribute('href')` and pass it to `router.push`
 * untouched — Next strips its own prefix on the way in and re-adds it on the
 * way out.
 */
export const BASE_PATH: string = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(
  /\/+$/,
  '',
)

export function publicPath(path: string): string {
  if (!BASE_PATH) return path
  // Absolute URLs and data/blob URIs are already complete.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * The site's own origin *including* any base path, for values that must be
 * absolute — a clipboard URL, a `<link>` an external service will resolve.
 */
export function publicOrigin(): string {
  if (typeof window === 'undefined') return BASE_PATH
  return `${window.location.origin}${BASE_PATH}`
}
