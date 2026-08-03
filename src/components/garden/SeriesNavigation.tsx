'use client'

import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { BookOpen, ArrowLeft, ArrowRight } from 'lucide-react'
import { NoteLink } from './NoteLink'

interface SeriesNavItem {
  slug: string
  title: string
}

export function SeriesNavigation({
  seriesName,
  prev,
  next,
}: {
  seriesName: string
  prev: SeriesNavItem | null
  next: SeriesNavItem | null
}) {
  const t = useTranslations('note')
  const params = useParams<{ locale: string }>()

  if (!prev && !next) return null

  return (
    <nav className="border-t border-border mt-10 pt-6 flex flex-col gap-3">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
        <BookOpen size={12} /> {seriesName}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {prev ? (
          <NoteLink
            slug={prev.slug}
            title={prev.title}
            href={`/${params.locale}/notes/${prev.slug}`}
            className="group p-4 rounded-xl border border-border hover:border-primary hover:bg-card transition-all"
          >
            <span className="flex items-center gap-1 text-xs text-muted mb-1">
              <ArrowLeft size={11} /> {t('previous')}
            </span>
            <span className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
              {prev.title}
            </span>
          </NoteLink>
        ) : <span />}
        {next ? (
          <NoteLink
            slug={next.slug}
            title={next.title}
            href={`/${params.locale}/notes/${next.slug}`}
            className="group p-4 rounded-xl border border-border hover:border-primary hover:bg-card transition-all text-end"
          >
            <span className="flex items-center justify-end gap-1 text-xs text-muted mb-1">
              {t('next')} <ArrowRight size={11} />
            </span>
            <span className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2 block">
              {next.title}
            </span>
          </NoteLink>
        ) : <span />}
      </div>
    </nav>
  )
}
