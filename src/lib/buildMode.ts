/**
 * Which build this is, resolved from the three things that have an opinion.
 *
 * Extracted from `next.config.ts` because a config file is the one place in
 * the repository nothing can test, and this decision reaches every client
 * feature that loads data: link previews, the command palette's note results,
 * the explorer's full-text search, and both graph views all branch on it.
 */
export type BuildMode = 'static' | 'server'

/**
 * What the deployed artifact will be.
 *
 * `ONVU_MODE` beats `site.config.ts`, so CI can force a mode without editing
 * config; `npm run build:static` relies on that. Unset in both places means a
 * server build.
 */
export function resolveStaticTarget(
  envMode: string | undefined,
  configMode: BuildMode | undefined,
): boolean {
  return (envMode ?? configMode ?? 'server') === 'static'
}

/**
 * Whether *this process* produces that artifact.
 *
 * `next dev` never does, whatever the target says. It serves the route
 * handlers under `src/app/api/`, and it does not run `emitStaticData`, which is
 * gated on a production build so that hot reloads do not rewrite megabytes of
 * JSON. A dev server that called itself static therefore pointed the browser at
 * `/_static/<locale>/*.json` files nothing had written, and every consumer
 * fetched a 404, swallowed it, and rendered nothing.
 *
 * `NODE_ENV` rather than `NEXT_PHASE`: the phase is still undefined while the
 * config is being loaded.
 */
export function resolveStaticBuild(
  envMode: string | undefined,
  configMode: BuildMode | undefined,
  nodeEnv: string | undefined,
): boolean {
  return resolveStaticTarget(envMode, configMode) && nodeEnv === 'production'
}
