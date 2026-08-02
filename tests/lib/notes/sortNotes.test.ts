import { describe, it, expect } from 'vitest'
import { sortNotes, SORT_MODES, SORT_LABEL_KEY, type SortMode } from '@lib/notes/sortNotes'

/**
 * One comparator now backs both the garden index list and the mentions
 * section. The undated case is the interesting one: hub notes (epics) carry
 * no date at all, and the previous inline version compared `date ?? ''`,
 * which sorted every undated note to the very top under "oldest first".
 */
const NOTES = [
  { title: 'Beta', date: '2024-05-01' },
  { title: 'Alpha', date: '2024-01-01' },
  { title: 'Zeta', date: null },
  { title: 'Gamma', date: null },
]

const titles = (mode: SortMode) => sortNotes(NOTES, mode).map((n) => n.title)

describe('sortNotes', () => {
  it('orders newest first by default mode', () => {
    expect(titles('date-desc')).toEqual(['Beta', 'Alpha', 'Gamma', 'Zeta'])
  })

  it('orders oldest first', () => {
    expect(titles('date-asc')).toEqual(['Alpha', 'Beta', 'Gamma', 'Zeta'])
  })

  it('keeps undated notes last under BOTH date orders', () => {
    // The bug this guards: `(a.date ?? '')` makes an undated note compare as
    // the empty string, which is smaller than every ISO date — so "oldest
    // first" put every epic above the real notes.
    for (const mode of ['date-desc', 'date-asc'] as SortMode[]) {
      const order = titles(mode)
      expect(order.slice(-2).sort()).toEqual(['Gamma', 'Zeta'])
    }
  })

  it('falls back to title order among undated notes', () => {
    // Otherwise their relative order is whatever the input happened to be,
    // which shuffles as the author adds notes.
    expect(titles('date-desc').slice(-2)).toEqual(['Gamma', 'Zeta'])
  })

  it('sorts by name in both directions', () => {
    expect(titles('name-asc')).toEqual(['Alpha', 'Beta', 'Gamma', 'Zeta'])
    expect(titles('name-desc')).toEqual(['Zeta', 'Gamma', 'Beta', 'Alpha'])
  })

  it('does not mutate the input', () => {
    // Callers hold these in `useMemo`; an in-place sort would corrupt the
    // memoised source array.
    const before = NOTES.map((n) => n.title)
    sortNotes(NOTES, 'name-desc')
    expect(NOTES.map((n) => n.title)).toEqual(before)
  })

  it('names a message key for every mode', () => {
    // A mode with no label renders an empty row in the menu.
    for (const mode of SORT_MODES) {
      expect(SORT_LABEL_KEY[mode]).toBeTruthy()
    }
    expect(SORT_MODES).toHaveLength(Object.keys(SORT_LABEL_KEY).length)
  })
})
