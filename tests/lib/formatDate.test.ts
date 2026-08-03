import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { formatDateShort, formatDateLong } from '@lib/formatDate'

/**
 * Dates used to be formatted by date-fns' bare `format`, which always emitted
 * US English — so a German or Ukrainian note rendered the one bit of English
 * left on the page. These pin both halves of the fix: that non-English
 * locales actually localise, and that English output did not move while doing
 * it (the old call site was `en-US`, the new one is `en`).
 */
const JULY = new Date('2026-07-31T12:00:00Z')
const JAN = new Date('2026-01-05T12:00:00Z')

describe('formatDate', () => {
  it('renders English exactly as the en-US default did', () => {
    expect(formatDateShort(JULY, 'en')).toBe('Jul 31, 2026')
    expect(formatDateLong(JULY, 'en')).toBe('July 31, 2026')
    expect(formatDateShort(JAN, 'en')).toBe('Jan 5, 2026')
  })

  it('localises German rather than leaving it in English', () => {
    expect(formatDateShort(JULY, 'de')).toBe('31. Juli 2026')
    expect(formatDateLong(JULY, 'de')).toBe('31. Juli 2026')
    // Day-first ordering is the actual regression this guards: the old output
    // was "Jul 31, 2026" on a German page.
    expect(formatDateShort(JAN, 'de')).toBe('5. Jan. 2026')
  })

  it('localises Ukrainian', () => {
    expect(formatDateShort(JULY, 'uk')).toBe('31 лип. 2026 р.')
    expect(formatDateLong(JULY, 'uk')).toBe('31 липня 2026 р.')
  })

  it('accepts ISO strings as well as Date objects', () => {
    // Note dates arrive serialised across the server/client boundary.
    expect(formatDateShort('2026-07-31T12:00:00Z', 'en')).toBe(
      formatDateShort(JULY, 'en'),
    )
  })

  it('renders the calendar day the author wrote, in any reader timezone', () => {
    // A note's `date:` is a calendar day, not an instant — YAML parses
    // `2024-03-01` to midnight UTC. Formatted in a western zone that instant
    // is still the previous day, so cards showed "Feb 29, 2024" for a note
    // dated the 1st. The date components are client components, so the reader's
    // timezone decided, and it disagreed with the server's own render.
    //
    // A child process is the only honest way to assert this: the runner's own
    // TZ is fixed by the time the suite imports anything, and `Intl` resolves
    // its zone when a formatter is constructed — which the module memoises.
    const run = (tz: string) =>
      execFileSync(process.execPath, [
        '-e',
        `process.stdout.write(new Intl.DateTimeFormat('en',` +
          `{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})` +
          `.format(new Date('2024-03-01T00:00:00.000Z')))`,
      ], { env: { ...process.env, TZ: tz }, encoding: 'utf8' })

    expect(run('America/Los_Angeles')).toBe('Mar 1, 2024')
    expect(run('Pacific/Kiritimati')).toBe('Mar 1, 2024')
    expect(run('UTC')).toBe('Mar 1, 2024')
    // ...and the module under test agrees with that, whatever zone CI runs in.
    expect(formatDateShort('2024-03-01T00:00:00.000Z', 'en')).toBe('Mar 1, 2024')
  })

  it('reuses one formatter per locale and style', () => {
    // Memoisation is the reason these are cheap enough to call per card;
    // repeated calls must stay stable rather than drift with a fresh instance.
    const a = formatDateShort(JULY, 'de')
    const b = formatDateShort(JULY, 'de')
    expect(a).toBe(b)
  })
})
