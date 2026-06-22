import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

/**
 * Locale-aware 404 page. Without an explicit `not-found.tsx` Next falls
 * back to its built-in `__next_error__` document, which has no
 * `<title>`, no `<main>`, and inherits `<html lang>` from the closest
 * matched layout — which for cross-route misses there isn't one. That
 * trips Lighthouse `document-title`, `html-has-lang`, and
 * `landmark-one-main` audits at once.
 *
 * The `<html lang>` comes from `[locale]/layout.tsx` which wraps this
 * file. We just need to provide a real `<main>` landmark, a localized
 * title, and a link back into the site.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'notFound' })
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  }
}

export default async function LocaleNotFound({
  params,
}: {
  // Next renders not-found pages without route params; we accept the
  // optional shape so the file works both as a thrown notFound() target
  // (gets locale from the segment) and as the fallback (no params).
  params?: Promise<{ locale?: string }>
}) {
  const resolved = (await params) ?? {}
  const locale = resolved.locale ?? 'en'
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
