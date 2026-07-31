import { buildRobots, renderRobotsTxt } from '@lib/agents/robots'

/**
 * robots.txt as a route handler rather than Next's `app/robots.ts` metadata
 * convention — see `@lib/agents/robots` for why the metadata route cannot
 * carry `Content-Signal`. Statically rendered, so the static export writes it
 * out as a plain file exactly as before.
 */
export const dynamic = 'force-static'

export function GET(): Response {
  return new Response(renderRobotsTxt(buildRobots()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
