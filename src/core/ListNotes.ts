import type { NoteRepository } from '@core/NoteRepository'
import type { Note } from '@core/Note'

export async function listAllNotes(repo: NoteRepository): Promise<Note[]> {
  const notes = await repo.listAll()
  return notes.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.getTime() - a.date.getTime()
  })
}

export async function listNotesByParent(
  repo: NoteRepository,
  parent: string,
): Promise<Note[]> {
  return repo.listByParent(parent)
}

export async function listRecentNotes(
  repo: NoteRepository,
  count = 5,
): Promise<Note[]> {
  const all = await listAllNotes(repo)
  return all.filter((n) => n.date !== null).slice(0, count)
}

/**
 * Notes the author marked `pinned: true`, newest first.
 *
 * Archived notes are excluded even when pinned: the two flags contradict each
 * other, and a pin left behind on something since archived would quietly put
 * stale writing at the top of the garden.
 */
export async function listPinnedNotes(repo: NoteRepository): Promise<Note[]> {
  const all = await listAllNotes(repo)
  return all.filter((n) => n.isPinned && !n.isArchived)
}

export async function listFeaturedNotes(
  repo: NoteRepository,
  slugs: string[],
): Promise<Note[]> {
  const results = await Promise.all(slugs.map((s) => repo.getBySlug(s)))
  return results.filter((n): n is Note => n !== null)
}
