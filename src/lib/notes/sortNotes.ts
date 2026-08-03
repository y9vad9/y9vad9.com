/**
 * Note ordering, shared by every list that offers a sort control.
 *
 * This lived inside `MentionsSection` while it was the only list with a sort
 * control. The garden index then grew one too, and a second copy of a
 * four-branch comparator is exactly the kind of thing that drifts: one list
 * would start treating undated notes differently from the other, and nothing
 * would catch it.
 */
export type SortMode = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'

/** Presentation order for the sort menu; also the `messages` key per mode. */
export const SORT_MODES: readonly SortMode[] = [
  'date-desc',
  'date-asc',
  'name-asc',
  'name-desc',
]

/** The `note.*` message key naming each mode. */
export const SORT_LABEL_KEY: Record<SortMode, string> = {
  'date-desc': 'sortDate',
  'date-asc': 'sortDateAsc',
  'name-asc': 'sortNameAsc',
  'name-desc': 'sortNameDesc',
}

export interface SortableNote {
  title: string
  /** ISO date, or null for notes that carry no date at all. */
  date: string | null
}

/**
 * Sorts a copy — callers hold these arrays in `useMemo` and an in-place sort
 * would mutate the memoised input.
 *
 * Undated notes sort last under both date orders rather than clumping at
 * whichever end an empty string happens to land on. Epics and other hub notes
 * routinely have no date, and burying them above everything on "oldest first"
 * read as a bug.
 */
export function sortNotes<T extends SortableNote>(
  items: readonly T[],
  mode: SortMode,
  /**
   * The page's locale, for name ordering.
   *
   * Bare `localeCompare()` uses the *browser's* locale, not the page's — and
   * this runs in client components, so "Name (A–Z)" on a Ukrainian note list
   * ordered one way for a Ukrainian reader and another for an English one.
   * `Intl.Collator` also sorts letters properly rather than by code point,
   * which is what puts «Я» after «Ю» instead of before every Latin letter.
   */
  locale?: string,
): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const list = items.slice()
  return list.sort((a, b) => {
    switch (mode) {
      case 'date-desc':
      case 'date-asc': {
        if (!a.date && !b.date) return collator.compare(a.title, b.title)
        if (!a.date) return 1
        if (!b.date) return -1
        // Dates are ISO strings, so plain lexicographic ordering is correct
        // and locale-independent — deliberately not the collator.
        return mode === 'date-desc'
          ? b.date.localeCompare(a.date)
          : a.date.localeCompare(b.date)
      }
      case 'name-asc':
        return collator.compare(a.title, b.title)
      case 'name-desc':
        return collator.compare(b.title, a.title)
    }
  })
}
