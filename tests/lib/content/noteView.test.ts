import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadNoteViewSlots } from '@lib/content/noteView'

/**
 * The garden had no user-owned composition file at all. Every `src/` →
 * `content/` seam — `landing.tsx`, `navigation.ts`, `footer.tsx` — mounts on
 * the landing page only, so the template's headline feature was the one part
 * an adopter could not compose without forking the engine.
 */
afterEach(() => vi.resetModules())

describe('loadNoteViewSlots', () => {
  it('renders nothing when the site defines no slots', async () => {
    // `content/noteView.tsx` ships empty on purpose: a template that shipped
    // an example would put its markup on every fork's notes.
    const slots = await loadNoteViewSlots()
    expect(slots.header).toBeUndefined()
    expect(slots.footer).toBeUndefined()
  })

  it('picks up whichever slots the site exports', async () => {
    const slots = await loadNoteViewSlots(async () => ({
      NoteHeaderExtras: () => 'header',
    }))
    expect(slots.header).toBeTypeOf('function')
    // Exporting one and not the other has to be fine — a site wanting a
    // footer badge should not have to write an empty header.
    expect(slots.footer).toBeUndefined()
  })

  it('survives a missing module rather than failing the build', async () => {
    // An adopter who deletes the file gets no slots, not a broken site.
    await expect(
      loadNoteViewSlots(async () => {
        throw new Error('ENOENT')
      }),
    ).resolves.toEqual({})
  })
})
