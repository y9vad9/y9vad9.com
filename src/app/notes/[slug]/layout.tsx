import type { Metadata } from 'next'
import fs from 'node:fs'
import path from 'node:path'
import { getTranslations } from 'next-intl/server'
import { DEFAULT_LOCALE } from '@i18n/routing'
import { Document } from '@components/shell/Document'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: DEFAULT_LOCALE, namespace: 'nav' })
  return { robots: 'noindex, follow', title: t('redirecting') }
}

export function generateStaticParams() {
  const notesDir = path.join(process.cwd(), 'content', 'notes', DEFAULT_LOCALE)
  try {
    return fs
      .readdirSync(notesDir, { recursive: true })
      .map((f) => String(f))
      .filter((f) => f.endsWith('.md') && !f.split(path.sep).some((s) => s.startsWith('_')))
      .map((f) => ({ slug: path.basename(f).replace(/\.md$/, '') }))
  } catch {
    return []
  }
}

/**
 * Renders the document itself: this route sits outside `[locale]`, and
 * `<html>` moved below that segment so it could carry the real language.
 * The default locale is the honest label for a URL that names none.
 */
export default async function RedirectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The visible label lives here, not in the page. The page has to be a client
  // component (it reads `localStorage` and `navigator.language` to pick a
  // locale), and this route sits outside `[locale]`, so it has no provider to
  // translate against. A server layout can ask for the strings directly.
  const t = await getTranslations({ locale: DEFAULT_LOCALE, namespace: 'nav' })
  return (
    <Document locale={DEFAULT_LOCALE}>
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-muted text-sm">{t('redirecting')}</span>
      </div>
      {children}
    </Document>
  )
}
