import { NextResponse } from 'next/server'
import { createRepository } from '@adapters/createRepositories'
import { listAllNotes } from '@core/ListNotes'
import { loadSiteConfig } from '@lib/config/loadConfig'
import { siteUrl } from '@lib/seo/url'
import { escapeXml } from '@lib/xml'
import { routing } from '@i18n/routing'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params
  const repo = createRepository(locale)
  const [notes, siteConfig] = await Promise.all([
    listAllNotes(repo),
    loadSiteConfig(locale),
  ])
  const datedNotes = notes.filter((n) => n.date !== null && !n.noindex)

  const baseUrl = siteUrl()
  const lastBuildDate = datedNotes
    .map((n) => (n.updated ?? n.date) as Date)
    .sort((a, b) => b.getTime() - a.getTime())[0]
    ?.toUTCString() ?? new Date().toUTCString()
  const feedUrl = `${baseUrl}/${locale}/feed.xml`
  const isDefault = locale === siteConfig.locales.primary
  const feedTitle = `${siteConfig.owner.name} Notes${isDefault ? '' : ` (${locale.toUpperCase()})`}`

  const items = datedNotes
    .map((note) => {
      const url = `${baseUrl}/${locale}/notes/${note.slug}`
      const pubDate = note.date!.toUTCString()
      const image = note.coverImage
        ? `<media:content url="${escapeXml(
            note.coverImage.startsWith('http') ? note.coverImage : baseUrl + note.coverImage,
          )}" medium="image" />`
        : ''
      return `
    <item>
      <title>${escapeXml(note.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(note.preview)}</description>
      ${image}
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(`${baseUrl}/${locale}`)}</link>
    <description>${escapeXml(siteConfig.owner.bio)}</description>
    <language>${locale}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
