import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { createRepository } from '@adapters/createRepositories'
import { buildMentionGraph } from '@core/graph/BuildMentionGraph'
import { GlobalGraph } from '@components/graph/GlobalGraph'
import { RouteTabSync } from '@components/garden/RouteTabSync'
import { baseMetadata } from '@lib/seo/metadata'
import { GRAPH_TAB_SLUG } from '@store/tabStore'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    ...(await baseMetadata({ locale, path: '/notes/graph' })),
    robots: { index: false, follow: true },
  }
}

export default async function GraphPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'garden' })
  const repo = createRepository(locale)
  const graph = await buildMentionGraph(repo)
  return (
    <>
      <RouteTabSync slug={GRAPH_TAB_SLUG} title={t('knowledgeGraph')} kind="graph" />
      <GlobalGraph graph={graph} />
    </>
  )
}
