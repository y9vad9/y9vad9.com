import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { DEFAULT_LOCALE } from '@i18n/routing'

/**
 * Locale-aware 404 page. Without an explicit `not-found.tsx` Next falls
 * back to its built-in `__next_error__` document, which has no
 * `<title>`, no `<main>`, and inherits `<html lang>` from the closest
 * matched layout — which for cross-route misses there isn't one. That
 * trips Lighthouse `document-title`, `html-has-lang`, and
 * `landmark-one-main` audits at once.
 *
 * The `<html lang>` comes from `[locale]/layout.tsx`, which wraps this file
 * and now genuinely carries the right language — it used to be hardcoded to
 * `en` in the root layout, which is what made this comment aspirational. We
 * just supply a real `<main>` landmark, a localised title, and a way back.
 */
/**
 * Which language this 404 speaks.
 *
 * The primary locale, unconditionally. Next renders `not-found.tsx` with no
 * route params, and the two ways to recover the real one both fail here:
 * `getLocale()` reads headers, which turns a statically generated note route
 * dynamic at runtime and 500s; and there is no request to inspect during a
 * static export at all.
 *
 * So a missing note under `/uk/` answers in the primary language. Not ideal,
 * but honest and, more to the point, *rendered* — this file previously
 * destructured `await params` in `generateMetadata`, which throws when params
 * is undefined, and the whole page fell through to Next's built-in
 * `__next_error__` document: no title, no `<main>` landmark, the three
 * Lighthouse audits this file exists to satisfy all failing, and invisible
 * because the response is a 404 either way.
 */
const LOCALE = DEFAULT_LOCALE

export async function generateMetadata(): Promise<Metadata> {
  // No `params` here: Next renders `not-found.tsx` without route params, so
  // destructuring `await params` threw and the whole page fell through to
  // Next's built-in `__next_error__` document — the exact outcome this file
  // exists to prevent, and invisible because the fallback still returns a 404.
  //
  // `getLocale()` reads the request locale the page set via
  // `setRequestLocale` before calling `notFound()`.
  const locale = LOCALE
  const t = await getTranslations({ locale, namespace: 'notFound' })
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  }
}

export default async function LocaleNotFound() {
  const locale = LOCALE
  const t = await getTranslations({ locale, namespace: 'notFound' })
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-widest text-muted mb-3">404</p>
      <h1 className="text-3xl font-bold mb-3">{t('title')}</h1>
      <p className="text-muted max-w-md mb-6">{t('description')}</p>
      <Link
        href={`/${locale}`}
        className="text-sm text-primary underline underline-offset-4 hover:opacity-80"
      >
        {t('goHome')}
      </Link>
    </main>
  )
}
