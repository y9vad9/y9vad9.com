import { describe, it, expect } from 'vitest'
import { buildFileTree } from '@lib/notes/buildFileTree'

describe('buildFileTree', () => {
  it('returns standalone notes as their own entries', () => {
    const result = buildFileTree([
      { slug: 'a', title: 'Alpha', series: null, order: null },
      { slug: 'b', title: 'Beta', series: null, order: null },
    ])
    expect(result).toEqual([
      { slug: 'a', displayTitle: 'Alpha', isSeries: false },
      { slug: 'b', displayTitle: 'Beta', isSeries: false },
    ])
  })

  it('collapses a series to a single entry titled by the series name', () => {
    const result = buildFileTree([
      { slug: 'p2', title: 'Part 2', series: 'Concurrency', order: 2 },
      { slug: 'p1', title: 'Part 1', series: 'Concurrency', order: 1 },
    ])
    expect(result).toEqual([
      { slug: 'p1', displayTitle: 'Concurrency', isSeries: true },
    ])
  })

  it('keeps a series in date order among the standalones', () => {
    // Input arrives newest-first from `listAllNotes`. This asserted the
    // opposite before — series hoisted above everything — which put an
    // archived 2022 course at the top of the sidebar, above notes from 2026.
    const result = buildFileTree([
      { slug: 'lone', title: 'Lone', series: null, order: null },
      { slug: 's1', title: 'S Part 1', series: 'Sigma', order: 1 },
    ])
    expect(result.map((e) => e.slug)).toEqual(['lone', 's1'])
  })

  it('places a series at its most recent member, not its first-numbered one', () => {
    // Part 3 is the newest thing in the series, so the series belongs where
    // part 3 falls — but the entry still links to part 1.
    const result = buildFileTree([
      { slug: 'fresh', title: 'Fresh', series: null, order: null },
      { slug: 'p3', title: 'Part 3', series: 'Course', order: 3 },
      { slug: 'older', title: 'Older', series: null, order: null },
      { slug: 'p1', title: 'Part 1', series: 'Course', order: 1 },
    ])
    expect(result.map((e) => e.slug)).toEqual(['fresh', 'p1', 'older'])
    expect(result[1]).toEqual({ slug: 'p1', displayTitle: 'Course', isSeries: true })
  })

  it('emits each series exactly once however many parts it has', () => {
    const result = buildFileTree(
      Array.from({ length: 19 }, (_, i) => ({
        slug: `part-${i}`,
        title: `Part ${i}`,
        series: 'Kotlin for beginners',
        order: i,
      })),
    )
    expect(result).toHaveLength(1)
  })

  it('interleaves several series by recency', () => {
    const result = buildFileTree([
      { slug: 'b1', title: 'B one', series: 'Beta', order: 1 },
      { slug: 'solo', title: 'Solo', series: null, order: null },
      { slug: 'a1', title: 'A one', series: 'Alpha', order: 1 },
    ])
    expect(result.map((e) => e.displayTitle)).toEqual(['Beta', 'Solo', 'Alpha'])
  })

  it('uses the lowest-order series member as the link target', () => {
    const result = buildFileTree([
      { slug: 'mid', title: 'Mid', series: 'X', order: 5 },
      { slug: 'first', title: 'First', series: 'X', order: 1 },
      { slug: 'last', title: 'Last', series: 'X', order: 10 },
    ])
    expect(result[0]).toEqual({ slug: 'first', displayTitle: 'X', isSeries: true })
  })

  it('treats missing order as 0 when sorting series members', () => {
    const result = buildFileTree([
      { slug: 'no-order', title: 'No order', series: 'Y', order: null },
      { slug: 'ordered', title: 'Ordered', series: 'Y', order: 3 },
    ])
    // null becomes 0, so 'no-order' sorts first.
    expect(result[0].slug).toBe('no-order')
  })
})
