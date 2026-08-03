import { ImageResponse } from 'next/og'
import { ogFonts } from '@lib/seo/ogFont'
import { config as siteConfig } from '~/site.config'

export const dynamic = 'force-static'
export const runtime = 'nodejs'
export const alt = siteConfig.owner.name
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage() {
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
        <div style={{ fontSize: 80, fontWeight: 700, lineHeight: 1.1 }}>
          {siteConfig.owner.name}
        </div>
        <div style={{ fontSize: 28, opacity: 0.7, maxWidth: 900 }}>
          {siteConfig.owner.bio}
        </div>
        <div style={{ height: 8, width: 120, background: '#a78bfa', borderRadius: 4 }} />
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  )
}
