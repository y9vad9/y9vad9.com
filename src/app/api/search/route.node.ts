import { NextRequest, NextResponse } from 'next/server'
import Fuse from 'fuse.js'
import { createRepository } from '@adapters/createRepositories'
import { buildSearchIndex } from '@core/search/BuildSearchIndex'
import { routing } from '@i18n/routing'
import type { SearchIndexEntry } from '@core/search/SearchIndex'

export const dynamic = 'force-dynamic'

const cachedIndexByLocale = new Map<string, Promise<SearchIndexEntry[]>>()

function getIndex(locale: string): Promise<SearchIndexEntry[]> {
  let cached = cachedIndexByLocale.get(locale)
  if (!cached) {
    cached = buildSearchIndex(createRepository(locale))
    cachedIndexByLocale.set(locale, cached)
  }
  return cached
}

const SNIPPET_RADIUS = 60
const MAX_HITS_PER_NOTE = 8

interface NoteOccurrenceHit {
  slug: string
  title: string
  parents: string[]
  date: string | null
  /** 0-based index of this occurrence within the note's rawText. */
  hit: number
  /** Substring of rawText around the match (length ~120 chars + ellipses). */
  snippet: string
  /** Character offset of the match inside the snippet. */
  matchStart: number
  /** Length of the match inside the snippet. */
  matchLength: number
}

function findOccurrences(
  entry: SearchIndexEntry,
  needle: string,
): NoteOccurrenceHit[] {
  const haystack = entry.rawText
  if (!haystack) return []
  const lowerHay = haystack.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const hits: NoteOccurrenceHit[] = []
  let from = 0
  let occurrence = 0
  while (occurrence < MAX_HITS_PER_NOTE) {
    const at = lowerHay.indexOf(lowerNeedle, from)
    if (at === -1) break
    const sStart = Math.max(0, at - SNIPPET_RADIUS)
    const sEnd = Math.min(haystack.length, at + needle.length + SNIPPET_RADIUS)
    const prefix = sStart > 0 ? '…' : ''
    const suffix = sEnd < haystack.length ? '…' : ''
    const snippetBody = haystack.slice(sStart, sEnd)
    hits.push({
      slug: entry.slug,
      title: entry.title,
      parents: entry.parents,
      date: entry.date,
      hit: occurrence,
      snippet: prefix + snippetBody + suffix,
      matchStart: prefix.length + (at - sStart),
      matchLength: needle.length,
    })
    from = at + needle.length
    occurrence += 1
  }
  return hits
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const fulltext = req.nextUrl.searchParams.get('fulltext') === '1'
  const requested = req.nextUrl.searchParams.get('locale') ?? routing.defaultLocale
  const locale = routing.locales.includes(requested) ? requested : routing.defaultLocale

  const index = await getIndex(locale)

  if (!q) {
    return NextResponse.json(index.slice(0, 20), {
      headers: { 'Cache-Control': 'public, max-age=60' },
    })
  }

  if (fulltext) {
    // Per-occurrence search: scan every note's body for substring matches and
    // emit one result per occurrence. This is what powers the in-note "find"
    // experience — each result jumps to a specific location, not a note.
    const out: NoteOccurrenceHit[] = []
    for (const entry of index) {
      const hits = findOccurrences(entry, q)
      for (const h of hits) {
        out.push(h)
        if (out.length >= 200) break
      }
      if (out.length >= 200) break
    }
    return NextResponse.json(out, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    })
  }

  // Title-only mode (quick lookup) — fuzzy weighted ranking, one result per note.
  const fuse = new Fuse(index, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'preview', weight: 0.25 },
      { name: 'parents', weight: 0.15 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
  })

  const tokens = q.split(/\s+/).filter((t) => t.length >= 2)
  const seeds = tokens.length > 0 ? tokens : [q]

  let merged: Map<string, { item: SearchIndexEntry; score: number }> | null = null
  for (const token of seeds) {
    const results = fuse.search(token)
    const map = new Map<string, { item: SearchIndexEntry; score: number }>()
    for (const r of results) {
      map.set(r.item.slug, { item: r.item, score: r.score ?? 1 })
    }
    if (merged === null) merged = map
    else {
      const next = new Map<string, { item: SearchIndexEntry; score: number }>()
      for (const [slug, prev] of merged) {
        const hit = map.get(slug)
        if (hit) next.set(slug, { item: prev.item, score: prev.score + hit.score })
      }
      merged = next
    }
    if (merged.size === 0) break
  }

  const results = Array.from((merged ?? new Map()).values())
    .sort((a, b) => a.score - b.score)
    .slice(0, 30)
    .map((r) => r.item)

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, max-age=60' },
  })
}
