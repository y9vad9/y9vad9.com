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
  Palette,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useThemeStore, THEMES, THEME_OPTIONS } from '@store/themeStore'
import { useSearchStore } from '@store/searchStore'
import { useSiteConfig } from '@lib/config/SiteConfigProvider'
import { navigation } from '~/content/navigation'
import type { NavGroup as NavGroupType, NavLink } from '@config/navigation'
import { LOCALES } from '@i18n/routing'
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
  const name = option?.icon
  if (name) {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[name]
    if (Icon) return <Icon size={size} />
  }
  return <Palette size={size} />
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

  const [isVisible, setIsVisible] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY
      setIsVisible(current < lastScrollY.current || current < 60)
      lastScrollY.current = current
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 h-full flex items-center gap-4">
          {/* Logo */}
          <Link
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
              aria-label={tHeader('searchHint')}
            >
              <Search size={14} className="flex-shrink-0" />
              <span className="text-xs flex-1 text-left truncate">{tHeader('searchPlaceholder')}</span>
              <kbd className="text-xs px-1.5 py-0.5 rounded border border-border font-mono flex-shrink-0">/</kbd>
            </button>

            {/* Language */}
            <div className="relative">
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

            {/* Theme */}
            <button
              onClick={cycleTheme}
              className="p-2 rounded-lg hover:bg-card-hover transition-colors text-muted hover:text-fg"
              aria-label={`Theme: ${themeLabel(theme, tTheme)}`}
              title={themeLabel(theme, tTheme)}
            >
              {themeIcon(THEME_OPTIONS.find((t) => t.id === theme))}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-card-hover transition-colors"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-fg/20 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="w-72 bg-bg border-l border-border flex flex-col p-4 gap-2">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold"><BrandMark /></span>
              <button onClick={() => setMobileOpen(false)}>
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
            <div className="flex gap-2">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => { switchLocale(l); setMobileOpen(false) }}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${l === locale ? 'border-primary text-primary' : 'border-border text-muted'}`}
                >
                  {langLabel(l)}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-1 flex-wrap">
              {THEMES.map((th) => (
                <button
                  key={th}
                  onClick={() => useThemeStore.getState().setTheme(th)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${theme === th ? 'border-primary text-primary' : 'border-border text-muted'}`}
                >
                  {themeLabel(th, tTheme)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
      href={href}
      onClick={onClick}
      className="block px-3 py-2 rounded-lg text-sm text-fg hover:bg-card-hover transition-colors"
    >
      {children}
    </Link>
  )
}
