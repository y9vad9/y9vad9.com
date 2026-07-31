import { describe, it, expect } from 'vitest'
import { buildContentSignal, contentSignals } from '@lib/agents/contentSignals'

describe('buildContentSignal', () => {
  it('returns null when nothing is configured, leaving robots.txt untouched', () => {
    expect(buildContentSignal(undefined)).toBeNull()
  })

  it('returns null for an empty object rather than a bare directive', () => {
    // `Content-Signal:` with no value is a malformed statement of nothing.
    expect(buildContentSignal({})).toBeNull()
  })

  it('renders the common "cite me, do not train on me" policy', () => {
    expect(buildContentSignal({ search: true, aiInput: true, aiTrain: false })).toBe(
      'search=yes, ai-input=yes, ai-train=no',
    )
  })

  it('omits an unset signal instead of defaulting it to no', () => {
    // The policy is explicit that an absent signal "neither grants nor
    // restricts permission" — writing `no` would state a preference the
    // author never expressed.
    const out = buildContentSignal({ search: true, aiTrain: false })
    expect(out).toBe('search=yes, ai-train=no')
    expect(out).not.toContain('ai-input')
  })

  it('treats false as an explicit no, distinct from undefined', () => {
    expect(buildContentSignal({ aiInput: false })).toBe('ai-input=no')
    expect(buildContentSignal({ aiInput: undefined })).toBeNull()
  })

  it('emits signals in the policy order regardless of key order', () => {
    expect(buildContentSignal({ aiTrain: false, search: true, aiInput: false })).toBe(
      'search=yes, ai-input=no, ai-train=no',
    )
  })
})

describe('contentSignals — defaults', () => {
  // Reads the repo's own `site.config.ts`, which leaves `agents` commented
  // out, so this pins what a fresh onvu site declares out of the box.
  it('refuses training and permits search without being configured', () => {
    expect(buildContentSignal(contentSignals())).toBe('search=yes, ai-train=no')
  })

  it('states no preference on ai-input rather than guessing one', () => {
    expect(contentSignals().aiInput).toBeUndefined()
    expect(buildContentSignal(contentSignals())).not.toContain('ai-input')
  })

  it('agrees with the crawler default — both axes say the same thing', () => {
    // `crawlers.training` defaults to 'block' (access) and `ai-train`
    // defaults to no (use). A site that said one but not the other would be
    // sending a mixed message to anything reading robots.txt.
    expect(contentSignals().aiTrain).toBe(false)
  })
})
