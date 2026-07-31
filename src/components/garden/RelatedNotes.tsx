'use client'

import Image from 'next/image'
import { format } from 'date-fns'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { NoteLink } from './NoteLink'

export interface RelatedNote {
  slug: string
  title: string
  date: string | null
  coverImage: string | null
  /** Responsive ladder for the cover; see `NoteCardData.coverImageSrcSet`. */
  coverImageSrcSet?: string | null
}

export function RelatedNotes({ notes }: { notes: RelatedNote[] }) {
  const t = useTranslations('note')
  const params = useParams<{ locale: string }>()

  if (notes.length === 0) return null

  return (
    <section className="mt-10 pt-6 border-t border-border">
      <h3 className="text-xs uppercase tracking-wide font-medium text-muted mb-4">
        {t('relatedNotes')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {notes.map((note) => (
          <NoteLink
            key={note.slug}
            slug={note.slug}
            title={note.title}
            href={`/${params.locale}/notes/${note.slug}`}
            className="group flex gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-card transition-all"
          >
            {note.coverImage &&
              (note.coverImageSrcSet ? (
                /* A 56px square had been pulling the full-width source; see
                   the note in `NoteCard` for why `next/image` cannot help
                   under a static export. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={note.coverImage}
                  srcSet={note.coverImageSrcSet}
                  sizes="56px"
                  alt={note.title}
                  loading="lazy"
                  decoding="async"
                  width={56}
                  height={56}
                  className="w-14 h-14 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform"
                />
              ) : (
                <Image
                  src={note.coverImage}
                  alt={note.title}
                  width={56}
                  height={56}
                  className="w-14 h-14 object-cover rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform"
                />
              ))}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                {note.title}
              </p>
              {note.date && (
                <p className="text-xs text-muted mt-1">
                  {format(new Date(note.date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </NoteLink>
        ))}
      </div>
    </section>
  )
}
