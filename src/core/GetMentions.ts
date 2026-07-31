import type { NoteRepository } from '@core/NoteRepository'
import type { Note } from '@core/Note'

export interface Mentions {
  linked: Note[]
  unlinked: Note[]
}

export async function getMentions(
  repo: NoteRepository,
  note: Note,
): Promise<Mentions> {
  const all = await repo.listAll()
  const linked: Note[] = []
  const unlinked: Note[] = []
  const title = note.title.toLowerCase()

  for (const other of all) {
    if (other.slug === note.slug) continue
    const linksToNote = other.outgoingLinks.some(
      (l) => l.kind === 'internal' && l.slug === note.slug,
    )
    // A child names its parent in frontmatter, not in the body, so it has no
    // outgoing link to it — which left an epic note reporting zero linked
    // mentions while its children pointed straight at it. `buildMentionGraph`
    // has always counted this as an edge (`type: 'parent'`); the two now
    // agree on what a relation is.
    const isChild = other.parents.some((p) => p.toLowerCase() === title)
    if (linksToNote || isChild) {
      linked.push(other)
      continue
    }
    const mentionsTitle = other.rawText.toLowerCase().includes(note.title.toLowerCase())
    if (mentionsTitle) {
      unlinked.push(other)
    }
  }

  return { linked, unlinked }
}
