export interface FileTreeNote {
  slug: string
  title: string
  series: string | null
  order: number | null
}

export interface FileTreeEntry {
  slug: string
  displayTitle: string
  isSeries: boolean
}

/**
 * Collapses a flat note list into the entries shown in the Explorer's
 * "Files" tab. Each series becomes a single entry (whose slug is the
 * lowest-order member, used as the link target) and each standalone note is
 * its own entry.
 *
 * Order follows the input, which arrives newest-first from `listAllNotes`.
 * A series takes the position of its most recent member, so it sits among
 * the standalone notes by recency rather than ahead of them.
 *
 * This used to hoist every series above every standalone note. That put a
 * finished, archived 19-part course from 2022 at the very top of the
 * explorer, above notes written four years later — the sidebar's first
 * entry was the least current thing in the garden. Nothing about being a
 * series makes a note recent, so nothing about it should buy a position.
 *
 * Extracted from ExplorerPanel so the logic can be tested without
 * rendering React.
 */
export function buildFileTree(notes: FileTreeNote[]): FileTreeEntry[] {
  const seriesMembers = new Map<string, FileTreeNote[]>()
  for (const note of notes) {
    if (!note.series) continue
    if (!seriesMembers.has(note.series)) seriesMembers.set(note.series, [])
    seriesMembers.get(note.series)!.push(note)
  }

  const entries: FileTreeEntry[] = []
  const emitted = new Set<string>()

  for (const note of notes) {
    if (!note.series) {
      entries.push({ slug: note.slug, displayTitle: note.title, isSeries: false })
      continue
    }
    // The first time a series is reached is its newest member's position,
    // since the caller hands notes over newest-first.
    if (emitted.has(note.series)) continue
    emitted.add(note.series)

    // The link target stays the series' entry point rather than whichever
    // part happens to be newest — a reader clicking "Kotlin for beginners"
    // wants part one, not the last thing published in it.
    const first = seriesMembers
      .get(note.series)!
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]

    entries.push({ slug: first.slug, displayTitle: note.series, isSeries: true })
  }

  return entries
}
