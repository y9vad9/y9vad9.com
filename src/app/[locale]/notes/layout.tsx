import { createRepository } from '@adapters/createRepositories'
import { listAllNotes } from '@core/ListNotes'
import { emitStaticData } from '@adapters/static/StaticBuildEmitter'
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

  // In static mode, emit the pre-built JSON files on first build invocation
  if (process.env.ONVU_MODE !== 'server' && process.env.NODE_ENV === 'production') {
    await emitStaticData(repo, locale)
  }

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
