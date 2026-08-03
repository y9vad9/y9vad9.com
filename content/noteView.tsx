/**
 * Your own markup around a note body. Yours to edit — `content/**` is
 * `merge=ours`, so upstream never overwrites this file.
 *
 * Both exports are optional and both are **server components**, exactly like
 * `content/landing.tsx`. Import framework components, read the filesystem,
 * call `loadSiteConfig` — anything the landing page can do.
 *
 * Deliberately empty. A template that shipped an example here would put its
 * own markup on every fork's notes, which is the mistake `content/garden/`
 * and `content/theme.css` avoid too.
 *
 * ```tsx
 * import type { NoteViewProps } from '@lib/content/noteView'
 *
 * // A "book note" card above the body, driven by frontmatter you invent.
 * export async function NoteHeaderExtras({ note }: NoteViewProps) {
 *   if (!note.tags.includes('book')) return null
 *   return (
 *     <aside className="mb-6 p-4 rounded-xl border border-border">
 *       <p className="text-sm text-muted">Reading time {note.readingTimeMinutes} min</p>
 *     </aside>
 *   )
 * }
 *
 * // Anything you want under the body, above the comments.
 * export async function NoteFooterExtras({ note, locale }: NoteViewProps) {
 *   return <p className="text-xs text-muted">Cite: /{locale}/notes/{note.slug}</p>
 * }
 * ```
 */
export {}
