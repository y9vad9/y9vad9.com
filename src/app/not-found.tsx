import Link from 'next/link'
import type { Metadata } from 'next'
import { DEFAULT_LOCALE } from '@i18n/routing'

/**
 * Root-level 404 — caught when the requested path doesn't match any
 * locale prefix at all. Renders inside the root `<html lang="en">` from
 * `app/layout.tsx`, supplies a `<title>` and a `<main>` landmark to
 * satisfy Lighthouse's Accessibility + SEO audits, and bounces the
 * visitor to the default locale's home.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-widest text-muted mb-3">404</p>
      <h1 className="text-3xl font-bold mb-3">Page not found</h1>
      <p className="text-muted max-w-md mb-6">
        The page you were looking for doesn&rsquo;t exist or has moved.
      </p>
      <Link
        href={`/${DEFAULT_LOCALE}`}
        className="text-sm text-primary underline underline-offset-4 hover:opacity-80"
      >
        Go to home
      </Link>
    </main>
  )
}
