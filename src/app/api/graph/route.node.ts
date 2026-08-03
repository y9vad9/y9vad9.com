import { NextResponse } from 'next/server'
import { createRepository } from '@adapters/createRepositories'
import { buildMentionGraph } from '@core/graph/BuildMentionGraph'
import { routing } from '@i18n/routing'

export const dynamic = 'force-dynamic'

const cached = new Map<string, ReturnType<typeof buildMentionGraph>>()

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requested = url.searchParams.get('locale') ?? routing.defaultLocale
  const locale = routing.locales.includes(requested) ? requested : routing.defaultLocale
  let promise = cached.get(locale)
  if (!promise) {
    promise = buildMentionGraph(createRepository(locale))
    cached.set(locale, promise)
  }
  const graph = await promise
  return NextResponse.json(graph, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
