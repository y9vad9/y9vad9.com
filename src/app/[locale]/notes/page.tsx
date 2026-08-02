import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Pin, Star, Wrench } from 'lucide-react'
import Link from 'next/link'
import { createRepository } from '@adapters/createRepositories'
import { listAllNotes, listPinnedNotes } from '@core/ListNotes'
import { getEpics } from '@core/GetCategories'
import { NoteListClient } from '@components/garden/NoteListClient'
import { NoteCard } from '@components/garden/NoteCard'
import { GardenActions } from '@components/garden/GardenActions'
import { RouteTabSync } from '@components/garden/RouteTabSync'
import { JsonLd } from '@components/seo/JsonLd'
import { INDEX_TAB_SLUG } from '@store/tabStore'
import { breadcrumbsJsonLd, collectionPageJsonLd } from '@lib/seo/jsonLd'
import { baseMetadata } from '@lib/seo/metadata'
import { loadSiteConfig } from '@lib/config/loadConfig'
import { DEFAULT_GARDEN_ACTIONS } from '@config/site'
import { loadGardenIntro } from '@lib/content/gardenIntro'

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

  const [allNotes, pinnedNotes, epics, intro] = await Promise.all([
    listAllNotes(repo),
    listPinnedNotes(repo),
    getEpics(repo),
    loadGardenIntro(locale),
  ])
  // Archived notes are excluded the same way pins exclude them: a third of
  // this corpus can be retired writing, and a "random note" that lands there
  // a third of the time is a worse invitation than one that doesn't.
  const gardenActions = siteConfig.garden?.actions ?? DEFAULT_GARDEN_ACTIONS

  const randomSlugs = allNotes.filter((n) => !n.isArchived && !n.noindex).map((n) => n.slug)

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
      {/* The hero that used to open this page carried its only `h1`. The
          ceremony is gone but the document still needs a top-level heading:
          without it the Graph CTA's `h2` would be the highest on the page,
          leaving screen-reader users no title to orient by and the page with
          no outline. Visually hidden rather than restored — the tab already
          says where you are. */}
      <h1 className="sr-only">{t('welcome')}</h1>

      {/* The author's own opening, from `content/garden/<locale>.md`.
          Nothing renders when that file is absent — this slot briefly held
          `garden.welcomeDescription`, but a framework string standing in for
          the author's voice reads as filler, because it is. `welcomeDescription`
          is back to serving only the meta description above. */}
      {intro && (
        <div
          className="prose mb-10"
          dangerouslySetInnerHTML={{ __html: intro }}
        />
      )}

      {/* Start here — the author's own entry points, and deliberately the
          first thing on the page.
          What used to lead here was a welcome hero and three stat cards.
          Neither survived the question "what does a reader do with this?":
          nobody navigates by a total reading time, and the hero spent a
          whole screen restating that this is a garden. Pins are notes you
          can read immediately, which is what someone arriving actually
          wants — unlike the topic hubs below, they need no traversal. */}
      {pinnedNotes.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wide mb-4">
            <Pin size={12} /> {t('startHere')}
          </div>
          <div className="flex flex-col gap-2">
            {pinnedNotes.map((note) => (
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
      )}

      {/* Topics */}
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
                {/* No icon. Every card carried the same sprout, so it
                    distinguished nothing while taking the top third of the
                    card — the name and the count are the only things here
                    that differ between topics. */}
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <p className="font-medium text-sm">{epic.name}</p>
                  <span className="text-xs text-muted tabular-nums flex-shrink-0">
                    {epic.mentionCount}
                  </span>
                </div>
                {epic.preview && (
                  <p className="text-xs text-muted italic line-clamp-2">{epic.preview}</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Actions.
          The graph link used to sit here alone and unlabelled, the one bare
          card between Topics and the search box — homeless because it was the
          only member of an unnamed category. Naming the category fixes it,
          and the category is honest: Topics are material, these are tools.
          Which ones appear, and in what order, is the site's call. */}
      {gardenActions.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wide mb-4">
            <Wrench size={12} /> {t('actions')}
          </div>
          <GardenActions
            actions={gardenActions}
            locale={locale}
            randomSlugs={randomSlugs}
          />
        </section>
      )}

      {/* Note list */}
      <div className="mt-12">
        <NoteListClient notes={notesForList} locale={locale} />
      </div>
    </div>
  )
}
