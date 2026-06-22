import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { routing } from './i18n/routing'

// Renamed from `middleware.ts` → `proxy.ts` in Next 16. The function and
// its config object keep the same shape; only the file name changed.
const intlMiddleware = createMiddleware(routing)

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Skip i18n routing for API routes, static assets, and Next internals.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }
  return intlMiddleware(req)
}

export const config = {
  matcher: ['/((?!_next|_static).*)'],
}
