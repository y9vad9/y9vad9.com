import { ImageResponse } from 'next/og'
import { ogFonts } from '@lib/seo/ogFont'
import { createRepository } from '@adapters/createRepositories'
import { getNote } from '@core/GetNote'
import { loadSiteConfig } from '@lib/config/loadConfig'
import { routing } from '@i18n/routing'
import fs from 'node:fs'
import path from 'node:path'

export const dynamic = 'force-static'
export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Article preview'

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => {
    const notesDir = path.join(process.cwd(), 'content', 'notes', locale)
    try {
      return fs
        .readdirSync(notesDir, { recursive: true })
      .map((f) => String(f))
        .filter((f) => f.endsWith('.md') && !f.split(path.sep).some((s) => s.startsWith('_')))
        .map((f) => ({ locale, slug: path.basename(f).replace(/\.md$/, '') }))
    } catch {
      return []
    }
  })
}

export default async function NoteOgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  const [note, siteConfig] = await Promise.all([
    getNote(createRepository(locale), slug),
    loadSiteConfig(locale),
  ])
  const title = note?.title ?? siteConfig.owner.name
  const description = note?.description ?? note?.preview ?? siteConfig.owner.bio
  const author = note?.author ?? siteConfig.owner.name

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: '#0e0e10',
          color: '#f5f5f5',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 28, opacity: 0.7 }}>{siteConfig.owner.handle}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 28, opacity: 0.7, maxWidth: 900, lineHeight: 1.4 }}>
            {description}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ height: 8, width: 120, background: '#a78bfa', borderRadius: 4 }} />
          <div style={{ fontSize: 24, opacity: 0.8 }}>{author}</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  )
}
