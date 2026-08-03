import fs from 'node:fs/promises'
import path from 'node:path'
import type { FencedFileIo } from './fencedBlock'

/**
 * Filesystem access for the generated host-config files, shared by the
 * `_headers` and `_redirects` emitters.
 *
 * The write is atomic from a reader's point of view: content goes to a
 * neighbouring temporary file and is then renamed over the target, and
 * `rename` within one directory is atomic on every platform this runs on.
 *
 * That matters because these files are written from page generation, which
 * Next spreads across worker processes. `fs.writeFile` truncates and then
 * writes, so a plain write leaves a window where another worker reads a file
 * that exists and is empty. One did, concluded the site owned no rules, and
 * the fork's redirects were rebuilt from nothing.
 *
 * The temporary name carries the process id so two workers never collide on
 * it, and it is cleaned up on failure so a crashed build leaves no litter in
 * `public/`.
 */
export const hostFileIo: FencedFileIo = {
  read: async (p) => {
    try {
      return await fs.readFile(p, 'utf-8')
    } catch {
      return null
    }
  },
  write: async (p, content) => {
    const tmp = path.join(
      path.dirname(p),
      `.${path.basename(p)}.${process.pid}.tmp`,
    )
    try {
      await fs.writeFile(tmp, content, 'utf-8')
      await fs.rename(tmp, p)
    } catch (err) {
      await fs.rm(tmp, { force: true })
      throw err
    }
  },
}
