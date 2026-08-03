'use client'

import { useEffect, useRef, useState } from 'react'
import { publicOrigin } from '@lib/publicPath'
import { Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useThemeStore } from '@store/themeStore'

/**
 * Resolves the `data-theme` value Giscus expects for one of our built-in
 * palettes. For light / dark / warm / forest we ship a custom CSS file
 * under `/giscus/<theme>.css` so the comment widget matches the rest of
 * the page exactly. The URL must be absolute because Giscus loads it
 * from inside its own `giscus.app` iframe — a site-relative path would
 * resolve against giscus.app and 404. `window.location.origin` is read
 * at call time so the same code works on localhost, staging and prod.
 *
 * `system` stays on Giscus's `preferred_color_scheme` preset; matching
 * that with a custom CSS would require two files and a way to swap them
 * on OS preference changes, and the preset already does that internally.
 */
const CUSTOM_THEMES = new Set(['light', 'dark', 'warm', 'forest'])

function giscusTheme(theme: string): string {
  if (typeof window === 'undefined') return 'preferred_color_scheme'
  if (theme === 'system') return 'preferred_color_scheme'
  if (!CUSTOM_THEMES.has(theme)) return 'preferred_color_scheme'
  return `${publicOrigin()}/giscus/${theme}.css`
}

/** Locales Giscus has a UI translation for. Anything else falls back to English. */
const GISCUS_LANGS = new Set([
  'de', 'gsw', 'en', 'es', 'fr', 'id', 'it', 'ja', 'ko',
  'nl', 'pl', 'pt', 'ro', 'ru', 'tr', 'uk', 'vi', 'zh-CN', 'zh-TW',
  'fa', 'he', 'th',
])
function giscusLang(locale: string): string {
  if (GISCUS_LANGS.has(locale)) return locale
  const primary = locale.split('-')[0]
  return GISCUS_LANGS.has(primary) ? primary : 'en'
}

export interface GiscusConfig {
  repo: string
  repoId: string
  category: string
  categoryId: string
}

export function GiscusComments({ config }: { config: GiscusConfig }) {
  const t = useTranslations('comments')
  const locale = useLocale()
  const theme = useThemeStore((s) => s.theme)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)
  /** Flips true once the giscus iframe has fired its `load` event. Used
   *  to swap the spinner for the rendered widget. */
  const [loaded, setLoaded] = useState(false)

  // Lazy-load when within ~1000px of viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el || shouldLoad) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '1000px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [shouldLoad])

  // Mount/update the Giscus script
  useEffect(() => {
    if (!shouldLoad) return
    const el = containerRef.current
    if (!el) return

    // Each script (re-)mount starts a fresh load cycle — the iframe gets
    // recreated, so the spinner should come back until the new one
    // finishes loading.
    setLoaded(false)
    el.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.crossOrigin = 'anonymous'
    script.async = true
    script.setAttribute('data-repo', config.repo)
    script.setAttribute('data-repo-id', config.repoId)
    script.setAttribute('data-category', config.category)
    script.setAttribute('data-category-id', config.categoryId)
    script.setAttribute('data-mapping', 'pathname')
    script.setAttribute('data-strict', '0')
    script.setAttribute('data-reactions-enabled', '1')
    script.setAttribute('data-emit-metadata', '0')
    script.setAttribute('data-input-position', 'top')
    script.setAttribute('data-theme', giscusTheme(theme))
    script.setAttribute('data-lang', giscusLang(locale))
    script.setAttribute('data-loading', 'lazy')
    el.appendChild(script)
  }, [shouldLoad, config, theme, locale])

  // Detect when the giscus iframe has finished loading so the spinner
  // can disappear. Giscus's `client.js` injects the iframe into our
  // container asynchronously, so a MutationObserver picks it up the
  // moment it appears; from there we listen for its native `load` event.
  // Fallback: if `load` doesn't fire within 10s (slow network, ad
  // blocker eating the request), hide the spinner anyway so the panel
  // stops claiming it's still working.
  useEffect(() => {
    if (!shouldLoad || loaded) return
    const el = containerRef.current
    if (!el) return

    let cleanupIframe: (() => void) | null = null
    const wait = new MutationObserver(() => {
      const iframe = el.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
      if (!iframe) return
      wait.disconnect()
      const onLoad = () => setLoaded(true)
      iframe.addEventListener('load', onLoad, { once: true })
      cleanupIframe = () => iframe.removeEventListener('load', onLoad)
      // Some browsers complete the load before our listener attaches.
      if (iframe.contentDocument?.readyState === 'complete') {
        setLoaded(true)
      }
    })
    wait.observe(el, { childList: true, subtree: true })

    const timeout = window.setTimeout(() => setLoaded(true), 10_000)

    return () => {
      wait.disconnect()
      window.clearTimeout(timeout)
      cleanupIframe?.()
    }
  }, [shouldLoad, loaded])

  // Update theme without re-creating the iframe
  useEffect(() => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
    if (!iframe) return
    iframe.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: giscusTheme(theme) } } },
      'https://giscus.app',
    )
  }, [theme])

  return (
    <section className="mt-10 pt-6 border-t border-border">
      <h3 className="text-xs uppercase tracking-wide font-medium text-muted mb-4">
        {t('title')}
      </h3>
      <div className="relative">
        <div ref={containerRef} className="giscus" />
        {shouldLoad && !loaded && (
          <div
            className="flex items-center justify-center gap-2 py-8 text-muted text-sm"
            aria-live="polite"
          >
            <Loader2 size={16} className="animate-spin" />
            <span>{t('loading')}</span>
          </div>
        )}
      </div>
    </section>
  )
}
