import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { routing } from '@i18n/routing'

let tmpRoot: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  tmpRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'onvu-api-')))
  for (const l of routing.locales) {
    await fs.mkdir(path.join(tmpRoot, 'content', 'notes', l), { recursive: true })
  }
  process.chdir(tmpRoot)
  vi.resetModules()
})

afterAll(() => process.chdir(originalCwd))

describe('/api/search-index', () => {
  it('returns the index for the requested locale', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'content', 'notes', 'en', 'kotlin.md'),
      `---\ntitle: Kotlin\n---\nBody`,
      'utf-8',
    )
    const { GET } = await import('../../../src/app/api/search-index/route.node')
    const req = new Request('http://localhost/api/search-index?locale=en')
    const res = await GET(req)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.find((e: { slug: string }) => e.slug === 'kotlin')).toBeTruthy()
  })

  it('falls back to the default locale when unknown', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'content', 'notes', routing.defaultLocale, 'a.md'),
      `---\ntitle: A\n---\n`,
      'utf-8',
    )
    const { GET } = await import('../../../src/app/api/search-index/route.node')
    const req = new Request('http://localhost/api/search-index?locale=zz')
    const res = await GET(req)
    const body = await res.json()
    expect(body.find((e: { slug: string }) => e.slug === 'a')).toBeTruthy()
  })
})
