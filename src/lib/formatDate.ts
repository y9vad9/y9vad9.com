/**
 * Date formatting via the platform's own `Intl`, replacing `date-fns`.
 *
 * Only two shapes were ever used — `MMM d, yyyy` and `MMMM d, yyyy` — and
 * `Intl.DateTimeFormat` reproduces both exactly (verified across month
 * boundaries, single-digit days and a leap day). date-fns cost ~4.8 KB
 * transferred in a chunk that loaded in the initial burst, competing for
 * bandwidth with the LCP image; `Intl` is built into the runtime and costs
 * nothing to ship.
 *
 * Dates follow the page locale. date-fns' bare `format` always emitted US
 * English, so a German note showed "Jul 31, 2026" and a Ukrainian one the
 * same — the only text on those pages still in English. `Intl` localises for
 * free, and `en` resolves identically to the old `en-US`, so English output
 * is unchanged:
 *
 *   en   Jul 31, 2026     July 31, 2026
 *   de   31. Juli 2026    31. Juli 2026
 *   uk   31 лип. 2026 р.  31 липня 2026 р.
 *
 * Constructing an `Intl.DateTimeFormat` is the expensive part and formatting
 * is cheap, so instances are memoised per locale rather than per call.
 *
 * Everything is formatted in UTC, because a note's `date:` is a calendar day
 * and not an instant. YAML parses `date: 2024-03-01` to midnight UTC, so any
 * reader behind Greenwich formatting in their own zone sees the day before —
 * `Feb 29, 2024` in Los Angeles. The components that render dates are client
 * components, so this was the *reader's* timezone deciding what day a note
 * was published, and it disagreed with the server's own render.
 */
type Style = 'short' | 'long'

const cache = new Map<string, Intl.DateTimeFormat>()

function formatter(locale: string, month: Style): Intl.DateTimeFormat {
  const key = `${locale}:${month}`
  let hit = cache.get(key)
  if (!hit) {
    hit = new Intl.DateTimeFormat(locale, {
      month,
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
    cache.set(key, hit)
  }
  return hit
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/** `Jul 31, 2026` / `31. Juli 2026` — was `format(date, 'MMM d, yyyy')`. */
export function formatDateShort(value: Date | string | number, locale: string): string {
  return formatter(locale, 'short').format(toDate(value))
}

/** `July 31, 2026` / `31 липня 2026 р.` — was `format(date, 'MMMM d, yyyy')`. */
export function formatDateLong(value: Date | string | number, locale: string): string {
  return formatter(locale, 'long').format(toDate(value))
}
