/**
 * Treats any href that has a scheme (`http://`, `https://`, `mailto:`, `tel:`)
 * or a protocol-relative prefix (`//`) as external. Site-relative paths
 * (`/notes`), hashes (`#section`), and bare strings are internal.
 */
export function isExternalHref(href: string): boolean {
  if (!href) return false
  if (href.startsWith('//')) return true
  return /^[a-z][a-z0-9+.-]*:/i.test(href)
}

/**
 * Last path segment of a route, ignoring a trailing slash and any query or
 * hash.
 *
 * The static export sets `trailingSlash: true`, so in production
 * `usePathname()` hands back `/en/notes/foo/` where the dev server gives
 * `/en/notes/foo`. A plain `pathname.split('/').pop()` therefore returned
 * `''` on the deployed site and every "is this the current note?" check
 * silently failed — the left panel highlighted nothing at all. Route
 * comparisons must go through here so both modes agree.
 */
export function slugFromPathname(pathname: string): string {
  if (!pathname) return ''
  const path = pathname.split(/[?#]/)[0]
  const segments = path.split('/').filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : ''
}
