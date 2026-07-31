'use client'

import Image from 'next/image'
import { formatDateShort } from '@lib/formatDate'
import { Archive, BookOpen, ArrowRight } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { NoteLink } from './NoteLink'

export interface NoteCardData {
  slug: string
  title: string
  preview: string
  date: string | null
  coverImage: string | null
  /**
   * The pipeline's responsive ladder for the cover, when it has one.
   * Optional so a fork rendering this card from its own data keeps building;
   * without it the card falls back to `next/image`.
   */
  coverImageSrcSet?: string | null
  isArchived?: boolean
  isSeries?: boolean
}

/**
 * Shared list-item card for the garden hub (recent notes) and the lower
 * `NoteListClient` grid. Keeps both visually consistent.
 */
export function NoteCard({
  note,
  href,
}: {
  note: NoteCardData
  href: string
}) {
  const tNote = useTranslations('note')
  const locale = useLocale()
  return (
    <NoteLink
      slug={note.slug}
      title={note.title}
      href={href}
      className="group flex items-start gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-card transition-all duration-300"
    >
      {note.coverImage && (
        <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-bg flex-shrink-0">
          {/* Under `ONVU_MODE=static` `next/image` is `unoptimized`, so it
              emits no srcset and the browser takes the source-width file —
              often ~1700px and 55 KiB — for this 112px thumbnail. Where the
              pipeline built a ladder, use it. See `NoteCoverImage`. */}
          {note.coverImageSrcSet ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={note.coverImage}
              srcSet={note.coverImageSrcSet}
              sizes="112px"
              alt={note.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <Image
              src={note.coverImage}
              alt={note.title}
              fill
              sizes="112px"
              className="object-cover group-hover:scale-105 transition-transform"
            />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {note.isArchived && (
            <span className="text-xs text-amber-500 flex items-center gap-0.5">
              <Archive size={10} /> {tNote('archive')}
            </span>
          )}
          {note.isSeries && (
            <span className="text-xs text-primary flex items-center gap-0.5">
              <BookOpen size={10} /> {tNote('series')}
            </span>
          )}
          {note.date && (
            <span className="text-xs text-muted">
              {formatDateShort(note.date, locale)}
            </span>
          )}
        </div>
        <p className="font-semibold text-sm group-hover:text-primary transition-colors leading-snug">
          {note.title}
        </p>
        <p className="text-xs text-muted line-clamp-1 mt-0.5">{note.preview}</p>
      </div>
      <ArrowRight
        size={14}
        className="text-muted group-hover:text-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all flex-shrink-0 mt-1 hidden md:inline-block"
      />
    </NoteLink>
  )
}
