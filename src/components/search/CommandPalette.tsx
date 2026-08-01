'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X, FileText, Globe, Palette, Navigation, Command } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
// Type-only: erased at build. The constructor itself is pulled in on demand
// (see the loader below) so the fuzzy-search engine doesn't ship in the
// initial bundle of every page for a palette most visits never open.
import type Fuse from 'fuse.js'
import {
  parsePaletteQuery,
  mergeFuseResults,
  applyParentFilters,
} from '@lib/search/paletteQuery'
import { useSearchStore } from '@store/searchStore'
import { usePanelStore } from '@store/panelStore'
import { useShortcutsStore } from '@store/shortcutsStore'
import { useShortcutsEnabled } from '@hooks/useShortcutsEnabled'
import {
  GARDEN_SHORTCUTS,
  isMacPlatform,
  shortcutHint,
  type ShortcutActions,
} from '@lib/shortcuts/gardenShortcuts'
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
  const tCommands = useTranslations('commands')
  const shortcutsEnabled = useShortcutsEnabled()
  const langLabel = useLocaleLabel()
  const { isOpen, query, close, setQuery } = useSearchStore()
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useThemeStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [index, setIndex] = useState<SearchIndexEntry[]>([])
  // `useState` treats a bare function as a lazy initialiser, so the
  // constructor has to be stored wrapped — hence `setFuseCtor(() => ctor)`.
  const [FuseCtor, setFuseCtor] = useState<typeof Fuse | null>(null)
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

  // Load the search engine on the same trigger as the index. Both are useless
  // until the palette is open, and the index fetch already gates the first
  // query, so this adds no latency the user can perceive.
  useEffect(() => {
    if (!isOpen || FuseCtor) return
    let cancelled = false
    void import('fuse.js').then((mod) => {
      if (!cancelled) setFuseCtor(() => mod.default)
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, FuseCtor])

  // Focus input
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 0)
  }, [isOpen])

  // Keyboard shortcut to open.
  //
  // Governed by the same switch as everything else: "disable shortcuts" that
  // left `/` and double-Shift live would not be disabling shortcuts. The way
  // back is the search control in the header — always visible in the garden,
  // and on the landing page above the `md` breakpoint.
  useEffect(() => {
    if (!shortcutsEnabled) return
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
  }, [shortcutsEnabled])

  const fuse = useMemo(() => (FuseCtor
    ? new FuseCtor(index, {
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
    : null), [FuseCtor, index])

  // Split parent:foo filters out of the visible query (see paletteQuery.ts).
  const { cleanQuery, parentFilters } = useMemo(
    () => parsePaletteQuery(query),
    [query],
  )

  const noteResults = useMemo(() => {
    if (!cleanQuery && parentFilters.length === 0) return index.slice(0, 5)
    // `fuse` is null for the moment between opening the palette and the
    // engine arriving. Falling back to the unfiltered index keeps the list
    // populated instead of flashing "no results"; the index fetch it shares a
    // trigger with means this window is rarely visible at all.
    const fuseResults = cleanQuery && fuse ? mergeFuseResults(cleanQuery, fuse) : index
    return applyParentFilters(fuseResults, parentFilters).slice(0, 8)
  }, [cleanQuery, parentFilters, fuse, index])

  const otherLocales = LOCALES.filter((l) => l !== locale)
  const otherThemes = THEMES.filter((th) => th !== theme)

  // Commands are offered wherever the garden shell is mounted, since that is
  // where they have an effect. Whether the *chord* is advertised depends on
  // `shortcuts.enabled`: with bindings off the actions are still worth
  // listing — the palette is the non-keyboard way to reach them, which is
  // exactly what someone who turned the letter keys off needs — but printing
  // a key that no longer fires would be a lie.
  const gardenCommands = useMemo(
    () => (pathname.startsWith(`/${locale}/notes`) ? GARDEN_SHORTCUTS : []),
    [pathname, locale],
  )

  const commandActions = useMemo<ShortcutActions>(
    () => ({
      // Read through `getState()` rather than subscribing: the palette has no
      // reason to re-render when a panel toggles behind it.
      toggleLeft: () => usePanelStore.getState().toggleLeft(),
      toggleRight: () => usePanelStore.getState().toggleRight(),
      closeActiveTab: () => {
        const { activeSlug, closeTab } = useTabStore.getState()
        if (activeSlug) closeTab(activeSlug)
      },
      focusExplorer: (mode) => usePanelStore.getState().focusExplorer(mode),
      focusTools: (mode) => usePanelStore.getState().focusTools(mode),
    }),
    [],
  )

  const allResults = useMemo(() => {
    const r: Array<{
      type: string
      id: string
      label: string
      /** Keyboard chord, shown right-aligned. Commands only. */
      hint?: string
      onSelect: () => void
    }> = []

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

    // Garden commands. Listed only where they do something: the bindings are
    // installed by the notes layout, so on the landing page these would be
    // dead entries. Each carries its chord so the palette doubles as the
    // place you learn the shortcuts exist.
    if (gardenCommands.length > 0) {
      const isMac = isMacPlatform()
      for (const shortcut of gardenCommands) {
        const label = tCommands(shortcut.id)
        if (q && !label.toLowerCase().includes(q)) continue
        r.push({
          type: 'command',
          id: shortcut.id,
          label,
          hint: shortcutsEnabled ? shortcutHint(shortcut, isMac) : undefined,
          onSelect: () => shortcut.run(commandActions),
        })
      }
    }

    // The switch itself, listed everywhere rather than only in the garden:
    // it governs the palette's own `/` and double-Shift too, so someone who
    // turned shortcuts off needs to find it from wherever they are. It is
    // also the only way back once the keyboard route is closed.
    const toggleLabel = shortcutsEnabled
      ? tCommands('disableShortcuts')
      : tCommands('enableShortcuts')
    if (!q || toggleLabel.toLowerCase().includes(q) || 'shortcuts'.includes(q)) {
      r.push({
        type: 'command',
        id: 'toggleShortcuts',
        label: toggleLabel,
        onSelect: () => useShortcutsStore.getState().setPreference(!shortcutsEnabled),
      })
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
  }, [cleanQuery, noteResults, otherLocales, otherThemes, locale, pathname, router, langLabel,
    tTheme, tNav, setTheme, gardenCommands, commandActions, shortcutsEnabled, tCommands])

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
    command: <Command size={13} className="text-muted" />,
  }

  const LABELS: Record<string, string> = {
    nav: t('navigation'),
    note: t('notes'),
    lang: t('languages'),
    theme: t('themes'),
    command: tCommands('heading'),
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
                    {/* The chord is the discoverability payload — it stays
                        visible whether or not the row is highlighted, so
                        scanning the list teaches the shortcuts. */}
                    {item.hint && (
                      <kbd className="text-xs px-1.5 py-0.5 rounded border border-border text-muted flex-shrink-0">
                        {item.hint}
                      </kbd>
                    )}
                    {isHighlighted && !item.hint && (
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
