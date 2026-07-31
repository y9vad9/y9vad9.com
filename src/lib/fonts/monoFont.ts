import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

/**
 * Self-hosted GeistMono, so its preload can be decided per page.
 *
 * Sans stays on `next/font`, which handles it well. Mono cannot, for a
 * measured reason: `next/font` preloads on every route that references the
 * font, and the reference lives in the root layout — so all 19 notes paid
 * 70 KB for a face that only the ~10 containing code actually render.
 *
 * Measured on the heaviest note (no code blocks), median of 5:
 *
 *   mono preloaded + loaded (before)   FCP 930ms  LCP 2580ms  636 KB  score 97
 *   mono never loaded                  FCP 930ms  LCP 2280ms  566 KB  score 98
 *
 * FCP is untouched because an absent face falls back instantly. Dropping only
 * the *preload* is the trap — the font still loads, just late, and then text
 * waits on it: FCP 1230ms, LCP unchanged, 636 KB. A preload changes when a
 * font arrives, never whether, so it can never remove bytes on its own.
 *
 * `NextFont` exposes only `className`/`style`/`variable` — never the emitted
 * URL — so a conditional preload is impossible while `next/font` owns the
 * file. Hence a fixed, self-owned path.
 */
export const MONO_FONT_URL = '/fonts/geist-mono.woff2'

const RELATIVE_SOURCE = ['fonts', 'geist-mono', 'GeistMono-Variable.woff2']

/**
 * `geist`'s `exports` map has no entry for the font files, so the woff2
 * cannot be `require.resolve`d directly — that throws
 * ERR_PACKAGE_PATH_NOT_EXPORTED. Resolving the exported `geist/font/mono`
 * entrypoint and stepping to its sibling font directory stays within the
 * exports map while surviving whatever layout the installer chose.
 */
function locateSource(): string {
  const candidates: string[] = []
  try {
    const resolve = createRequire(path.join(process.cwd(), 'package.json')).resolve
    candidates.push(path.join(path.dirname(resolve('geist/font/mono')), ...RELATIVE_SOURCE))
  } catch {
    // Fall through to the layout-dependent guess below.
  }
  candidates.push(
    path.join(process.cwd(), 'node_modules', 'geist', 'dist', ...RELATIVE_SOURCE),
  )
  return candidates[0]!
}

let inflight: Promise<void> | null = null

/**
 * Copy the font into `public/` so the static export picks it up, exactly as
 * `encodeResponsive` does for images. Runs once per build — the root layout
 * awaits it, so the file is in place long before the export step copies
 * `public/`. Idempotent: an existing file is left alone.
 */
export function ensureMonoFont(): Promise<void> {
  inflight ??= (async () => {
    const dest = path.join(process.cwd(), 'public', 'fonts', 'geist-mono.woff2')
    try {
      await fs.access(dest)
      return
    } catch {
      // Not generated yet.
    }
    const source = locateSource()
    let buffer: Buffer
    try {
      buffer = await fs.readFile(source)
    } catch {
      // Loud rather than silent: a missing file here would 404 at runtime and
      // silently degrade every code block to the fallback face.
      throw new Error(
        `Could not read the GeistMono font at ${source}. ` +
          'Is the `geist` package installed?',
      )
    }
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, buffer)
  })()
  return inflight
}

/**
 * Does this rendered note actually put something on screen in the mono face?
 *
 * Mirrors the `var(--font-geist-mono)` selectors in `globals.css`: fenced and
 * inline code, the pretty-code figure chrome, and the pre-render Mermaid
 * placeholder. The UI chrome that also *looks* monospaced — the `/` hint,
 * header badges — deliberately no longer uses this face, precisely so its
 * presence in the layout can't force the download on every page.
 */
const MONO_CONTENT = /<pre[\s>]|<code[\s>]|class="[^"]*\bmermaid\b/

export function needsMonoFont(html: string): boolean {
  return MONO_CONTENT.test(html)
}
