import './note-article.css'
import Link from 'next/link'
import { formatDateLong, formatDateShort } from '@lib/formatDate'
import { Calendar, Clock, Archive, History } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { Note } from '@core/Note'
import { Suspense } from 'react'
import { ArticleEnhancer } from './ArticleEnhancer'
import { MermaidRenderer } from './MermaidRenderer'
import { NoteLinkPreview } from './NoteLinkPreview'
import { NoteCoverImage } from './NoteCoverImage'
import { SearchHighlight } from './SearchHighlight'
import { SeriesNavigation } from './SeriesNavigation'
import { RelatedNotes, type RelatedNote } from './RelatedNotes'
import { loadNoteViewSlots } from '@lib/content/noteView'
import { MentionsSection, type MentionItem } from './MentionsSection'
import { CommentsSection } from './CommentsSection'
import type { CommentsConfig } from '@config/site'

export interface NoteArticleProps {
  note: Note
  locale: string
  resolvedParents: { name: string; slug: string | null }[]
  seriesNav: {
    name: string
    prev: { slug: string; title: string } | null
    next: { slug: string; title: string } | null
  } | null
  relatedNotes: RelatedNote[]
  linkedMentions: MentionItem[]
  unlinkedMentions: MentionItem[]
  commentsConfig?: CommentsConfig
}

export async function NoteArticle({
  note,
  locale,
  resolvedParents,
  seriesNav,
  relatedNotes,
  linkedMentions,
  unlinkedMentions,
  commentsConfig,
}: NoteArticleProps) {
  const t = await getTranslations({ locale, namespace: 'note' })
  const slots = await loadNoteViewSlots()

  return (
    <>
      <ArticleEnhancer slug={note.slug} />
      <NoteLinkPreview />
      <MermaidRenderer />
      <Suspense>
        <SearchHighlight />
      </Suspense>
      <article className="max-w-3xl mx-auto px-6 py-8">
        {note.coverImage && (
          <NoteCoverImage
            src={note.coverImage}
            srcSet={note.coverImageSrcSet}
            width={note.coverImageWidth}
            height={note.coverImageHeight}
            alt={note.title}
          />
        )}
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-3 leading-tight">{note.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted flex-wrap">
            {note.date && (
              <span className="flex items-center gap-1">
                <Calendar size={13} />
                {formatDateLong(note.date, locale)}
              </span>
            )}
            {note.updated && (
              <span className="flex items-center gap-1" title={formatDateLong(note.updated, locale)}>
                <History size={13} />
                {t('updated', { date: formatDateShort(note.updated, locale) })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {t('readingTime', { minutes: note.readingTimeMinutes })}
            </span>
            {note.isArchived && (
              <span className="flex items-center gap-1 text-warning">
                <Archive size={13} />
                {t('archive')}
              </span>
            )}
          </div>
          {resolvedParents.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-1 mt-3 text-sm text-muted">
              <span aria-hidden className="text-muted/70 me-1">↳</span>
              {resolvedParents.map((parent, idx) => (
                <span key={parent.name} className="inline-flex items-baseline">
                  <ParentTag parent={parent} locale={locale} />
                  {idx < resolvedParents.length - 1 && (
                    <span aria-hidden className="text-muted/70">,</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* The site's own header addition, from `content/noteView.tsx`.
            Nothing renders without that file — a template that shipped an
            example here would put its markup on every fork's notes. */}
        {slots.header && <>{await slots.header({ note, locale })}</>}

        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: note.body }}
        />

        {seriesNav && (
          <SeriesNavigation
            seriesName={seriesNav.name}
            prev={seriesNav.prev}
            next={seriesNav.next}
          />
        )}

        <MentionsSection linked={linkedMentions} unlinked={unlinkedMentions} />
        <RelatedNotes notes={relatedNotes} />

        {slots.footer && <>{await slots.footer({ note, locale })}</>}

        <CommentsSection config={commentsConfig} />
      </article>
    </>
  )
}

function ParentTag({
  parent,
  locale,
}: {
  parent: { name: string; slug: string | null }
  locale: string
}) {
  // No matching note for this parent name (author hasn't created a parent
  // note, or the slug couldn't be resolved against the current locale's
  // repository). Render plain text rather than guessing a slug from the
  // localised name — that produced bad URLs like /notes/семантична-типізація.
  if (!parent.slug) {
    return <span className="text-muted">{parent.name}</span>
  }
  return (
    <Link
      prefetch={false}
      href={`/${locale}/notes/${parent.slug}`}
      className="text-muted hover:text-primary underline-offset-4 hover:underline transition-colors"
    >
      {parent.name}
    </Link>
  )
}
