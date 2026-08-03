import type { ReactNode } from 'react'
import type { Note } from '@core/Note'

/**
 * What a site may render around a note body.
 *
 * Both exports are optional and both receive the whole `Note`, so a "book
 * note" card, a spoiler block or a "cite this" widget is ordinary JSX in the
 * adopter's own file rather than a config schema someone has to anticipate.
 */
export interface NoteViewProps {
  note: Note
  locale: string
}

export type NoteViewSlot = (props: NoteViewProps) => ReactNode | Promise<ReactNode>

/**
 * Load `content/noteView.tsx`, if the site has one.
 *
 * The garden previously had *no* user-owned composition file at all. Every
 * `src/` → `content/` seam — `landing.tsx`, `navigation.ts`, `footer.tsx` —
 * mounts on the landing page only, so the template's headline feature was the
 * one part of it an adopter could not compose without forking the engine.
 *
 * A server component, exactly like `content/landing.tsx`: `NoteArticle` is
 * already async and server-side, so there is no RSC boundary to cross and no
 * new mechanism to invent. The slot can read the filesystem, import framework
 * components, hit `loadSiteConfig` — anything the landing page can do.
 *
 * Absent by default, and absent means nothing renders. A template that shipped
 * an example here would put its own markup on every fork's notes.
 */
interface NoteViewModule {
  NoteHeaderExtras?: NoteViewSlot
  NoteFooterExtras?: NoteViewSlot
}

export async function loadNoteViewSlots(
  /**
   * How to reach the site's module. Injectable only so a test can supply one
   * without writing into `content/` — the default is the real import, and no
   * caller passes this.
   */
  load: () => Promise<NoteViewModule> = () =>
    import('~/content/noteView') as Promise<NoteViewModule>,
): Promise<{ header?: NoteViewSlot; footer?: NoteViewSlot }> {
  try {
    const mod = await load()
    return { header: mod.NoteHeaderExtras, footer: mod.NoteFooterExtras }
  } catch {
    // No `content/noteView.tsx` — the common case, and not an error.
    return {}
  }
}
