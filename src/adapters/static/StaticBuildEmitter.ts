import fs from 'node:fs/promises'
import path from 'node:path'
import type { NoteRepository } from '@core/NoteRepository'
import type { Locale } from '@config/site'
import { buildSearchIndex } from '@core/search/BuildSearchIndex'
import { buildMentionGraph } from '@core/graph/BuildMentionGraph'

const OUT_ROOT = path.join(process.cwd(), 'public', '_static')

const emitted = new Set<Locale>()

/**
 * Emits per-locale JSON snapshots used by the static client. Each locale
 * gets its own subfolder: `public/_static/<locale>/{search-index,graph}.json`.
 */
export async function emitStaticData(
  repo: NoteRepository,
  locale: Locale,
): Promise<void> {
  if (emitted.has(locale)) return
  emitted.add(locale)

  const outDir = path.join(OUT_ROOT, locale)
  await fs.mkdir(outDir, { recursive: true })

  // No `notes-index.json`. It carried every note's full rendered `body` and
  // `rawText` and its only consumer was `StaticNoteRepository`, which nothing
  // ever constructed — `createRepository` always returns the filesystem
  // adapter. On the site this template was extracted from that was 3.8 MB
  // across three locales, published to the CDN on every deploy and fetched by
  // nobody. It also republished the full text of `noindex` notes in one
  // convenient blob.
  const [searchIndex, graph] = await Promise.all([
    buildSearchIndex(repo),
    buildMentionGraph(repo),
  ])

  await Promise.all([
    fs.writeFile(
      path.join(outDir, 'search-index.json'),
      JSON.stringify(searchIndex),
    ),
    fs.writeFile(
      path.join(outDir, 'graph.json'),
      JSON.stringify(graph),
    ),
  ])
}
