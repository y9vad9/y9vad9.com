import { createRepository } from '@adapters/createRepositories'
import { listAllNotes } from '@core/ListNotes'
import { emitStaticData } from '@adapters/static/StaticBuildEmitter'
import { emitAgentArtifacts } from '@adapters/static/AgentArtifactEmitter'
import { NotesHeader } from '@components/shell/NotesHeader'
import { ThemeProvider } from '@components/shell/ThemeProvider'
import { PanelWrapper } from '@components/garden/PanelWrapper'
import { GardenShortcuts } from '@components/garden/GardenShortcuts'
import { setRequestLocale } from 'next-intl/server'

export default async function NotesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const repo = createRepository(locale)
  const allNotes = await listAllNotes(repo)

  // In static mode, emit the pre-built JSON files on first build invocation.
  // Reads the *resolved* mode that `next.config.ts` computed, not `ONVU_MODE`
  // directly: testing `!== 'server'` here meant an unset variable passed, so a
  // plain `npm run build` wrote megabytes of snapshots that the server-mode
  // client it had just built would never fetch.
  if (process.env.NEXT_PUBLIC_ONVU_MODE === 'static' && process.env.NODE_ENV === 'production') {
    await emitStaticData(repo, locale)
  }
  // Agent-facing artifacts (markdown mirrors, llms.txt). Covers every locale
  // in one pass rather than accumulating across calls — Next's page workers
  // are separate processes and would each see only a slice. No-ops unless
  // `agents.*` opts in, and self-gated to the build phase.
  await emitAgentArtifacts()

  const noteList = allNotes.map((n) => ({
    slug: n.slug,
    title: n.title,
    series: n.series,
    order: n.order,
  }))

  return (
    <ThemeProvider>
      <GardenShortcuts />
      <div id="reading-progress" aria-hidden="true" />
      <div className="flex flex-col h-dvh overflow-hidden bg-shell">
        <NotesHeader />
        <PanelWrapper noteList={noteList}>
          {children}
        </PanelWrapper>
      </div>
    </ThemeProvider>
  )
}
