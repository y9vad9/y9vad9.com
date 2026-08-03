import { NextResponse } from 'next/server'
import { createRepository } from '@adapters/createRepositories'
import { buildSearchIndex } from '@core/search/BuildSearchIndex'
import { routing } from '@i18n/routing'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requested = url.searchParams.get('locale') ?? routing.defaultLocale
  const locale = routing.locales.includes(requested) ? requested : routing.defaultLocale
  const repo = createRepository(locale)
  const index = await buildSearchIndex(repo)
  return NextResponse.json(index, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
