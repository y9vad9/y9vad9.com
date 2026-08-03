import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { DEFAULT_LOCALE } from '@i18n/routing'
import { Document } from '@components/shell/Document'

/**
 * Root-level 404 — caught when the requested path doesn't match any
 * locale prefix at all. Supplies a `<title>` and a `<main>` landmark to
 * satisfy Lighthouse's Accessibility + SEO audits, and bounces the
 * visitor to the default locale's home.
 *
 * Renders its own `<Document>`: `<html>` moved below the `[locale]` segment
 * so it could carry the real language, and this route sits outside it. The
 * default locale is the honest label here — the request matched no locale at
 * all, so there is nothing better to claim.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: DEFAULT_LOCALE, namespace: 'notFound' })
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default async function NotFound() {
  // `getTranslations` with an explicit locale rather than `useTranslations`:
  // this route sits outside `[locale]`, so there is no request locale and no
  // client provider. The strings already existed in `messages/*.json` under
  // `notFound` — the page just rendered English literals past them.
  const t = await getTranslations({ locale: DEFAULT_LOCALE, namespace: 'notFound' })
  return (
    <Document locale={DEFAULT_LOCALE}>
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-widest text-muted mb-3">404</p>
        <h1 className="text-3xl font-bold mb-3">{t('title')}</h1>
        <p className="text-muted max-w-md mb-6">{t('description')}</p>
        <Link
          href={`/${DEFAULT_LOCALE}`}
          className="text-sm text-primary underline underline-offset-4 hover:opacity-80"
        >
          {t('goHome')}
        </Link>
      </main>
    </Document>
  )
}
