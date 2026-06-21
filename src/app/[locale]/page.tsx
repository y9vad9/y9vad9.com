import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Header } from '@components/shell/Header'
import { Footer } from '@components/shell/Footer'
import { ThemeProvider } from '@components/shell/ThemeProvider'
import { LandingBody } from '~/content/landing'
import { JsonLd } from '@components/seo/JsonLd'
import { breadcrumbsJsonLd, itemListJsonLd } from '@lib/seo/jsonLd'
import { baseMetadata } from '@lib/seo/metadata'
import { createRepository } from '@adapters/createRepositories'
import { listFeaturedNotes } from '@core/ListNotes'
import { loadSiteConfig } from '@lib/config/loadConfig'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const [base, siteConfig] = await Promise.all([
    baseMetadata({ locale, path: '/' }),
    loadSiteConfig(locale),
  ])
  return {
    ...base,
    // This is the portfolio landing page, not the notes index — the
    // notes index lives at /notes. The tab title should just be the
    // owner's name. `absolute` keeps it from being wrapped by the
    // `%s | <owner>` template that `baseMetadata` sets on every other
    // page.
    title: { absolute: siteConfig.owner.name },
  }
}

/**
 * Thin shell. To customise what appears on the landing page,
 * edit `content/landing.tsx` — that file is treated as content
 * and will not be overwritten by upstream updates.
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, siteConfig] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    loadSiteConfig(locale),
  ])
  const featured = await listFeaturedNotes(
    createRepository(locale),
    siteConfig.navigation.featuredNotes,
  )

  return (
    <ThemeProvider>
      <JsonLd
        data={[
          breadcrumbsJsonLd([{ name: siteConfig.owner.name, href: `/${locale}` }]),
          itemListJsonLd(
            featured.map((n) => ({ slug: n.slug, title: n.title, date: n.date })),
            locale,
            t('notes'),
          ),
        ]}
      />
      <Header />
      <LandingBody locale={locale} />
      <Footer />
    </ThemeProvider>
  )
}
