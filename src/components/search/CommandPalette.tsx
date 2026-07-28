'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X, FileText, Globe, Palette, Navigation } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import Fuse from 'fuse.js'
import {
  parsePaletteQuery,
  mergeFuseResults,
  applyParentFilters,
} from '@lib/search/paletteQuery'
import { useSearchStore } from '@store/searchStore'
import { useThemeStore, THEMES } from '@store/themeStore'
import { useTabStore } from '@store/tabStore'
import { useNoteContextStore } from '@store/noteContextStore'
import { LOCALES } from '@i18n/routing'
import { useLocaleLabel } from '@hooks/useLocaleLabel'
import type { SearchIndexEntry } from '@core/search/SearchIndex'
import type { Locale } from '@config/site'

const cachedIndex = new Map<string, SearchIndexEntry[]>()

async function loadIndex(locale: string): Promise<SearchIndexEntry[]> {
  const hit = cachedIndex.get(locale)
  if (hit) return hit
  const url = process.env.NEXT_PUBLIC_ONVU_MODE === 'static'
    ? `/_static/${locale}/search-index.json`
    : `/api/search-index?locale=${encodeURIComponent(locale)}`
  const res = await fetch(url)
  if (res.ok) {
    const data: SearchIndexEntry[] = await res.json()
    cachedIndex.set(locale, data)
    return data
  }
  return []
}

export function CommandPalette() {
  const t = useTranslations('search')
  const tTheme = useTranslations('theme')
  const tNav = useTranslations('nav')
  const langLabel = useLocaleLabel()
  const { isOpen, query, close, setQuery } = useSearchStore()
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useThemeStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [index, setIndex] = useState<SearchIndexEntry[]>([])
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    itemRefs.current[highlightedIdx]?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIdx])

  // Open the palette if the page is loaded with `?search=true` (deep-linkable
  // entry from other surfaces). We deliberately do NOT mirror the open/query
  // state back to the URL — Next's `router.push` and `window.history`-based
  // URL mutation race each other, which made selecting a result silently
  // not navigate.
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('search') === 'true') {
      useSearchStore.getState().open(searchParams.get('q') ?? '')
    }
  }, [searchParams])

  // Load index
  useEffect(() => {
    if (isOpen && index.length === 0) {
      loadIndex(locale).then(setIndex)
    }
  }, [isOpen, index.length, locale])

  // Focus input
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 0)
  }, [isOpen])

  // Keyboard shortcut to open
  useEffect(() => {
    let lastShift = 0
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === '/') {
        e.preventDefault()
        useSearchStore.getState().open()
      }
      if (e.key === 'Shift') {
        const now = Date.now()
        if (now - lastShift < 400) useSearchStore.getState().open()
        lastShift = now
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const fuse = useMemo(() => new Fuse(index, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'preview', weight: 0.25 },
      { name: 'parents', weight: 0.15 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
  }), [index])

  // Split parent:foo filters out of the visible query (see paletteQuery.ts).
  const { cleanQuery, parentFilters } = useMemo(
    () => parsePaletteQuery(query),
    [query],
  )

  const noteResults = useMemo(() => {
    if (!cleanQuery && parentFilters.length === 0) return index.slice(0, 5)
    const fuseResults = cleanQuery ? mergeFuseResults(cleanQuery, fuse) : index
    return applyParentFilters(fuseResults, parentFilters).slice(0, 8)
  }, [cleanQuery, parentFilters, fuse, index])

  const otherLocales = LOCALES.filter((l) => l !== locale)
  const otherThemes = THEMES.filter((th) => th !== theme)

  const allResults = useMemo(() => {
    const r: Array<{ type: string; id: string; label: string; onSelect: () => void }> = []

    // Navigation. Match the user's typed query against the localised label
    // so e.g. typing "Гол" surfaces Головна on the uk locale; falling back
    // to the English form keeps "home" / "notes" working as universal
    // hotwords regardless of UI language.
    const homeLabel = tNav('home')
    const gardenLabel = tNav('notesGarden')
    const q = cleanQuery.toLowerCase()
    if (!q || homeLabel.toLowerCase().includes(q) || 'home'.includes(q)) {
      r.push({ type: 'nav', id: 'home', label: homeLabel, onSelect: () => router.push(`/${locale}`) })
    }
    if (
      !q ||
      gardenLabel.toLowerCase().includes(q) ||
      'notes garden'.includes(q)
    ) {
      r.push({ type: 'nav', id: 'notes', label: gardenLabel, onSelect: () => router.push(`/${locale}/notes`) })
    }

    // Notes
    noteResults.forEach((n) =>
      r.push({ type: 'note', id: n.slug, label: n.title, onSelect: () => router.push(`/${locale}/notes/${n.slug}`) }),
    )

    // Languages
    otherLocales.forEach((l) =>
      r.push({ type: 'lang', id: l, label: langLabel(l), onSelect: () => router.push(`/${l}${pathname.replace(`/${locale}`, '')}`) }),
    )

    // Themes
    otherThemes.forEach((th) =>
      r.push({ type: 'theme', id: th, label: tTheme(th), onSelect: () => setTheme(th as Parameters<typeof setTheme>[0]) }),
    )

    return r
  }, [cleanQuery, noteResults, otherLocales, otherThemes, locale, pathname, router, langLabel, tTheme, tNav, setTheme])

  function pickItem(
    item: (typeof allResults)[number],
    opts: { newTab?: boolean } = {},
  ) {
    if (opts.newTab && item.type === 'note') {
      const ctx = useNoteContextStore.getState()
      const current =
        ctx.currentSlug && ctx.currentTitle
          ? { slug: ctx.currentSlug, title: ctx.currentTitle }
          : null
      useTabStore.getState().openInNewTab(
        { slug: item.id, title: item.label },
        current,
      )
      router.push(`/${locale}/notes/${item.id}`)
    } else {
      item.onSelect()
    }
    close()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const n = allResults.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIdx((i) => (n === 0 ? 0 : (i + 1) % n))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIdx((i) => (n === 0 ? 0 : (i - 1 + n) % n))
    } else if (e.key === 'Enter') {
      const item = allResults[highlightedIdx]
      if (item) pickItem(item, { newTab: e.metaKey || e.ctrlKey })
    } else if (e.key === 'Escape') {
      close()
    }
  }

  if (!isOpen) return null

  const ICONS: Record<string, React.ReactNode> = {
    nav: <Navigation size={13} className="text-muted" />,
    note: <FileText size={13} className="text-muted" />,
    lang: <Globe size={13} className="text-muted" />,
    theme: <Palette size={13} className="text-muted" />,
  }

  const LABELS: Record<string, string> = {
    nav: t('navigation'),
    note: t('notes'),
    lang: t('languages'),
    theme: t('themes'),
  }

  // Group results by type for rendering
  const grouped = allResults.reduce<Record<string, typeof allResults>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type].push(item)
    return acc
  }, {})

  let globalIdx = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={close}
    >
      <div
        className="absolute inset-0 bg-fg/20 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlightedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            // 16px below `sm`: iOS Safari zooms the viewport on focus for
            // anything smaller, and never zooms back out.
            className="flex-1 bg-transparent text-base sm:text-sm focus:outline-none placeholder:text-muted"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted hover:text-fg transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {allResults.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted text-center">{t('noResults')}</p>
          )}
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <div className="px-4 py-1.5 text-xs font-medium text-muted uppercase tracking-wide bg-bg/50">
                {LABELS[type]}
              </div>
              {items.map((item) => {
                const idx = globalIdx++
                const isHighlighted = idx === highlightedIdx
                return (
                  <button
                    key={item.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el
                      return () => { itemRefs.current[idx] = null }
                    }}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    onClick={(e) => pickItem(item, { newTab: e.metaKey || e.ctrlKey })}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                      isHighlighted ? 'bg-primary-muted text-primary' : 'text-fg hover:bg-card-hover'
                    }`}
                  >
                    {ICONS[item.type]}
                    <span className="flex-1 truncate">{item.label}</span>
                    {isHighlighted && (
                      <span className="text-xs text-muted flex-shrink-0">{t('view')}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted">
          <span>{t('moveHint')}</span>
          <span>{t('selectHint')}</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  )
}
