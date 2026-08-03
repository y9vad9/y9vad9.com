import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { routing } from '@i18n/routing'
import { NextRequest } from 'next/server'

let tmpRoot: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  tmpRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'onvu-search-')))
  for (const l of routing.locales) {
    await fs.mkdir(path.join(tmpRoot, 'content', 'notes', l), { recursive: true })
  }
  process.chdir(tmpRoot)
  vi.resetModules()
})

afterAll(() => process.chdir(originalCwd))

describe('/api/search', () => {
  it('returns the top-of-index slice when q is empty', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'content', 'notes', 'en', 'a.md'),
      `---\ntitle: Alpha\n---\nBody`,
      'utf-8',
    )
    const { GET } = await import('../../../src/app/api/search/route.node')
    const req = new NextRequest('http://localhost/api/search?locale=en')
    const res = await GET(req)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  it('returns per-occurrence snippets when fulltext=1', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'content', 'notes', 'en', 'a.md'),
      `---\ntitle: Alpha\n---\nBody mentions kotlin twice: kotlin again.`,
      'utf-8',
    )
    const { GET } = await import('../../../src/app/api/search/route.node')
    const req = new NextRequest(
      'http://localhost/api/search?locale=en&q=kotlin&fulltext=1',
    )
    const res = await GET(req)
    const body = (await res.json()) as Array<{ slug: string; hit: number; matchStart: number; matchLength: number }>
    expect(body.length).toBeGreaterThanOrEqual(2)
    expect(body[0].matchLength).toBe(6) // 'kotlin'.length
  })

  it('falls back to default locale on unknown locale param', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'content', 'notes', routing.defaultLocale, 'a.md'),
      `---\ntitle: Alpha\n---\nBody`,
      'utf-8',
    )
    const { GET } = await import('../../../src/app/api/search/route.node')
    const req = new NextRequest('http://localhost/api/search?locale=zz')
    const res = await GET(req)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })
})
