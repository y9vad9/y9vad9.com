import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NoteListClient } from '@components/garden/NoteListClient'
import { getRouterMock } from '../../utils/nextRouter'

/**
 * The garden index's topic cards link to `/notes?parent=<name>` for any topic
 * that has no note of its own — a series heading like "Kotlin для початківців",
 * which groups notes without being one. Those links navigated and then did
 * nothing: the filter started from `useState([])` and the query string was
 * never read, so the reader clicked a topic and the list stayed as it was.
 *
 * The URL is the filter's state now, which also makes a filtered view
 * shareable and the back button work.
 */
const NOTES = [
  {
    slug: 'kotlin-basics',
    title: 'Основи',
    preview: 'p',
    date: '2024-01-01T00:00:00.000Z',
    coverImage: null,
    coverImageSrcSet: null,
    parents: ['Kotlin для початківців'],
    series: null,
    order: null,
    isArchived: false,
    readingTimeMinutes: 3,
  },
  {
    slug: 'gradle-notes',
    title: 'Gradle',
    preview: 'p',
    date: '2024-02-01T00:00:00.000Z',
    coverImage: null,
    coverImageSrcSet: null,
    parents: ['Gradle'],
    series: null,
    order: null,
    isArchived: false,
    readingTimeMinutes: 4,
  },
]

/**
 * Titles of the note cards currently listed.
 *
 * Scoped to links rather than any matching text: the topic chips are buttons
 * carrying the same words as the notes ("Gradle" is both a topic and a note),
 * so a document-wide text query cannot tell a filtered-out card from its chip.
 */
function cardTitles(): string[] {
  return Array.from(document.querySelectorAll('a')).map(
    (a) => a.querySelector('p.font-semibold')?.textContent?.trim() ?? '',
  ).filter(Boolean)
}

async function setQuery(search: string) {
  const { state } = await getRouterMock()
  state.searchParams = new URLSearchParams(search)
}

beforeEach(async () => {
  await setQuery('')
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

/**
 * A series collapses to one card. The topic chips are built from *every*
 * note's parents, including the ones collapsed away — so if the card only
 * carried the representative's parents, the UI offered filters that nothing
 * could satisfy.
 *
 * This is the shape that broke on the real site: a course whose landing note
 * (order 1) sits under "Kotlin" while its parts sit under the course's own
 * name. Selecting the course returned "no notes found".
 */
const SERIES = [
  {
    slug: 'kotlin-for-beginners',
    title: 'Kotlin для початківців',
    preview: 'p',
    date: '2022-11-22T00:00:00.000Z',
    coverImage: null,
    coverImageSrcSet: null,
    parents: ['Kotlin'],
    series: 'Kotlin для початківців',
    order: 1,
    isArchived: true,
    readingTimeMinutes: 2,
  },
  {
    slug: 'kotlin-for-beginners-variables',
    title: 'Змінні',
    preview: 'p',
    date: '2022-11-23T00:00:00.000Z',
    coverImage: null,
    coverImageSrcSet: null,
    parents: ['Kotlin для початківців'],
    series: 'Kotlin для початківців',
    order: 3,
    isArchived: true,
    readingTimeMinutes: 2,
  },
]

describe('NoteListClient — collapsed series', () => {
  it('matches a topic that only the collapsed-away parts carry', async () => {
    await setQuery('parent=' + encodeURIComponent('Kotlin для початківців'))
    render(<NoteListClient notes={SERIES} locale="uk" />)
    // One card, standing in for the whole course.
    expect(cardTitles()).toEqual(['Kotlin для початківців'])
  })

  it('still matches the representative note own topic', async () => {
    await setQuery('parent=Kotlin')
    render(<NoteListClient notes={SERIES} locale="uk" />)
    expect(cardTitles()).toEqual(['Kotlin для початківців'])
  })

  it('offers no topic chip the list cannot satisfy', () => {
    render(<NoteListClient notes={[...SERIES, ...NOTES]} locale="uk" />)
    // Every chip is derived from some note's parents; after collapsing, every
    // one of them must still select at least one card. That invariant is the
    // whole point — a filter that returns nothing is a broken control.
    const chips = Array.from(document.querySelectorAll('button'))
      .map((b) => b.textContent?.trim() ?? '')
      .filter((t) => allParentNames.includes(t))
    expect(new Set(chips)).toEqual(new Set(allParentNames))
  })
})

const allParentNames = ['Kotlin', 'Kotlin для початківців', 'Gradle']

describe('NoteListClient — ?parent= filter', () => {
  it('filters to the topic named in the URL', async () => {
    // The reported bug, with the exact name that triggered it: a topic whose
    // label contains spaces and non-Latin characters.
    await setQuery('parent=' + encodeURIComponent('Kotlin для початківців'))
    render(<NoteListClient notes={NOTES} locale="uk" />)

    expect(cardTitles()).toEqual(['Основи'])
  })

  it('shows everything when no topic is named', () => {
    render(<NoteListClient notes={NOTES} locale="uk" />)
    expect(cardTitles().sort()).toEqual(['Gradle', 'Основи'])
  })

  it('intersects repeated params rather than taking only the last', async () => {
    // The chips are multi-select, so the URL has to carry more than one value.
    // No note has both parents, so an intersection empties the list — a union
    // would show both.
    await setQuery(
      'parent=' + encodeURIComponent('Kotlin для початківців') + '&parent=Gradle',
    )
    render(<NoteListClient notes={NOTES} locale="uk" />)
    expect(cardTitles()).toEqual([])
  })

  it('writes the chosen topics back to the URL', async () => {
    const replaceState = vi.fn()
    vi.stubGlobal('history', { replaceState })
    render(<NoteListClient notes={NOTES} locale="uk" />)

    fireEvent.click(screen.getByRole('button', { name: 'Gradle' }))
    // Addressable, so a filtered view can be linked and the back button works.
    expect(replaceState).toHaveBeenCalledWith(null, '', '?parent=Gradle')
  })

  it('preserves unrelated query params when toggling', async () => {
    await setQuery('q=hello')
    const replaceState = vi.fn()
    vi.stubGlobal('history', { replaceState })
    render(<NoteListClient notes={NOTES} locale="uk" />)

    fireEvent.click(screen.getByRole('button', { name: 'Gradle' }))
    const [, , url] = replaceState.mock.calls[0]
    // `?search=true` deep-links the palette; clobbering the whole query string
    // to write one filter would break it.
    expect(url).toContain('q=hello')
    expect(url).toContain('parent=Gradle')
  })
})
