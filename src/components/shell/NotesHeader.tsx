'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import {
  PanelLeft,
  PanelRight,
  Search,
  Home,
  Sprout,
  Globe,
  Network,
} from 'lucide-react'
import { usePanelStore } from '@store/panelStore'
import { useThemeStore } from '@store/themeStore'
import { useNoteContextStore } from '@store/noteContextStore'
import { useTabStore } from '@store/tabStore'
import { useSearchStore } from '@store/searchStore'
import { useIsMobile } from '@hooks/useMediaQuery'
import { useOnClickOutside } from '@hooks/useOnClickOutside'
import { EXPLORER_MODES, TOOLS_MODES } from '@components/garden/PanelModeTabs'
import { TabBar } from '@components/garden/TabBar'
import { RouteLink } from '@components/garden/RouteLink'
import { INDEX_TAB_SLUG, GRAPH_TAB_SLUG } from '@store/tabStore'
import { LOCALES, MULTILINGUAL } from '@i18n/routing'
import type { Locale } from '@config/site'
import { useLocaleLabel } from '@hooks/useLocaleLabel'
import { useLocaleSwitch } from '@hooks/useLocaleSwitch'
import { useShortcutsEnabled } from '@hooks/useShortcutsEnabled'
import { themeIconFor } from '@lib/themeIcon'
import { themeLabel, THEMEABLE, THEME_OPTIONS } from '@lib/theme'
import { useState } from 'react'

export function NotesHeader() {
  const tTheme = useTranslations('theme')
  const tA11y = useTranslations('a11y')
  const langLabel = useLocaleLabel()
  const tExplorer = useTranslations('explorer')
  const tPanel = useTranslations('panel')
  const tCommand = useTranslations('search')
  const tGarden = useTranslations('garden')
  const tNav = useTranslations('nav')
  const locale = useLocale() as Locale
  const {
    leftOpen,
    rightOpen,
    explorerMode,
    toolsMode,
    toggleLeft,
    toggleRight,
    setExplorerMode,
    setToolsMode,
  } = usePanelStore()
  const { theme, cycleTheme } = useThemeStore()
  const { series } = useNoteContextStore()
  const tabsCount = useTabStore((s) => s.tabs.length)
  const openSearch = useSearchStore((s) => s.open)
  const shortcutsEnabled = useShortcutsEnabled()
  const isMobile = useIsMobile()
  const goToLocale = useLocaleSwitch()
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useOnClickOutside<HTMLDivElement>(langOpen, () => setLangOpen(false))

  function switchLocale(target: Locale) {
    setLangOpen(false)
    goToLocale(target)
  }

  // On mobile both panels overlay the content as drawers, so they're mutually
  // exclusive — opening one closes the other.
  function onToggleLeft() {
    if (isMobile && !leftOpen && rightOpen) toggleRight()
    toggleLeft()
  }
  function onToggleRight() {
    if (isMobile && !rightOpen && leftOpen) toggleLeft()
    toggleRight()
  }

  return (
    <header className="h-11 bg-shell flex items-center gap-1 px-2 flex-shrink-0 z-40 sticky top-0">
      {/* Left panel toggle + its section buttons (when open) */}
      <button
        onClick={onToggleLeft}
        className={`p-1.5 rounded hover:bg-card-hover transition-colors ${leftOpen ? 'text-primary' : 'text-muted'}`}
        aria-label={tA11y('toggleExplorer')}
        title={tA11y('toggleExplorer')}
      >
        <PanelLeft size={16} />
      </button>

      {/* Desktop only. On mobile these live inside the drawer itself — see
          `PanelModeTabs`. Squeezing four tools buttons plus two explorer
          buttons into a phone-width navbar crushed the tab bar and search
          trigger next to them. */}
      {leftOpen && !isMobile && (
        <>
          <Divider />
          {EXPLORER_MODES.map(({ mode, icon, titleKey, hint }) => (
            <HeaderModeButton
              key={mode}
              active={explorerMode === mode}
              onClick={() => setExplorerMode(mode)}
              title={`${tExplorer(titleKey)} (${hint})`}
              icon={icon}
            />
          ))}
          <Divider />
        </>
      )}

      {/* Primary navigation */}
      <Link
        prefetch={false}
        href={`/${locale}`}
        className="p-1.5 rounded hover:bg-card-hover text-muted hover:text-fg transition-colors"
        title={tNav('home')}
        aria-label={tNav('home')}
      >
        <Home size={15} />
      </Link>
      <RouteLink
        href={`/${locale}/notes`}
        routeSlug={INDEX_TAB_SLUG}
        routeTitle={tGarden('welcome')}
        routeKind="index"
        className="p-1.5 rounded hover:bg-card-hover text-muted hover:text-fg transition-colors"
        title={tNav('notesGarden')}
        aria-label={tNav('notesGarden')}
      >
        <Sprout size={15} />
      </RouteLink>
      <RouteLink
        href={`/${locale}/notes/graph`}
        routeSlug={GRAPH_TAB_SLUG}
        routeTitle={tGarden('knowledgeGraph')}
        routeKind="graph"
        className="p-1.5 rounded hover:bg-card-hover text-muted hover:text-fg transition-colors"
        title={tGarden('knowledgeGraph')}
        aria-label={tGarden('knowledgeGraph')}
      >
        <Network size={15} />
      </RouteLink>

      {/* Center: search trigger (when there are 0 or 1 tabs) or tab bar. */}
      <div className="flex-1 overflow-hidden mx-2 flex items-center justify-center min-w-0">
        {tabsCount >= 2 ? (
          <div className="flex-1 overflow-hidden min-w-0">
            <TabBar />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openSearch()}
            className="w-full max-w-sm flex items-center gap-2 h-7 px-3 rounded-full bg-card-hover border border-border text-muted hover:text-fg hover:border-primary/40 transition-colors text-xs"
            // No `aria-label`. It read "Open command palette" while the button
            // visibly says "Search notes, pages, themes…", so the accessible
            // name did not contain the visible one — a voice-control user
            // saying what they can see would not match the control
            // (`label-content-name-mismatch`). Letting the visible text be the
            // name keeps the two identical by construction.
          >
            <Search size={12} className="flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 text-start truncate">
              {tCommand('placeholder')}
            </span>
            {shortcutsEnabled && (
              // Part of the name otherwise: "Search notes, pages, themes… /".
              <span
                aria-hidden="true"
                className="flex-shrink-0 px-1.5 py-px text-[10px] font-mono border border-border rounded text-muted"
              >
                /
              </span>
            )}
          </button>
        )}
      </div>

      {/* Theme + Lang. Both hidden when there is nothing to switch between. */}
      {THEMEABLE && (
      <button
        onClick={cycleTheme}
        className="p-1.5 rounded hover:bg-card-hover text-muted hover:text-fg transition-colors"
        aria-label={`Theme: ${themeLabel(theme, tTheme)}`}
        title={themeLabel(theme, tTheme)}
      >
        {/* Resolved through `ThemeOption.icon` like the landing header does.
            This used to be a hardcoded map of the five built-in ids, so a
            custom theme rendered `undefined` — an empty, clickable button. */}
        {(() => {
          const Icon = themeIconFor(THEME_OPTIONS.find((t) => t.id === theme)?.icon)
          return <Icon size={14} />
        })()}
      </button>
      )}

      {/* Hidden on a single-locale site — see the note in `Header`. */}
      {MULTILINGUAL && (
      <div className="relative" ref={langRef}>
        <button
          onClick={() => setLangOpen((v) => !v)}
          className="p-1.5 rounded hover:bg-card-hover text-muted hover:text-fg transition-colors"
          aria-label={tA11y('switchLanguage')}
        >
          <Globe size={15} />
        </button>
        {langOpen && (
          <div className="absolute end-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-28">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => switchLocale(l)}
                className={`w-full px-3 py-2 text-xs text-start hover:bg-card-hover transition-colors ${l === locale ? 'text-primary font-medium' : 'text-fg'}`}
              >
                {langLabel(l)}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Right panel section buttons (when open), then divider, then collapse */}
      {rightOpen && !isMobile && (
        <>
          <Divider />
          {TOOLS_MODES.filter(({ mode }) => mode !== 'series' || !!series).map(({ mode, icon, titleKey, hint }) => (
            <HeaderModeButton
              key={mode}
              active={toolsMode === mode}
              onClick={() => setToolsMode(mode)}
              title={`${tPanel(titleKey)} (${hint})`}
              icon={icon}
            />
          ))}
          <Divider />
        </>
      )}

      <button
        onClick={onToggleRight}
        className={`p-1.5 rounded hover:bg-card-hover transition-colors ${rightOpen ? 'text-primary' : 'text-muted'}`}
        aria-label={tA11y('toggleTools')}
        title={tA11y('toggleTools')}
      >
        <PanelRight size={16} />
      </button>
    </header>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-1 flex-shrink-0" aria-hidden="true" />
}

function HeaderModeButton({
  active,
  onClick,
  title,
  icon,
}: {
  active: boolean
  onClick: () => void
  title: string
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-primary-muted text-primary'
          : 'text-muted hover:bg-card-hover hover:text-fg'
      }`}
    >
      {icon}
    </button>
  )
}
