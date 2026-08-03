'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { sortNotes, SORT_MODES, SORT_LABEL_KEY, type SortMode } from '@lib/notes/sortNotes'
import { useOnClickOutside } from '@hooks/useOnClickOutside'
import { Search, X, ArrowUpDown } from 'lucide-react'
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

/**
 * Collapse every note in a series into a single card.
 *
 * The card links to the lowest-order member — a reader clicking "Kotlin for
 * beginners" wants part one — but carries the **union of every member's
 * parents**, not just the representative's.
 *
 * That last part is load-bearing. The topic chips are built from the union of
 * all notes' parents, including the notes that get collapsed away. A course
 * whose landing note sits under `Kotlin` while its 18 parts sit under
 * `Kotlin для початківців` therefore offered a chip that nothing could
 * satisfy: the only card standing in for those parts carried the landing
 * note's parents, so filtering by the course's own name returned "no notes
 * found". Taking the union makes every offered filter satisfiable by
 * construction rather than by the author happening to tag consistently.
 */
function collapseSeries(notes: NoteItem[]): DisplayCard[] {
  const orderOf = (n: NoteItem) => n.order ?? Infinity

  const parentsBySeries = new Map<string, Set<string>>()
  for (const note of notes) {
    if (!note.series) continue
    let set = parentsBySeries.get(note.series)
    if (!set) parentsBySeries.set(note.series, (set = new Set()))
    for (const p of note.parents) set.add(p)
  }

  const seriesSeen = new Map<string, DisplayCard>()
  const representative = new Map<string, NoteItem>()
  const result: DisplayCard[] = []

  for (const note of notes) {
    if (!note.series) {
      result.push(toCard(note, false))
      continue
    }

    const parents = Array.from(parentsBySeries.get(note.series) ?? [])
    const existing = seriesSeen.get(note.series)
    if (!existing) {
      const card = { ...toCard(note, true), parents }
      result.push(card)
      seriesSeen.set(note.series, card)
      representative.set(note.series, note)
      continue
    }

    // Keep the lowest-order member as the link target; position in the list is
    // whatever the incoming order gave the series, which the caller has
    // already sorted.
    if (orderOf(note) < orderOf(representative.get(note.series)!)) {
      const card = { ...toCard(note, true), parents }
      result[result.indexOf(existing)] = card
      seriesSeen.set(note.series, card)
      representative.set(note.series, note)
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
  const tNote = useTranslations('note')
  const [query, setQuery] = useState('')

  // The topic cards above this list link to `?parent=<name>` for any topic
  // with no note of its own — a series parent like "Kotlin для початківців",
  // which is a heading rather than a note. Those links navigated and then did
  // nothing at all, because the filter started from an empty array and the
  // query string was never read. Reading it here is what makes the topic grid
  // work for the topics that need it most.
  //
  // Repeatable, since the filter is multi-select: `?parent=A&parent=B`.
  //
  // The URL *is* the state, rather than something copied into a `useState` on
  // mount. A copy has to be re-synced on every later navigation — a second
  // topic card, the back button — and syncing back out of a joined string is
  // its own trap, since topic names contain spaces and any separator is a
  // character some name will eventually hold.
  const searchParams = useSearchParams()
  const activeParents = useMemo(
    () => searchParams.getAll('parent').filter(Boolean),
    [searchParams],
  )
  const [sort, setSort] = useState<SortMode>('date-desc')
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useOnClickOutside<HTMLDivElement>(sortOpen, () => setSortOpen(false))

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
    // Sorted last so the control governs what the reader ends up looking
    // at, not some intermediate list the filters happened to produce.
    return sortNotes(result.map((n) => ({ ...n, title: n.displayTitle })), sort, locale)
  }, [collapsed, query, activeParents, sort, locale])

  /** Rewrite the `parent` params, leaving any other query string intact. */
  function setParents(next: string[]) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('parent')
    for (const value of next) params.append('parent', value)
    const qs = params.toString()

    // `history.replaceState` rather than `router.replace`: Next picks native
    // history calls up and re-runs `useSearchParams`, so the filter stays
    // addressable without a server round-trip per chip. `replace` rather than
    // `push` so a reader toggling four topics doesn't have to press Back four
    // times to leave the page.
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }

  function clearParents() {
    setParents([])
  }

  function toggleParent(p: string) {
    const next = activeParents.includes(p)
      ? activeParents.filter((x) => x !== p)
      : [...activeParents, p]
    setParents(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            // 16px below `sm`: iOS Safari zooms the viewport on focus for
            // anything smaller, and never zooms back out.
            className="w-full ps-9 pe-12 py-2 text-base sm:text-sm bg-card border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
          />
          <kbd className="hidden md:inline-block absolute end-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs font-mono border border-border rounded text-muted">
            /
          </kbd>
        </div>

        {/* Icon-only, so it carries a real `aria-label` — there is no visible
            text for the accessible name to contradict. */}
        <div className="relative flex-shrink-0" ref={sortRef}>
          <button
            type="button"
            onClick={() => setSortOpen((v) => !v)}
            aria-label={t('sortBy')}
            aria-expanded={sortOpen}
            className="p-2.5 rounded-xl bg-card border border-border text-muted hover:text-fg hover:border-primary transition-colors"
          >
            <ArrowUpDown size={14} />
          </button>
          {sortOpen && (
            <div className="absolute end-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-20 min-w-44">
              {SORT_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setSort(mode); setSortOpen(false) }}
                  aria-current={sort === mode ? 'true' : undefined}
                  className={`block w-full px-3 py-1.5 text-xs text-start hover:bg-card-hover transition-colors ${
                    sort === mode ? 'text-primary font-bold' : 'text-fg'
                  }`}
                >
                  {tNote(SORT_LABEL_KEY[mode])}
                </button>
              ))}
            </div>
          )}
        </div>
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
              onClick={clearParents}
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
