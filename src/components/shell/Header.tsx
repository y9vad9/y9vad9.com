'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { useLocaleLabel } from '@hooks/useLocaleLabel'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  Search,
  Globe,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react'
import { themeIconFor } from '@lib/themeIcon'
import { useThemeStore, THEMES, THEME_OPTIONS } from '@store/themeStore'
import { useSearchStore } from '@store/searchStore'
import { useOnClickOutside } from '@hooks/useOnClickOutside'
import { useBodyScrollLock } from '@hooks/useBodyScrollLock'
import { useSiteConfig } from '@lib/config/SiteConfigProvider'
import { useShortcutsEnabled } from '@hooks/useShortcutsEnabled'
import { navigation } from '~/content/navigation'
import type { NavGroup as NavGroupType, NavLink } from '@config/navigation'
import { LOCALES, MULTILINGUAL } from '@i18n/routing'
import type { Locale, ThemeOption } from '@config/site'

/**
 * Resolve a theme's display label. Tries the `theme.<id>` i18n key first
 * (covers the built-in themes), then the literal `label` field, then `id`.
 */
function themeLabel(
  id: string,
  t: (key: string) => string,
): string {
  const opt = THEME_OPTIONS.find((o) => o.id === id)
  try {
    const translated = t(opt?.label ?? id)
    if (translated && translated !== (opt?.label ?? id)) return translated
  } catch {
    // missing key — fall through
  }
  return opt?.label ?? id
}

function themeIcon(option: ThemeOption | undefined, size = 16): React.ReactNode {
  const Icon = themeIconFor(option?.icon)
  return <Icon size={size} />
}

function BrandMark() {
  const siteConfig = useSiteConfig()
  const branding = siteConfig.branding
  if (branding?.kind === 'image') {
    return (
      <Image
        src={branding.src}
        alt={branding.alt}
        width={branding.width ?? 28}
        height={branding.height ?? 28}
        className="h-7 w-auto"
      />
    )
  }
  return <>{branding?.kind === 'text' ? branding.text : siteConfig.owner.handle}</>
}

/**
 * Resolve a nav href against the active locale: site-relative paths get
 * the locale prefix, hash links land on the locale's home page, external
 * URLs pass through unchanged.
 */
function resolveHref(href: string, locale: string): string {
  if (/^[a-z]+:\/\//i.test(href)) return href
  if (href.startsWith('#')) return `/${locale}${href}`
  if (href.startsWith('/')) return `/${locale}${href}`
  return href
}

export function Header() {
  const tHeader = useTranslations('header')
  const tTheme = useTranslations('theme')
  const langLabel = useLocaleLabel()
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const { theme, cycleTheme } = useThemeStore()
  const openSearch = useSearchStore((s) => s.open)
  const shortcutsEnabled = useShortcutsEnabled()

  const [isVisible, setIsVisible] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const lastScrollY = useRef(0)
  const langRef = useOnClickOutside<HTMLDivElement>(langOpen, () => setLangOpen(false))

  // The drawer overlays the page, so the page behind it must not scroll —
  // otherwise a swipe meant for the drawer runs the article underneath.
  useBodyScrollLock(mobileOpen)

  useEffect(() => {
    // `useBodyScrollLock` pins the body with `position: fixed`, which drives
    // `window.scrollY` to 0 on open and back to the real offset on close.
    // Both look like scrolls to this handler, so the bar hid itself while the
    // drawer was open and again the moment it closed — neither triggered by
    // the reader moving through the page. Don't listen at all while it's open;
    // `barVisible` below keeps the bar on screen meanwhile.
    if (mobileOpen) return
    // Re-baseline before re-subscribing: the lock's cleanup restores the
    // scroll offset, and comparing that against the stale 0 from the pinned
    // body would read as a large downward scroll and hide the bar.
    lastScrollY.current = window.scrollY
    const handleScroll = () => {
      const current = window.scrollY
      setIsVisible(current < lastScrollY.current || current < 60)
      lastScrollY.current = current
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [mobileOpen])

  function switchLocale(next: Locale) {
    setLangOpen(false)
    // Strip current locale prefix and add new one
    const stripped = pathname.replace(`/${locale}`, '') || '/'
    router.push(`/${next}${stripped}`)
  }

  const navGroups: NavGroupType[] =
    navigation.byLocale?.[locale] ?? navigation.default

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-14 bg-bg/90 backdrop-blur border-b border-border transition-transform duration-300 ${
          // Pinned open while the drawer is: the bar carries the close
          // button, so sliding it away would strand the drawer without one.
          mobileOpen || isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 h-full flex items-center gap-4">
          {/* Logo */}
          <Link
            prefetch={false}
            href={`/${locale}`}
            className="font-bold text-fg hover:text-primary transition-colors mr-2 flex-shrink-0"
          >
            <BrandMark />
          </Link>

          {/* Right-aligned cluster: nav items → search → controls. */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <nav className="hidden md:flex items-center gap-1">
              {navGroups.map((group) => (
                <NavGroupRender key={group.label} group={group} locale={locale} />
              ))}
            </nav>

            <button
              onClick={() => openSearch()}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted hover:border-primary hover:text-fg transition-colors w-56"
              // No `aria-label` — see the note on the garden's search button.
              // "Press / to search" did not contain the visible "Search…", and
              // was wrong outright once the reader turned shortcuts off.
            >
              <Search size={14} className="flex-shrink-0" aria-hidden="true" />
              <span className="text-xs flex-1 text-left truncate">{tHeader('searchPlaceholder')}</span>
              {shortcutsEnabled && (
                <kbd
                  aria-hidden="true"
                  className="text-xs px-1.5 py-0.5 rounded border border-border font-mono flex-shrink-0"
                >
                  /
                </kbd>
              )}
            </button>

            {/* Language. Hidden on a single-locale site: the control would
                open a menu whose only entry is the language already in use.
                Same reasoning in the drawer below, in `NotesHeader`, and in
                the command palette — which gets it for free, since it lists
                only locales other than the current one. */}
            {MULTILINGUAL && (
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen((v) => !v)}
                className="p-2 rounded-lg hover:bg-card-hover transition-colors text-muted hover:text-fg"
                aria-label="Switch language"
              >
                <Globe size={16} />
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-32">
                  {LOCALES.map((l) => (
                    <button
                      key={l}
                      onClick={() => switchLocale(l)}
                      className={`w-full px-4 py-2 text-sm text-left hover:bg-card-hover transition-colors ${l === locale ? 'text-primary font-medium' : 'text-fg'}`}
                    >
                      {langLabel(l)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Theme */}
            <button
              onClick={cycleTheme}
              className="p-2 rounded-lg hover:bg-card-hover transition-colors text-muted hover:text-fg"
              aria-label={`Theme: ${themeLabel(theme, tTheme)}`}
              title={themeLabel(theme, tTheme)}
            >
              {themeIcon(THEME_OPTIONS.find((t) => t.id === theme))}
            </button>

            {/* Mobile hamburger. Same muted-to-fg treatment as the language
                and theme buttons beside it — without it this one inherited
                the body colour and read as the odd one out. */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-card-hover transition-colors text-muted hover:text-fg"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer.
          `h-dvh`, not the implicit height of `inset-0`: a fixed element is
          laid out against the *large* viewport, so on mobile Chrome its
          bottom sits behind the retractable toolbar and the last drawer
          entries were only reachable by overscrolling. `dvh` tracks the
          toolbar, and the safe-area pad clears the iOS home indicator. */}
      {mobileOpen && (
        <div className="fixed inset-0 h-dvh z-50 flex">
          <div
            className="flex-1 bg-fg/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="w-72 bg-bg border-l border-border flex flex-col p-4 gap-2 overflow-y-auto overscroll-contain"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold"><BrandMark /></span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 -m-1 rounded-lg text-muted hover:text-fg hover:bg-card-hover transition-colors"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            {navGroups.flatMap((group) =>
              group.items.map((item) => (
                <MobileNavItem
                  key={`${group.label}:${item.href}`}
                  href={resolveHref(item.href, locale)}
                  external={item.external}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </MobileNavItem>
              )),
            )}
            <hr className="border-border my-2" />
            {/* Language and theme are both rows of pills, and with nothing
                between them they read as one wrapped group — the more so
                because one row wraps to two lines and the other doesn't.
                A labelled section each makes the split unambiguous. */}
            {MULTILINGUAL && (
            <DrawerSection title={tHeader('language')}>
              {LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => { switchLocale(l); setMobileOpen(false) }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${l === locale ? 'border-primary text-primary' : 'border-border text-muted'}`}
                >
                  {langLabel(l)}
                </button>
              ))}
            </DrawerSection>
            )}

            <DrawerSection title={tHeader('theme')}>
              {THEMES.map((th) => (
                <button
                  key={th}
                  onClick={() => useThemeStore.getState().setTheme(th)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${theme === th ? 'border-primary text-primary' : 'border-border text-muted'}`}
                >
                  {themeLabel(th, tTheme)}
                </button>
              ))}
            </DrawerSection>
          </div>
        </div>
      )}
    </>
  )
}

function DrawerSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-3 first:mt-0">
      <h2 className="px-1 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted">
        {title}
      </h2>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </section>
  )
}

function NavGroupRender({
  group,
  locale,
}: {
  group: NavGroupType
  locale: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useOnClickOutside<HTMLDivElement>(open, () => setOpen(false))

  // Single-item groups render as a flat link instead of a dropdown.
  if (group.items.length === 1) {
    const only = group.items[0]
    return (
      <NavLeafLink href={resolveHref(only.href, locale)} external={only.external}>
        {group.label}
      </NavLeafLink>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-card-hover transition-colors"
      >
        {group.label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-44">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              href={resolveHref(item.href, locale)}
              external={item.external}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function NavLeafLink({
  href,
  external,
  children,
}: {
  href: string
  external?: boolean
  children: React.ReactNode
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-card-hover transition-colors"
      >
        {children}
      </a>
    )
  }
  return (
    <Link
      prefetch={false}
      href={href}
      className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-fg hover:bg-card-hover transition-colors"
    >
      {children}
    </Link>
  )
}

function NavLink({
  href,
  external,
  children,
}: {
  href: string
  external?: boolean
  children: React.ReactNode
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-4 py-2.5 text-sm text-fg hover:bg-card-hover hover:text-primary transition-colors"
      >
        {children}
      </a>
    )
  }
  return (
    <Link
      prefetch={false}
      href={href}
      className="block px-4 py-2.5 text-sm text-fg hover:bg-card-hover hover:text-primary transition-colors"
    >
      {children}
    </Link>
  )
}

function MobileNavItem({
  href,
  external,
  children,
  onClick,
}: {
  href: string
  external?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="block px-3 py-2 rounded-lg text-sm text-fg hover:bg-card-hover transition-colors"
      >
        {children}
      </a>
    )
  }
  return (
    <Link
      prefetch={false}
      href={href}
      onClick={onClick}
      className="block px-3 py-2 rounded-lg text-sm text-fg hover:bg-card-hover transition-colors"
    >
      {children}
    </Link>
  )
}
