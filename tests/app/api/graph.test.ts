import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { routing } from '@i18n/routing'

let tmpRoot: string
let originalCwd: string

beforeEach(async () => {
  originalCwd = process.cwd()
  tmpRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'onvu-graph-')))
  for (const l of routing.locales) {
    await fs.mkdir(path.join(tmpRoot, 'content', 'notes', l), { recursive: true })
  }
  process.chdir(tmpRoot)
  vi.resetModules()
})

afterAll(() => process.chdir(originalCwd))

describe('/api/graph', () => {
  it('returns a graph with nodes and edges', async () => {
    await fs.writeFile(
      path.join(tmpRoot, 'content', 'notes', 'en', 'a.md'),
      `---\ntitle: A\n---\nSee [[B]]`,
      'utf-8',
    )
    await fs.writeFile(
      path.join(tmpRoot, 'content', 'notes', 'en', 'b.md'),
      `---\ntitle: B\n---\nBody`,
      'utf-8',
    )
    const { GET } = await import('../../../src/app/api/graph/route.node')
    const req = new Request('http://localhost/api/graph?locale=en')
    const res = await GET(req)
    const body = await res.json()
    expect(body).toMatchObject({
      nodes: expect.any(Array),
      edges: expect.any(Array),
    })
    expect(body.nodes.length).toBeGreaterThanOrEqual(2)
  })
})
