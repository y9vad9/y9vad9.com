import path from 'node:path'
import { routing } from '@i18n/routing'
import { buildRedirectsFile } from '@lib/hosting/redirects'
import { writeFenced, type Fence } from '@lib/hosting/fencedBlock'
import { hostFileIo } from '@lib/hosting/fileIo'

const PUBLIC_ROOT = path.join(process.cwd(), 'public')

/** Fences our block inside a user-owned `_redirects`. */
const FENCE: Fence = {
  begin: '# --- onvu:locales begin (generated, do not edit) ---',
  end: '# --- onvu:locales end ---',
}

/** Snapshot of the site's own `_redirects`, so ours is never appended twice. */
const SNAPSHOT = '.onvu-redirects-base'

let inflight: Promise<void> | null = null

/**
 * Write `public/_redirects` so a static export answers at its own root.
 *
 * Emitted rather than committed as a fixed file because the destination is
 * `locales.primary`, which every fork changes. A checked-in `/ /en/ 302` would
 * send a Ukrainian site's homepage to a language it may not even build.
 *
 * Placed under `public/` for the same reason `ensureMonoFont` puts the font
 * there: the export step copies that directory wholesale at the end of the
 * build, so anything written here before then reaches `out/`.
 *
 * The template ships no `_redirects` of its own, exactly as it ships no
 * `_headers`. Neither is git-ignored, because both are host configuration a
 * site legitimately owns — adopters keep redirects for renamed note slugs in
 * this one — but a committed copy would only be a file for every fork to
 * conflict on, since the build writes it regardless. Our rules go in a fenced
 * block at the end, where first-match-wins leaves the site's own in charge.
 *
 * Runs once per build. Awaited by the root layout, which is the one layout
 * every route renders through.
 */
export function emitHostRedirects(): Promise<void> {
  inflight ??= writeFenced({
    target: path.join(PUBLIC_ROOT, '_redirects'),
    snapshot: path.join(PUBLIC_ROOT, SNAPSHOT),
    fence: FENCE,
    block: buildRedirectsFile(routing.defaultLocale),
    io: hostFileIo,
  })
  return inflight
}
