import { describe, it, expect } from 'vitest'
import { getMentions } from '@core/GetMentions'
import { MemoryNoteRepository } from '@adapters/memory/MemoryNoteRepository'
import { makeNote } from '../fixtures/notes'

describe('getMentions', () => {
  it('classifies notes with explicit outgoing link as linked mentions', async () => {
    const notes = [
      makeNote({ slug: 'target', title: 'Target_unique', rawText: 'content' }),
      makeNote({ slug: 'a', title: 'A', outgoingLinks: [{ kind: 'internal', slug: 'target' }], rawText: 'has link' }),
    ]
    const repo = new MemoryNoteRepository(notes)
    const result = await getMentions(repo, notes[0])
    expect(result.linked.map((n) => n.slug)).toEqual(['a'])
    expect(result.unlinked).toEqual([])
  })

  it('classifies notes mentioning the title without a link as unlinked', async () => {
    const notes = [
      makeNote({ slug: 'target', title: 'Target_unique', rawText: 'content' }),
      makeNote({ slug: 'b', title: 'B', rawText: 'casually mentions Target_unique in prose' }),
    ]
    const repo = new MemoryNoteRepository(notes)
    const result = await getMentions(repo, notes[0])
    expect(result.unlinked.map((n) => n.slug)).toEqual(['b'])
    expect(result.linked).toEqual([])
  })

  it('does not return the note itself', async () => {
    const note = makeNote({ slug: 'self', title: 'Self_unique', rawText: 'I am Self_unique' })
    const repo = new MemoryNoteRepository([note])
    const result = await getMentions(repo, note)
    expect(result.linked).toEqual([])
    expect(result.unlinked).toEqual([])
  })

  it('prefers linked classification when both link and title mention exist', async () => {
    const notes = [
      makeNote({ slug: 'target', title: 'Target_unique', rawText: 'content' }),
      makeNote({
        slug: 'c',
        title: 'C',
        outgoingLinks: [{ kind: 'internal', slug: 'target' }],
        rawText: 'Target_unique is mentioned and linked',
      }),
    ]
    const repo = new MemoryNoteRepository(notes)
    const result = await getMentions(repo, notes[0])
    expect(result.linked.map((n) => n.slug)).toEqual(['c'])
    expect(result.unlinked).toEqual([])
  })
})

describe('getMentions — children of a parent note', () => {
  it('counts a child as a linked mention of its parent', async () => {
    // A child declares `parents: [...]` in frontmatter rather than linking in
    // the body, so it has no outgoing link. Before this, an epic note with
    // seven children reported zero linked mentions.
    const notes = [
      makeNote({ slug: 'software-design', title: 'Software Design', rawText: 'parent note' }),
      makeNote({ slug: 'deep-modules', title: 'Deep Modules', parents: ['Software Design'], rawText: 'child' }),
    ]
    const repo = new MemoryNoteRepository(notes)
    const result = await getMentions(repo, notes[0])
    expect(result.linked.map((n) => n.slug)).toEqual(['deep-modules'])
    expect(result.unlinked).toEqual([])
  })

  it('matches the parent name case-insensitively, as the breadcrumb does', async () => {
    const notes = [
      makeNote({ slug: 'software-design', title: 'Software Design', rawText: 'parent' }),
      makeNote({ slug: 'child', title: 'Child', parents: ['software design'], rawText: 'x' }),
    ]
    const repo = new MemoryNoteRepository(notes)
    expect((await getMentions(repo, notes[0])).linked.map((n) => n.slug)).toEqual(['child'])
  })

  it('does not make the parent a mention of its own child', async () => {
    // The relationship is directional: children surface under the parent, and
    // the parent is already shown in the child's breadcrumb.
    const notes = [
      makeNote({ slug: 'software-design', title: 'Software Design', rawText: 'parent' }),
      makeNote({ slug: 'child', title: 'Child_unique', parents: ['Software Design'], rawText: 'x' }),
    ]
    const repo = new MemoryNoteRepository(notes)
    const result = await getMentions(repo, notes[1])
    expect(result.linked).toEqual([])
  })

  it('lists a child once even when it also links to the parent in its body', async () => {
    const notes = [
      makeNote({ slug: 'software-design', title: 'Software Design', rawText: 'parent' }),
      makeNote({
        slug: 'child',
        title: 'Child',
        parents: ['Software Design'],
        outgoingLinks: [{ kind: 'internal', slug: 'software-design' }],
        rawText: 'x',
      }),
    ]
    const repo = new MemoryNoteRepository(notes)
    const result = await getMentions(repo, notes[0])
    expect(result.linked.map((n) => n.slug)).toEqual(['child'])
  })

  it('leaves an unrelated note out entirely', async () => {
    const notes = [
      makeNote({ slug: 'software-design', title: 'Software Design_unique', rawText: 'parent' }),
      makeNote({ slug: 'other', title: 'Other', parents: ['Kotlin'], rawText: 'nothing here' }),
    ]
    const repo = new MemoryNoteRepository(notes)
    const result = await getMentions(repo, notes[0])
    expect(result.linked).toEqual([])
    expect(result.unlinked).toEqual([])
  })
})
