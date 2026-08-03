import { routing } from '@i18n/routing'
import type { Note } from '@core/Note'
import type { SiteConfig } from '@config/site'
import { absoluteUrl, localizedPath, noteUrl, siteUrl } from './url'
import { resolveAgentsConfig, markdownMirrorPath } from '@lib/agents/config'

/**
 * Every builder that needs owner or SEO data takes the *resolved* config —
 * `loadSiteConfig(locale)`, not the base `~/site.config` import.
 *
 * This module used to import the base config directly, so `site.uk.config.ts`
 * reached `<meta name="description">` and not the JSON-LD `description` beside
 * it: the same page declared `inLanguage: "uk"` and then served the English
 * bio. `metadata.ts` documents fixing exactly this for `<head>`; the structured
 * data was never brought along. Taking the config as an argument rather than
 * awaiting it here keeps these pure and testable, and makes the omission a
 * type error rather than a silent English fallback.
 */
type JsonLd = Record<string, unknown>

/** Minimal note reference for the relationship fields below. */
export interface NoteRef {
  slug: string
  title: string
}

export function websiteJsonLd(locale: string, siteConfig: SiteConfig): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.owner.name,
    url: absoluteUrl(localizedPath(locale, '/')),
    inLanguage: locale,
    description: siteConfig.owner.bio,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absoluteUrl(localizedPath(locale, '/notes'))}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function personJsonLd(siteConfig: SiteConfig, topics: string[] = []): JsonLd {
  const cfg = resolveAgentsConfig()
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: siteConfig.owner.name,
    url: siteUrl(),
    image: absoluteUrl(siteConfig.owner.profileImage),
    description: siteConfig.owner.bio,
    sameAs: siteConfig.owner.socials.map((s) => s.url),
    // The other half of the expertise claim `sameAs` starts: who the author
    // is, and what they actually write about. Aggregated from note tags.
    ...(cfg.schema.knowsAbout && topics.length > 0 ? { knowsAbout: topics } : {}),
  }
}

export function organizationJsonLd(siteConfig: SiteConfig): JsonLd | null {
  const org = siteConfig.seo?.organization
  if (!org) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: siteUrl(),
    logo: absoluteUrl(org.logo),
    sameAs: siteConfig.owner.socials.map((s) => s.url),
  }
}

export interface BreadcrumbItem {
  name: string
  href: string
}

export function breadcrumbsJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  }
}

/**
 * Extra `Article` fields describing relationships onvu already computes but
 * never expressed machine-readably. Each is opt-in via `agents.schema`.
 *
 * Worth being precise about the payoff: Google says structured data "isn't
 * required for generative AI search" and there's "no special schema.org
 * markup you need to add". So this is not a citation lever. It's here
 * because the data is already on hand, the statements are simply true, and
 * anything that *does* parse JSON-LD (Bing, RAG pipelines, an agent reading
 * the page) gets the site's structure for free instead of inferring it.
 */
function articleRelationships(
  note: Note,
  locale: string,
  ctx: { seriesNotes?: NoteRef[]; mentions?: NoteRef[] },
): JsonLd {
  const cfg = resolveAgentsConfig()
  const out: JsonLd = {}

  if (cfg.schema.series && note.series) {
    out.isPartOf = {
      '@type': 'CreativeWorkSeries',
      name: note.series,
      ...(ctx.seriesNotes && ctx.seriesNotes.length > 0
        ? {
            hasPart: ctx.seriesNotes.map((n) => ({
              '@type': 'Article',
              '@id': noteUrl(locale, n.slug),
              name: n.title,
            })),
          }
        : {}),
    }
    if (note.order !== null) out.position = note.order
  }

  if (cfg.schema.mentions && ctx.mentions && ctx.mentions.length > 0) {
    // Straight from the wiki-link graph — the defining structure of a
    // digital garden, and otherwise invisible to anything but a human reader.
    out.mentions = ctx.mentions.map((n) => ({
      '@type': 'Article',
      '@id': noteUrl(locale, n.slug),
      name: n.title,
    }))
  }

  if (cfg.schema.citations) {
    const external = note.outgoingLinks.filter((l) => l.kind === 'external')
    if (external.length > 0) {
      out.citation = external.map((l) => ({
        '@type': 'CreativeWork',
        url: l.kind === 'external' ? l.href : undefined,
      }))
    }
  }

  if (cfg.discovery.jsonLdEncoding && !note.noindex) {
    // schema.org defines `encoding` as "a media object that encodes this
    // CreativeWork" — exactly what a markdown mirror is.
    out.encoding = {
      '@type': 'MediaObject',
      encodingFormat: 'text/markdown',
      contentUrl: absoluteUrl(markdownMirrorPath(locale, note.slug)),
    }
  }

  return out
}

/**
 * A note as a `DefinedTerm` in the site's glossary. A garden note that
 * explains a concept *is* a defined term, and the garden as a whole is the
 * term set — so the mapping costs nothing beyond saying it out loud.
 */
export function definedTermJsonLd(
  note: Note,
  locale: string,
  siteConfig: SiteConfig,
): JsonLd | null {
  if (!resolveAgentsConfig().schema.definedTerms) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${noteUrl(locale, note.slug)}#term`,
    name: note.title,
    description: note.description ?? note.preview,
    url: noteUrl(locale, note.slug),
    termCode: note.slug,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      '@id': `${absoluteUrl(localizedPath(locale, '/notes'))}#glossary`,
      name: `${siteConfig.owner.name} — notes`,
      url: absoluteUrl(localizedPath(locale, '/notes')),
    },
  }
}

export function articleJsonLd(
  note: Note,
  locale: string,
  siteConfig: SiteConfig,
  ctx: { seriesNotes?: NoteRef[]; mentions?: NoteRef[] } = {},
): JsonLd {
  const authorName = note.author ?? siteConfig.owner.name
  const url = noteUrl(locale, note.slug)
  const image = note.ogImage
    ? absoluteUrl(note.ogImage)
    : note.coverImage
      ? absoluteUrl(note.coverImage)
      : absoluteUrl(`${localizedPath(locale, `/notes/${note.slug}`)}/opengraph-image`)
  const orgName = siteConfig.seo?.organization?.name

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: note.title,
    description: note.description ?? note.preview,
    image: [image],
    datePublished: note.date?.toISOString(),
    dateModified: (note.updated ?? note.date)?.toISOString(),
    author: {
      '@type': 'Person',
      name: authorName,
      url: siteUrl(),
    },
    publisher: orgName
      ? {
          '@type': 'Organization',
          name: orgName,
          logo: {
            '@type': 'ImageObject',
            url: absoluteUrl(siteConfig.seo!.organization!.logo),
          },
        }
      : {
          '@type': 'Person',
          name: authorName,
        },
    keywords: note.tags.length > 0 ? note.tags.join(', ') : undefined,
    articleSection: note.parents.length > 0 ? note.parents : undefined,
    inLanguage: locale,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    url,
    ...articleRelationships(note, locale, ctx),
  }
}

export interface NoteSummary {
  slug: string
  title: string
  date: Date | null
}

export function itemListJsonLd(
  notes: NoteSummary[],
  locale: string,
  name: string,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: notes.map((n, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: noteUrl(locale, n.slug),
      name: n.title,
    })),
  }
}

export function collectionPageJsonLd(
  locale: string,
  notes: NoteSummary[],
  name: string,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url: absoluteUrl(localizedPath(locale, '/notes')),
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', url: absoluteUrl(localizedPath(locale, '/')) },
    mainEntity: itemListJsonLd(notes, locale, name),
  }
}

export const ROUTING = routing
