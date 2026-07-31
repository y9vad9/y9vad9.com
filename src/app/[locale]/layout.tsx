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
import { createRepository } from '@adapters/createRepositories'
import { listAllNotes } from '@core/ListNotes'
import { resolveAgentsConfig } from '@lib/agents/config'
import { WebMcpTools } from '@components/agents/WebMcpTools'

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

  const [messages, siteConfig, notes] = await Promise.all([
    getMessages(),
    loadSiteConfig(locale),
    listAllNotes(createRepository(locale)),
  ])

  // `knowsAbout` is derived rather than configured: the tags an author
  // actually writes under are a truer expertise claim than a hand-kept list,
  // and they can't drift out of date. Off unless `agents.schema.knowsAbout`.
  const topics = Array.from(new Set(notes.flatMap((n) => n.tags))).sort()

  const agents = resolveAgentsConfig()

  return (
    <NextIntlClientProvider messages={messages}>
      <SiteConfigProvider value={siteConfig}>
        <ClientProviders>
          <JsonLd data={[websiteJsonLd(locale), organizationJsonLd() ?? personJsonLd(topics)]} />
          {agents.webmcp.enabled && (
            <WebMcpTools locale={locale} hasMirrors={agents.markdown.enabled} />
          )}
          {children}
        </ClientProviders>
      </SiteConfigProvider>
    </NextIntlClientProvider>
  )
}
