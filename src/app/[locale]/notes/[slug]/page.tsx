import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { createRepository } from '@adapters/createRepositories'
import { getNote } from '@core/GetNote'
import { preload } from 'react-dom'
import { MONO_FONT_URL, needsMonoFont } from '@lib/fonts/monoFont'
import { listAllNotes } from '@core/ListNotes'
import { getSeriesNavigation } from '@core/GetSeriesNavigation'
import { getMentions } from '@core/GetMentions'
import { getRelatedNotes } from '@core/GetRelatedNotes'
import { NoteArticle } from '@components/garden/NoteArticle'
import { NoteContextProvider } from '@components/garden/NoteContextProvider'
import { loadSiteConfig } from '@lib/config/loadConfig'
import { routing } from '@i18n/routing'
import type { Note } from '@core/Note'
import { JsonLd } from '@components/seo/JsonLd'
import { baseMetadata } from '@lib/seo/metadata'
import { localesForNote } from '@lib/seo/availableLocales'
import { articleJsonLd, breadcrumbsJsonLd, definedTermJsonLd } from '@lib/seo/jsonLd'
import { fetchExternalTitle, urlLabel } from '@lib/links/fetchExternalTitle'
import { resolveAgentsConfig, markdownMirrorPath } from '@lib/agents/config'
import { absoluteUrl } from '@lib/seo/url'

export async function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = []
  for (const locale of routing.locales) {
    const notes = await listAllNotes(createRepository(locale))
    for (const n of notes) params.push({ locale, slug: n.slug })
  }
  return params
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const [repo, siteConfig] = [createRepository(locale), await loadSiteConfig(locale)]
  const note = await getNote(repo, slug)
  if (!note) return {}

  const base = await baseMetadata({
    locale,
    path: `/notes/${slug}`,
    // Only the locales this note is actually written in — an untranslated
    // note used to advertise alternates that 404.
    availableLocales: await localesForNote(slug),
  })
  const description = note.description ?? note.preview
  const image = note.ogImage ?? note.coverImage ?? undefined
  const authorName = note.author ?? siteConfig.owner.name

  // Point agents at the markdown mirror without showing readers anything.
  // `rel="alternate"` is the same mechanism RSS autodiscovery has used for
  // twenty years, so an agent never has to guess the `.md` URL exists.
  const agents = resolveAgentsConfig()
  const markdownAlternate =
    agents.discovery.linkAlternate && !note.noindex
      ? { 'text/markdown': absoluteUrl(markdownMirrorPath(locale, slug)) }
      : undefined

  return {
    ...base,
    title: note.title,
    description,
    keywords: note.tags.length > 0 ? note.tags : undefined,
    authors: [{ name: authorName }],
    robots: note.noindex ? { index: false, follow: true } : undefined,
    alternates: markdownAlternate
      ? { ...base.alternates, types: markdownAlternate }
      : base.alternates,
    openGraph: {
      ...base.openGraph,
      title: note.title,
      description,
      type: 'article',
      url: base.alternates?.canonical as string | undefined,
      images: image ? [{ url: image }] : base.openGraph?.images,
      publishedTime: note.date?.toISOString(),
      modifiedTime: (note.updated ?? note.date)?.toISOString(),
      authors: [authorName],
      tags: note.tags.length > 0 ? note.tags : undefined,
    },
    twitter: {
      ...base.twitter,
      title: note.title,
      description,
      images: image ? [image] : base.twitter?.images,
    },
  }
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const [repo, siteConfig] = [createRepository(locale), await loadSiteConfig(locale)]
  const note = await getNote(repo, slug)
  if (!note) notFound()

  const [seriesNav, mentions, related, allNotes] = await Promise.all([
    getSeriesNavigation(repo, note),
    getMentions(repo, note),
    getRelatedNotes(repo, note, 2),
    repo.listAll(),
  ])

  const noteMap = new Map(allNotes.map((n) => [n.slug, n]))

  // Resolve each parent name to a real note slug by case-insensitive title
  // match against the current locale's repository. Falling back to a
  // lowercased/dashified guess (the old behaviour) produced localised URLs
  // for English-slugged parent notes — e.g. /uk/notes/семантична-типізація
  // instead of /uk/notes/semantic-typing. If no match exists the parent is
  // rendered as plain text rather than a broken link.
  const titleToSlug = new Map(allNotes.map((n) => [n.title.toLowerCase(), n.slug]))
  const resolvedParents = note.parents.map((name) => ({
    name,
    slug: titleToSlug.get(name.toLowerCase()) ?? null,
  }))

  // Build the side panel's outgoing list in the same order the author wrote
  // the links in the body. Internal entries get resolved against the note
  // map; external ones get their <title> fetched (cached, best-effort) so
  // the panel shows a real label rather than the URL itself.
  const outgoing = await Promise.all(
    note.outgoingLinks.map(async (link) => {
      if (link.kind === 'internal') {
        const n = noteMap.get(link.slug)
        return {
          slug: link.slug,
          title: n?.title ?? link.slug,
          isExternal: false as const,
          href: `/${locale}/notes/${link.slug}`,
        }
      }
      const title = await fetchExternalTitle(link.href)
      return {
        slug: link.href,
        title: title ?? urlLabel(link.href),
        isExternal: true as const,
        href: link.href,
      }
    }),
  )

  const backlinks = mentions.linked.map((n: Note) => ({ slug: n.slug, title: n.title }))

  const toMentionItem = (n: Note) => ({
    slug: n.slug,
    title: n.title,
    preview: n.preview,
    date: n.date?.toISOString() ?? null,
  })

  const relatedSerializable = related.map((n) => ({
    slug: n.slug,
    title: n.title,
    date: n.date?.toISOString() ?? null,
    coverImage: n.coverImage,
    coverImageSrcSet: n.coverImageSrcSet,
  }))

  const seriesNavData = seriesNav
    ? {
        name: seriesNav.series.name,
        prev: seriesNav.prev ? { slug: seriesNav.prev.slug, title: seriesNav.prev.title } : null,
        next: seriesNav.next ? { slug: seriesNav.next.slug, title: seriesNav.next.title } : null,
      }
    : null

  const tGarden = await getTranslations({ locale, namespace: 'garden' })

  // GeistMono is not preloaded globally — most notes never paint it, and the
  // 70 KB cost 300ms of LCP on those. A note that actually contains code asks
  // for it here, so code-bearing pages keep the head start they had while the
  // rest stop paying for it.
  //
  // `preload()` rather than a rendered <link>: React hoists a JSX preload into
  // <head> but leaves the original in the body too, emitting the tag twice.
  // This API dedupes. `crossOrigin` is required even same-origin, because
  // fonts are always fetched in CORS mode — without it the preload is
  // discarded and the font fetched a second time.
  if (needsMonoFont(note.body)) {
    preload(MONO_FONT_URL, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
  }

  return (
    <>
      <JsonLd
        data={[
          breadcrumbsJsonLd([
            { name: siteConfig.owner.name, href: `/${locale}` },
            { name: tGarden('notes'), href: `/${locale}/notes` },
            { name: note.title, href: `/${locale}/notes/${slug}` },
          ]),
          // Series siblings and wiki-link mentions come from data this page
          // already loaded for the side panels — the schema just says out
          // loud what the garden's structure already is.
          articleJsonLd(note, locale, siteConfig, {
            seriesNotes: seriesNav?.series.notes,
            mentions: mentions.linked.map((n) => ({ slug: n.slug, title: n.title })),
          }),
          definedTermJsonLd(note, locale, siteConfig),
        ].filter((d): d is NonNullable<typeof d> => d !== null)}
      />
      <NoteContextProvider
        value={{
          currentSlug: slug,
          currentTitle: note.title,
          headings: note.headings,
          series: seriesNav?.series ?? null,
          backlinks,
          outgoing,
        }}
      />
      <NoteArticle
        note={note}
        locale={locale}
        resolvedParents={resolvedParents}
        seriesNav={seriesNavData}
        relatedNotes={relatedSerializable}
        linkedMentions={mentions.linked.map(toMentionItem)}
        unlinkedMentions={mentions.unlinked.map(toMentionItem)}
        commentsConfig={siteConfig.comments}
      />
    </>
  )
}
