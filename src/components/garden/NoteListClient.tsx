'use client'

import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { NoteCard } from './NoteCard'

interface NoteItem {
  slug: string
  title: string
  preview: string
  date: string | null
  coverImage: string | null
  coverImageSrcSet: string | null
  parents: string[]
  series: string | null
  order: number | null
  isArchived: boolean
  readingTimeMinutes: number
}

interface DisplayCard {
  slug: string
  displayTitle: string
  preview: string
  date: string | null
  coverImage: string | null
  coverImageSrcSet: string | null
  parents: string[]
  series: string | null
  isArchived: boolean
}

/** Collapse all notes in the same series into a single card (first-by-order entry). */
function collapseSeries(notes: NoteItem[]): DisplayCard[] {
  const seriesSeen = new Map<string, DisplayCard>()
  const result: DisplayCard[] = []

  for (const note of notes) {
    if (note.series) {
      const existing = seriesSeen.get(note.series)
      if (existing) {
        // Keep the lowest-order representative — replace only if this is earlier
        const existingOrder = notes.find((n) => n.slug === existing.slug)?.order ?? Infinity
        const thisOrder = note.order ?? Infinity
        if (thisOrder < existingOrder) {
          const card = toCard(note, true)
          const idx = result.indexOf(existing)
          result[idx] = card
          seriesSeen.set(note.series, card)
        }
        continue
      }
      const card = toCard(note, true)
      result.push(card)
      seriesSeen.set(note.series, card)
    } else {
      result.push(toCard(note, false))
    }
  }
  return result
}

function toCard(note: NoteItem, useSeriesTitle: boolean): DisplayCard {
  return {
    slug: note.slug,
    displayTitle: useSeriesTitle && note.series ? note.series : note.title,
    preview: note.preview,
    date: note.date,
    coverImage: note.coverImage,
    coverImageSrcSet: note.coverImageSrcSet,
    parents: note.parents,
    series: note.series,
    isArchived: note.isArchived,
  }
}

export function NoteListClient({
  notes,
  locale,
}: {
  notes: NoteItem[]
  locale: string
}) {
  const t = useTranslations('garden')
  const [query, setQuery] = useState('')
  const [activeParents, setActiveParents] = useState<string[]>([])

  const allParents = useMemo(() => {
    const set = new Set<string>()
    for (const n of notes) n.parents.forEach((p) => set.add(p))
    return Array.from(set).sort()
  }, [notes])

  const collapsed = useMemo(() => collapseSeries(notes), [notes])

  const filtered = useMemo(() => {
    let result = collapsed
    if (query) {
      const q = query.toLowerCase()
      result = result.filter(
        (n) =>
          n.displayTitle.toLowerCase().includes(q) ||
          n.preview.toLowerCase().includes(q),
      )
    }
    if (activeParents.length > 0) {
      result = result.filter((n) =>
        activeParents.every((p) =>
          n.parents.some((np) => np.toLowerCase() === p.toLowerCase()),
        ),
      )
    }
    return result
  }, [collapsed, query, activeParents])

  function toggleParent(p: string) {
    setActiveParents((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          // 16px below `sm`: iOS Safari zooms the viewport on focus for
          // anything smaller, and never zooms back out.
          className="w-full pl-9 pr-12 py-2 text-base sm:text-sm bg-card border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
        />
        <kbd className="hidden md:inline-block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs font-mono border border-border rounded text-muted">
          /
        </kbd>
      </div>

      {allParents.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted flex items-center gap-1">
            {t('filterByParents')}
          </span>
          {allParents.map((p) => {
            const active = activeParents.includes(p)
            return (
              <button
                key={p}
                onClick={() => toggleParent(p)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all ${
                  active
                    ? 'bg-primary text-bg border-primary'
                    : 'border-border text-muted hover:border-primary hover:text-fg'
                }`}
              >
                {p}
                {active && <X size={10} />}
              </button>
            )
          })}
          {activeParents.length > 0 && (
            <button
              onClick={() => setActiveParents([])}
              className="text-xs text-muted hover:text-primary transition-colors"
            >
              {t('clearAll')}
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-xl">
          <Search size={32} className="text-muted mb-3" />
          <p className="text-muted">{t('noNotesFound')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((note) => (
            <NoteCard
              key={note.slug}
              href={`/${locale}/notes/${note.slug}`}
              note={{
                slug: note.slug,
                title: note.displayTitle,
                preview: note.preview,
                date: note.date,
                coverImage: note.coverImage,
                coverImageSrcSet: note.coverImageSrcSet,
                isArchived: note.isArchived,
                isSeries: !!note.series,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
