import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Calendar, Clock } from 'lucide-react'
import { formatDateShort } from '@lib/formatDate'
import type { Note } from '@core/Note'

/**
 * Rendered width of one card, tracking the landing grid exactly.
 *
 * `Section` is `px-4` around a `max-w-5xl` (1024px) column, and the grid is
 * 1 / 2 / 3 columns at the `sm` and `md` breakpoints with a 16px gap. So the
 * card is 331px once the column stops growing (viewport ≥ 1056px), and a
 * share of the viewport below that.
 *
 * Worth being exact. Under `ONVU_MODE=static` `next/image` is forced to
 * `unoptimized`, which emits neither `srcset` nor `sizes` — so a card was
 * serving the full-width source (1695px) into a 400×160 box, roughly 50 KiB
 * wasted per cover. `sizes` is what lets the browser pick a rung of the
 * ladder the image pipeline already built.
 */
const CARD_SIZES = [
  '(min-width: 1056px) 331px',
  '(min-width: 768px) calc((100vw - 64px) / 3)',
  '(min-width: 640px) calc((100vw - 48px) / 2)',
  'calc(100vw - 32px)',
].join(', ')

/**
 * One large note card — used on the landing page to feature hand-picked
 * notes. The container (grid/list, columns, ordering) is up to the caller.
 */
export function NoteCardLarge({
  note,
  locale,
  viewLabel,
}: {
  note: Note
  locale: string
  viewLabel: string
}) {
  return (
    <Link
      href={`/${locale}/notes/${note.slug}`}
      className="group flex flex-col rounded-xl border border-border hover:border-primary hover:bg-card transition-all duration-300 overflow-hidden"
    >
      {note.coverImage && (
        <div className="overflow-hidden h-40">
          {note.coverImageSrcSet ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={note.coverImage}
              srcSet={note.coverImageSrcSet}
              sizes={CARD_SIZES}
              alt={note.title}
              loading="lazy"
              decoding="async"
              width={400}
              height={160}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <Image
              src={note.coverImage}
              alt={note.title}
              width={400}
              height={160}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
        </div>
      )}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-3 text-xs text-muted">
          {note.date && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatDateShort(note.date, locale)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {note.readingTimeMinutes} min
          </span>
        </div>
        <h3 className="font-semibold group-hover:text-primary transition-colors leading-snug">
          {note.title}
        </h3>
        <p className="text-sm text-muted line-clamp-2 flex-1">{note.preview}</p>
        <span className="text-sm text-muted flex items-center gap-1 mt-2 group-hover:text-primary transition-colors">
          {viewLabel} <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  )
}
