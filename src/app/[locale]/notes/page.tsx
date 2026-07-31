import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Sprout, Clock, Star, Network } from 'lucide-react'
import Link from 'next/link'
import { createRepository } from '@adapters/createRepositories'
import { listAllNotes, listRecentNotes } from '@core/ListNotes'
import { getEpics } from '@core/GetCategories'
import { buildMentionGraph } from '@core/graph/BuildMentionGraph'
import { NoteListClient } from '@components/garden/NoteListClient'
import { NoteCard } from '@components/garden/NoteCard'
import { RouteTabSync } from '@components/garden/RouteTabSync'
import { RouteLink } from '@components/garden/RouteLink'
import { JsonLd } from '@components/seo/JsonLd'
import { INDEX_TAB_SLUG, GRAPH_TAB_SLUG } from '@store/tabStore'
import { breadcrumbsJsonLd, collectionPageJsonLd } from '@lib/seo/jsonLd'
import { baseMetadata } from '@lib/seo/metadata'
import { loadSiteConfig } from '@lib/config/loadConfig'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const [t, base] = await Promise.all([
    getTranslations({ locale, namespace: 'garden' }),
    baseMetadata({ locale, path: '/notes' }),
  ])
  return {
    ...base,
    title: t('welcome'),
    description: t('welcomeDescription'),
  }
}

export default async function GardenHubPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, siteConfig] = await Promise.all([
    getTranslations({ locale, namespace: 'garden' }),
    loadSiteConfig(locale),
  ])
  const repo = createRepository(locale)

  const [allNotes, recentNotes, epics, graph] = await Promise.all([
    listAllNotes(repo),
    listRecentNotes(repo, 5),
    getEpics(repo),
    buildMentionGraph(repo),
  ])

  const totalReadingTime = allNotes.reduce((sum, n) => sum + n.readingTimeMinutes, 0)
  const notesForList = allNotes.map((n) => ({
    slug: n.slug,
    title: n.title,
    preview: n.preview,
    date: n.date?.toISOString() ?? null,
    coverImage: n.coverImage,
    coverImageSrcSet: n.coverImageSrcSet,
    parents: n.parents,
    series: n.series,
    order: n.order,
    isArchived: n.isArchived,
    readingTimeMinutes: n.readingTimeMinutes,
  }))

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <RouteTabSync slug={INDEX_TAB_SLUG} title={t('welcome')} kind="index" />
      <JsonLd
        data={[
          breadcrumbsJsonLd([
            { name: siteConfig.owner.name, href: `/${locale}` },
            { name: t('notes'), href: `/${locale}/notes` },
          ]),
          collectionPageJsonLd(
            locale,
            allNotes
              .filter((n) => !n.noindex)
              .map((n) => ({ slug: n.slug, title: n.title, date: n.date })),
            t('notes'),
          ),
        ]}
      />
      {/* Welcome hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-muted mb-4">
          <Sprout size={28} className="text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">{t('welcome')}</h1>
        <p className="text-muted italic">{t('welcomeDescription')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-12">
        <StatCard label={t('notes')} value={allNotes.length} />
        <StatCard label={t('totalReadingTime')} value={`${totalReadingTime} ${t('min')}`} />
        <StatCard label={t('connections')} value={graph.edges.length} />
      </div>

      {/* Epics */}
      {epics.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wide mb-4">
            <Star size={12} /> {t('epics')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {epics.slice(0, 8).map((epic) => (
              <Link
                key={epic.name}
                href={epic.slug ? `/${locale}/notes/${epic.slug}` : `/${locale}/notes?parent=${encodeURIComponent(epic.name)}`}
                className="group p-4 rounded-xl border border-border hover:border-primary hover:bg-card transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-muted flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Sprout size={14} className="text-primary" />
                  </div>
                  <span className="text-xs text-muted">{epic.mentionCount}</span>
                </div>
                <p className="font-medium text-sm mb-1">{epic.name}</p>
                {epic.preview && (
                  <p className="text-xs text-muted italic line-clamp-2">{epic.preview}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent notes */}
      <section className="mb-12">
        <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wide mb-4">
          <Clock size={12} /> {t('recentNotes')}
        </div>
        <div className="flex flex-col gap-2">
          {recentNotes.map((note) => (
            <NoteCard
              key={note.slug}
              href={`/${locale}/notes/${note.slug}`}
              note={{
                slug: note.slug,
                title: note.title,
                preview: note.preview,
                date: note.date?.toISOString() ?? null,
                coverImage: note.coverImage,
                coverImageSrcSet: note.coverImageSrcSet,
                isArchived: note.isArchived,
                isSeries: !!note.series,
              }}
            />
          ))}
        </div>
      </section>

      {/* Graph CTA */}
      <RouteLink
        href={`/${locale}/notes/graph`}
        routeSlug={GRAPH_TAB_SLUG}
        routeTitle={t('knowledgeGraph')}
        routeKind="graph"
        className="group block p-8 rounded-2xl border-2 border-dashed border-border hover:border-primary hover:bg-primary-muted/30 transition-all duration-300 text-center"
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-muted mb-4 group-hover:scale-110 transition-transform">
          <Network size={24} className="text-primary" />
        </div>
        <h2 className="font-bold text-lg mb-1">{t('knowledgeGraph')}</h2>
        <p className="text-sm text-muted mb-3">{t('knowledgeGraphDescription')}</p>
        <span className="text-xs uppercase tracking-widest text-primary">{t('launchExplorer')} →</span>
      </RouteLink>

      {/* Note list */}
      <div className="mt-12">
        <NoteListClient notes={notesForList} locale={locale} />
      </div>
    </div>
  )
}

/**
 * Three of these sit in a `grid-cols-3` that never collapses, so on a phone
 * each card gets roughly 70px of content width. At `text-3xl` a value like
 * "189 min" wrapped onto two lines while "32" did not, and the labels wrapped
 * to three lines against one — same font size throughout, but the ragged
 * wrapping made the middle card read as a different size entirely.
 *
 * The value scales down on small screens and is pinned to a single line, so
 * the three cards stay visually identical whatever they contain. `tabular-nums`
 * keeps the digits from shifting width between locales.
 */
function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center p-2 sm:p-4 rounded-xl border border-border">
      <p className="text-lg sm:text-2xl md:text-3xl font-bold text-primary whitespace-nowrap tabular-nums">
        {value}
      </p>
      <p className="text-[10px] sm:text-xs text-muted uppercase tracking-wide mt-1 text-balance">
        {label}
      </p>
    </div>
  )
}
