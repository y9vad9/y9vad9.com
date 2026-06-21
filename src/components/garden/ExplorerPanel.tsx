'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { Search, BookOpen } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePanelStore } from '@store/panelStore'
import { useTabStore } from '@store/tabStore'
import { useNoteContextStore } from '@store/noteContextStore'
import { useListKeyboardNav } from '@hooks/useListKeyboardNav'
import { NoteLink } from './NoteLink'
import { buildFileTree, type FileTreeEntry } from '@lib/notes/buildFileTree'

import type { SearchIndexEntry } from '@core/search/SearchIndex'

interface OccurrenceHit {
  slug: string
  title: string
  parents: string[]
  date: string | null
  hit: number
  snippet: string
  matchStart: number
  matchLength: number
}

export interface NoteListItem {
  slug: string
  title: string
  series: string | null
  order: number | null
}

const SNIPPET_RADIUS = 60
const MAX_HITS_PER_NOTE = 8

function findOccurrences(
  entry: SearchIndexEntry,
  needle: string,
): OccurrenceHit[] {
  const haystack = entry.rawText
  if (!haystack) return []
  const lowerHay = haystack.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const hits: OccurrenceHit[] = []
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

export function ExplorerPanel({ notes }: { notes: NoteListItem[] }) {
  const t = useTranslations('explorer')
  const { explorerMode, explorerFocusNonce } = usePanelStore()
  const params = useParams<{ locale: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const currentSlug = pathname.split('/').pop() ?? ''

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<OccurrenceHit[]>([])
  const [searchIndex, setSearchIndex] = useState<SearchIndexEntry[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filterInputRef = useRef<HTMLInputElement>(null)
  const [fileFilter, setFileFilter] = useState('')

  const entries = useMemo(() => buildFileTree(notes), [notes])
  const filteredEntries = useMemo(() => {
    const q = fileFilter.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.displayTitle.toLowerCase().includes(q))
  }, [entries, fileFilter])

  // Default highlight to the currently-viewed note when it's in the list.
  const initialFilesIdx = useMemo(() => {
    const idx = filteredEntries.findIndex((e) => e.slug === currentSlug)
    return idx >= 0 ? idx : 0
    // Only recompute when the filtered list reshuffles, not on every nav.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEntries])

  const navigateToFile = useCallback(
    (entry: FileTreeEntry, modifier = false) => {
      const target = { slug: entry.slug, title: entry.displayTitle }
      const ctx = useNoteContextStore.getState()
      const current =
        ctx.currentSlug && ctx.currentTitle
          ? { slug: ctx.currentSlug, title: ctx.currentTitle }
          : null
      if (modifier) {
        useTabStore.getState().openInNewTab(target, current)
      } else {
        useTabStore.getState().replaceActive(target, ctx.currentSlug)
      }
      router.push(`/${params.locale}/notes/${entry.slug}`)
    },
    [router, params.locale],
  )

  const filesNav = useListKeyboardNav({
    count: filteredEntries.length,
    initialIdx: initialFilesIdx,
    resetKey: filteredEntries,
    onSelect: (idx, e) => {
      const entry = filteredEntries[idx]
      if (entry) navigateToFile(entry, e.metaKey || e.ctrlKey)
    },
  })

  // Dedicated scroll target for the currently-viewed note row. We can't
  // piggyback on the keyboard-nav hook's `scrollIntoView` for this:
  //   - The hook only scrolls when its `idx` state *changes*. On the
  //     panel's very first mount `idx` already equals the current
  //     note's index (via `initialIdx`), so a `setIdx(sameValue)` from
  //     us is a no-op and no scroll fires.
  //   - If we instead synced `idx` to the current note on every render,
  //     hover/keyboard moves would get snapped back to the active note
  //     (the bug we hit on the previous attempt).
  // So we keep a separate ref pointed at the active row and scroll it
  // into view whenever `currentSlug` or the visible list changes —
  // independent of the kbd cursor.
  const currentItemRef = useRef<HTMLAnchorElement | null>(null)
  useEffect(() => {
    if (!currentSlug) return
    currentItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentSlug, filteredEntries])

  const searchNav = useListKeyboardNav({
    count: searchResults.length,
    resetKey: searchResults,
    onSelect: (idx, e) => {
      const result = searchResults[idx]
      if (!result) return
      const target = { slug: result.slug, title: result.title }
      const ctx = useNoteContextStore.getState()
      const current =
        ctx.currentSlug && ctx.currentTitle
          ? { slug: ctx.currentSlug, title: ctx.currentTitle }
          : null
      if (e.metaKey || e.ctrlKey) {
        useTabStore.getState().openInNewTab(target, current)
      }
      router.push(
        `/${params.locale}/notes/${result.slug}?q=${encodeURIComponent(searchQuery)}&hit=${result.hit}`,
      )
    },
  })

  // Auto-focus when a keyboard shortcut requests it. Keyed on the nonce
  // alone so a mouse click on a mode tab doesn't yank focus into the input.
  useEffect(() => {
    if (explorerFocusNonce === 0) return
    if (explorerMode === 'files') {
      filterInputRef.current?.focus()
    } else {
      searchInputRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explorerFocusNonce])

  // Load search index dynamically on search panel usage in static mode
  useEffect(() => {
    if (
      process.env.NEXT_PUBLIC_ONVU_MODE === 'static' &&
      explorerMode === 'search' &&
      searchQuery.trim() &&
      searchIndex.length === 0
    ) {
      fetch(`/_static/${params.locale}/search-index.json`)
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then((data) => setSearchIndex(data))
        .catch(() => {})
    }
  }, [explorerMode, searchQuery, searchIndex.length, params.locale])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    if (process.env.NEXT_PUBLIC_ONVU_MODE === 'static') {
      if (searchIndex.length === 0) return
      const out: OccurrenceHit[] = []
      const q = searchQuery.trim()
      for (const entry of searchIndex) {
        const hits = findOccurrences(entry, q)
        for (const h of hits) {
          out.push(h)
          if (out.length >= 200) break
        }
        if (out.length >= 200) break
      }
      setSearchResults(out)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&fulltext=1`)
        if (res.ok) setSearchResults(await res.json())
      } catch {
        // graceful degradation
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [searchQuery, searchIndex])

  // Forward arrow keys / Enter from the filter & search inputs to the list
  // below so the user can type a filter and immediately step through results
  // without switching focus by hand.
  function forwardListKey(e: React.KeyboardEvent, target: typeof filesNav | typeof searchNav) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Home' || e.key === 'End') {
      target.onKeyDown(e as unknown as React.KeyboardEvent<HTMLDivElement>)
    }
  }

  return (
    <div className="kbd-section flex flex-col h-full overflow-hidden">
      {explorerMode === 'files' ? (
        <div className="flex flex-col h-full">
          <div className="p-2 flex-shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={filterInputRef}
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                onKeyDown={(e) => forwardListKey(e, filesNav)}
                placeholder={t('filterByName')}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-card-hover border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div
            {...filesNav.containerProps}
            className="flex-1 overflow-y-auto pb-2 focus:outline-none"
          >
            {filteredEntries.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted italic text-center">{t('noResults')}</p>
            )}
            {filteredEntries.map((entry, idx) => {
              const isCurrent = currentSlug === entry.slug
              const isKbd = filesNav.idx === idx
              const setKbdRef = filesNav.setItemRef(idx)
              const refCallback = (el: HTMLAnchorElement | null) => {
                // Keep the kbd hook's ref array in sync.
                setKbdRef(el)
                // Also park the active row's ref so the scroll-into-view
                // effect above can pull it back into the viewport on
                // navigation. We only assign on the current note; other
                // rows mustn't clobber it on their own ref callbacks.
                if (isCurrent) currentItemRef.current = el
              }
              return (
                <NoteLink
                  key={entry.slug}
                  slug={entry.slug}
                  title={entry.displayTitle}
                  href={`/${params.locale}/notes/${entry.slug}`}
                  ref={refCallback}
                  onMouseEnter={() => filesNav.setIdx(idx)}
                  className={`panel-item ${isCurrent ? 'is-active' : ''} ${isKbd ? 'is-kbd' : ''}`}
                  role="option"
                  aria-selected={isCurrent}
                >
                  <span className="truncate flex-1">{entry.displayTitle}</span>
                  {entry.isSeries && (
                    <BookOpen
                      size={11}
                      className="flex-shrink-0 text-muted opacity-50"
                      aria-label="Series"
                    />
                  )}
                </NoteLink>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="p-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => forwardListKey(e, searchNav)}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-card-hover border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div
            {...searchNav.containerProps}
            className="flex-1 overflow-y-auto focus:outline-none"
          >
            {searchResults.length === 0 && searchQuery && (
              <p className="px-3 py-4 text-xs text-muted italic text-center">{t('noResults')}</p>
            )}
            {searchResults.map((entry, idx) => (
              <NoteLink
                key={`${entry.slug}#${entry.hit}`}
                slug={entry.slug}
                title={entry.title}
                href={`/${params.locale}/notes/${entry.slug}?q=${encodeURIComponent(searchQuery)}&hit=${entry.hit}`}
                ref={searchNav.setItemRef(idx)}
                onMouseEnter={() => searchNav.setIdx(idx)}
                className={`panel-item-block ${idx === searchNav.idx ? 'is-active' : ''}`}
                role="option"
              >
                <p className="text-sm font-medium truncate">{entry.title}</p>
                <p className="text-xs text-muted line-clamp-2 mt-0.5">
                  {entry.snippet.slice(0, entry.matchStart)}
                  <mark className="bg-primary-muted text-primary px-0.5 rounded-sm">
                    {entry.snippet.slice(entry.matchStart, entry.matchStart + entry.matchLength)}
                  </mark>
                  {entry.snippet.slice(entry.matchStart + entry.matchLength)}
                </p>
                {entry.parents.length > 0 && (
                  <p className="text-[10px] text-primary mt-0.5 truncate">
                    {entry.parents.join(' · ')}
                  </p>
                )}
              </NoteLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
