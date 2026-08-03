import { describe, it, expect } from 'vitest'
import {
  articleJsonLd,
  breadcrumbsJsonLd,
  websiteJsonLd,
  personJsonLd,
  itemListJsonLd,
} from '@lib/seo/jsonLd'
import { sampleNotes } from '../../fixtures/notes'
import { config as siteConfig } from '~/site.config'

describe('seo/jsonLd', () => {
  it('articleJsonLd has the required Article fields', () => {
    const note = { ...sampleNotes[0], updated: new Date('2024-06-01'), tags: ['kotlin', 'jvm'] }
    const ld = articleJsonLd(note, 'en', siteConfig)
    expect(ld['@type']).toBe('Article')
    expect(ld.headline).toBe(note.title)
    expect(ld.datePublished).toBe(note.date!.toISOString())
    expect(ld.dateModified).toBe(note.updated!.toISOString())
    expect(ld.keywords).toBe('kotlin, jvm')
    expect(ld.inLanguage).toBe('en')
    expect((ld.author as { name: string }).name).toBeTruthy()
    expect((ld.mainEntityOfPage as { '@id': string })['@id']).toContain('/en/notes/')
  })

  it('articleJsonLd falls back to date for dateModified when updated is null', () => {
    const note = { ...sampleNotes[0], updated: null }
    const ld = articleJsonLd(note, 'en', siteConfig)
    expect(ld.dateModified).toBe(note.date!.toISOString())
  })

  it('breadcrumbsJsonLd numbers positions starting at 1', () => {
    const ld = breadcrumbsJsonLd([
      { name: 'Home', href: '/' },
      { name: 'Notes', href: '/notes' },
    ])
    const items = ld.itemListElement as Array<{ position: number; name: string }>
    expect(items[0].position).toBe(1)
    expect(items[1].position).toBe(2)
    expect(items[1].name).toBe('Notes')
  })

  it('websiteJsonLd advertises SearchAction targeting the notes route', () => {
    const ld = websiteJsonLd('en', siteConfig)
    expect(ld['@type']).toBe('WebSite')
    const action = ld.potentialAction as { target: { urlTemplate: string } }
    expect(action.target.urlTemplate).toContain('/en/notes')
    expect(action.target.urlTemplate).toContain('{search_term_string}')
  })

  it('personJsonLd carries socials in sameAs', () => {
    const ld = personJsonLd(siteConfig)
    expect(Array.isArray(ld.sameAs)).toBe(true)
  })

  it('follows the per-locale config rather than the base one', () => {
    // This module used to import `~/site.config` directly, so a site with a
    // `site.uk.config.ts` served its Ukrainian bio in `<meta description>` and
    // the English one in the JSON-LD on the same page — while that JSON-LD
    // declared `inLanguage: "uk"`. `metadata.ts` documents fixing exactly this
    // for `<head>`; the structured data was never brought along.
    const localised = {
      ...siteConfig,
      owner: { ...siteConfig.owner, name: 'Вадим', bio: 'Український опис.' },
    }
    expect(websiteJsonLd('uk', localised).description).toBe('Український опис.')
    expect(websiteJsonLd('uk', localised).name).toBe('Вадим')
    expect(personJsonLd(localised).description).toBe('Український опис.')
    // ...and the base config is genuinely different, so the assertion above
    // could not have passed by coincidence.
    expect(websiteJsonLd('en', siteConfig).description).not.toBe('Український опис.')
  })

  it('itemListJsonLd numbers items from 1', () => {
    const ld = itemListJsonLd(
      sampleNotes.slice(0, 2).map((n) => ({ slug: n.slug, title: n.title, date: n.date })),
      'en',
      'Featured',
    )
    const items = ld.itemListElement as Array<{ position: number }>
    expect(items[0].position).toBe(1)
    expect(items[1].position).toBe(2)
  })
})
