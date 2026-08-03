import type { WikiLinkResolver } from '@lib/mdx/pipeline'

/** The only fields a wiki-link target has to expose to be resolvable. */
export interface ResolvableNote {
  slug: string
  title: string
}

/**
 * Fold a wiki-link target into a comparable key: `Deep Modules` → `deep-modules`.
 *
 * Returns the empty string for a title with no ASCII alphanumerics — a
 * Cyrillic or CJK title, say — which is why this is only ever the *last*
 * fallback. Exact slug and exact title matching carry those gardens.
 */
export function normaliseWikiLinkKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/**
 * Resolve `[[Some Target]]` against a set of notes, by slug, then by title,
 * then by normalised key.
 *
 * Lives here rather than inside the filesystem adapter because resolution is
 * not the repository's business — it belongs to anything that renders markdown
 * against a corpus. The garden intro (`content/garden/<locale>.md`) is the
 * case that proved it: it goes through the same pipeline, but the pipeline
 * only installs the wiki-link plugin when handed a resolver, and the intro had
 * no way to get one. So `[[Start Here]]` rendered as literal brackets on the
 * one page whose whole job is pointing readers at entry notes.
 */
export function createWikiLinkResolver(
  notes: Iterable<ResolvableNote>,
): WikiLinkResolver {
  const bySlug = new Map<string, ResolvableNote>()
  const byTitle = new Map<string, ResolvableNote>()
  for (const n of notes) {
    bySlug.set(n.slug.toLowerCase(), n)
    byTitle.set(n.title.toLowerCase(), n)
  }
  return (target) => {
    const hit =
      bySlug.get(target.toLowerCase()) ??
      byTitle.get(target.toLowerCase()) ??
      bySlug.get(normaliseWikiLinkKey(target))
    return hit ? { slug: hit.slug, title: hit.title } : null
  }
}
