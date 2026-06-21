import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@i18n/routing'
import type { Locale } from '@config/site'
import { ClientProviders } from '@components/shell/ClientProviders'
import { baseMetadata } from '@lib/seo/metadata'
import { JsonLd } from '@components/seo/JsonLd'
import {
  websiteJsonLd,
  personJsonLd,
  organizationJsonLd,
} from '@lib/seo/jsonLd'
import { loadSiteConfig } from '@lib/config/loadConfig'
import { SiteConfigProvider } from '@lib/config/SiteConfigProvider'

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return baseMetadata({ locale })
  // (`baseMetadata` is async — Next happily accepts a Promise<Metadata>
  // return from `generateMetadata`; no extra await needed at this level.)
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as Locale)) notFound()
  setRequestLocale(locale)

  const [messages, siteConfig] = await Promise.all([
    getMessages(),
    loadSiteConfig(locale),
  ])

  return (
    <NextIntlClientProvider messages={messages}>
      <SiteConfigProvider value={siteConfig}>
        <ClientProviders>
          <JsonLd data={[websiteJsonLd(locale), organizationJsonLd() ?? personJsonLd()]} />
          {children}
        </ClientProviders>
      </SiteConfigProvider>
    </NextIntlClientProvider>
  )
}
