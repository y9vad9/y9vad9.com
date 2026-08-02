import { describe, it, expect } from 'vitest'
import {
  listAllNotes,
  listNotesByParent,
  listRecentNotes,
  listFeaturedNotes,
  listPinnedNotes,
} from '@core/ListNotes'
import { MemoryNoteRepository } from '@adapters/memory/MemoryNoteRepository'
import { sampleNotes, makeNote } from '../fixtures/notes'

describe('listAllNotes', () => {
  it('returns all notes sorted by date descending', async () => {
    const repo = new MemoryNoteRepository(sampleNotes)
    const result = await listAllNotes(repo)
    expect(result.length).toBe(sampleNotes.length)
    // First should be the most recent dated note
    expect(result[0].slug).toBe('nextjs') // 2024-05-01
    expect(result[1].slug).toBe('suspend-funcs') // 2024-04-01
  })

  it('places undated notes at the end', async () => {
    const repo = new MemoryNoteRepository(sampleNotes)
    const result = await listAllNotes(repo)
    expect(result[result.length - 1].slug).toBe('no-date')
  })

  it('returns empty array for empty repo', async () => {
    const repo = new MemoryNoteRepository([])
    expect(await listAllNotes(repo)).toEqual([])
  })
})

describe('listNotesByParent', () => {
  it('returns only notes with the matching parent', async () => {
    const repo = new MemoryNoteRepository(sampleNotes)
    const result = await listNotesByParent(repo, 'Kotlin')
    expect(result.map((n) => n.slug).sort()).toEqual(['coroutines', 'flows', 'suspend-funcs'])
  })

  it('is case-insensitive', async () => {
    const repo = new MemoryNoteRepository(sampleNotes)
    const result = await listNotesByParent(repo, 'KOTLIN')
    expect(result.length).toBe(3)
  })

  it('returns empty array for unknown parent', async () => {
    const repo = new MemoryNoteRepository(sampleNotes)
    expect(await listNotesByParent(repo, 'Unknown')).toEqual([])
  })
})

describe('listRecentNotes', () => {
  it('excludes undated notes and limits to count', async () => {
    const repo = new MemoryNoteRepository(sampleNotes)
    const result = await listRecentNotes(repo, 3)
    expect(result.length).toBe(3)
    expect(result.every((n) => n.date !== null)).toBe(true)
    expect(result[0].slug).toBe('nextjs')
  })

  it('defaults to 5 results', async () => {
    const repo = new MemoryNoteRepository(sampleNotes)
    const result = await listRecentNotes(repo)
    expect(result.length).toBe(5)
  })
})

describe('listFeaturedNotes', () => {
  it('returns notes in the order of provided slugs', async () => {
    const repo = new MemoryNoteRepository(sampleNotes)
    const result = await listFeaturedNotes(repo, ['flows', 'kotlin', 'nextjs'])
    expect(result.map((n) => n.slug)).toEqual(['flows', 'kotlin', 'nextjs'])
  })

  it('skips slugs that do not exist', async () => {
    const repo = new MemoryNoteRepository(sampleNotes)
    const result = await listFeaturedNotes(repo, ['flows', 'does-not-exist', 'kotlin'])
    expect(result.map((n) => n.slug)).toEqual(['flows', 'kotlin'])
  })
})

describe('listPinnedNotes', () => {
  const repo = () =>
    new MemoryNoteRepository([
      makeNote({ slug: 'plain', title: 'Plain', date: new Date('2024-03-01') }),
      makeNote({ slug: 'older-pin', title: 'Older pin', isPinned: true, date: new Date('2024-01-01') }),
      makeNote({ slug: 'newer-pin', title: 'Newer pin', isPinned: true, date: new Date('2024-05-01') }),
      makeNote({ slug: 'stale', title: 'Stale', isPinned: true, isArchived: true, date: new Date('2024-06-01') }),
    ])

  it('returns only pinned notes, newest first', async () => {
    const result = await listPinnedNotes(repo())
    expect(result.map((n) => n.slug)).toEqual(['newer-pin', 'older-pin'])
  })

  it('drops a pin left behind on an archived note', async () => {
    // The two flags contradict each other. `stale` is the newest of the
    // three pins, so without this it would head the garden — putting the
    // author's most explicitly retired writing in the most prominent slot.
    const result = await listPinnedNotes(repo())
    expect(result.map((n) => n.slug)).not.toContain('stale')
  })

  it('returns nothing when the author has pinned nothing', async () => {
    // The index hides the whole section on an empty list, so this is the
    // out-of-the-box state for a fresh site rather than an edge case.
    const bare = new MemoryNoteRepository([makeNote({ slug: 'a' }), makeNote({ slug: 'b' })])
    expect(await listPinnedNotes(bare)).toEqual([])
  })
})
