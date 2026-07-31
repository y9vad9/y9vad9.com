import { describe, it, expect } from 'vitest'
import { processMarkdown } from '@lib/mdx/pipeline'

describe('processMarkdown', () => {
  describe('headings', () => {
    it('extracts h1–h4 headings with auto-generated slug IDs', async () => {
      const result = await processMarkdown(`# First\n## Second\n### Third\n#### Fourth`)
      expect(result.headings).toEqual([
        { id: 'first', depth: 1, text: 'First' },
        { id: 'second', depth: 2, text: 'Second' },
        { id: 'third', depth: 3, text: 'Third' },
        { id: 'fourth', depth: 4, text: 'Fourth' },
      ])
    })

    it('does not extract h5/h6 headings', async () => {
      const result = await processMarkdown(`##### Five\n###### Six`)
      expect(result.headings).toEqual([])
    })

    it('handles headings with special characters in text', async () => {
      const result = await processMarkdown(`# A & B\n## Hello World!`)
      expect(result.headings[0].text).toBe('A & B')
      expect(result.headings[1].text).toBe('Hello World!')
    })

    it('renders heading IDs in the HTML', async () => {
      const result = await processMarkdown(`# My Section`)
      expect(result.html).toContain('id="my-section"')
    })
  })

  describe('outgoing links', () => {
    it('extracts internal note links from /notes/ URLs', async () => {
      const result = await processMarkdown(`See [this](/notes/foo) and [that](/notes/bar).`)
      expect(result.outgoingLinks).toEqual([
        { kind: 'internal', slug: 'foo' },
        { kind: 'internal', slug: 'bar' },
      ])
    })

    it('extracts links from locale-prefixed URLs', async () => {
      const result = await processMarkdown(`See [this](/en/notes/foo).`)
      expect(result.outgoingLinks).toEqual([{ kind: 'internal', slug: 'foo' }])
    })

    it('deduplicates repeated internal links', async () => {
      const result = await processMarkdown(
        `See [foo](/notes/foo) and again [foo](/notes/foo).`,
      )
      expect(result.outgoingLinks).toEqual([{ kind: 'internal', slug: 'foo' }])
    })

    it('extracts links from relative .md references', async () => {
      const result = await processMarkdown(`See [this](./foo.md).`)
      expect(result.outgoingLinks).toEqual([{ kind: 'internal', slug: 'foo' }])
    })

    it('classifies http(s) URLs as external entries', async () => {
      const result = await processMarkdown(`See [this](https://example.com).`)
      expect(result.outgoingLinks).toEqual([
        { kind: 'external', href: 'https://example.com' },
      ])
    })

    it('preserves body order between internal and external links', async () => {
      const md = `[A](/notes/a) [B](https://example.com) [C](/notes/c) [D](https://other.example).`
      const result = await processMarkdown(md)
      expect(result.outgoingLinks).toEqual([
        { kind: 'internal', slug: 'a' },
        { kind: 'external', href: 'https://example.com' },
        { kind: 'internal', slug: 'c' },
        { kind: 'external', href: 'https://other.example' },
      ])
    })
  })

  describe('image carousel', () => {
    it('transforms image-only tables into carousel divs', async () => {
      const md = `
| Col1 | Col2 |
|------|------|
| ![a](/a.jpg) | ![b](/b.jpg) |
`
      const result = await processMarkdown(md)
      expect(result.html).toContain('class="carousel"')
      expect(result.html).not.toContain('<table>')
    })

    it('preserves tables that contain text', async () => {
      const md = `
| Header | Value |
|--------|-------|
| Foo    | Bar   |
`
      const result = await processMarkdown(md)
      expect(result.html).toContain('<table>')
      expect(result.html).not.toContain('class="carousel"')
    })

    it('sizes carousel images by their rendered width, not the body width', async () => {
      // `.prose .carousel img` pins height to 220px with `width: auto`, so a
      // 3144x4192 portrait renders 165px wide. Body images are told they are
      // full-bleed; believing that here made the browser fetch an 800w
      // variant to paint 165 CSS px.
      const resolveImage = async (ref: string) => ({
        src: `/notes-assets/${ref}-800.webp`,
        srcset: `/notes-assets/${ref}-512.webp 512w, /notes-assets/${ref}-800.webp 800w`,
        width: 3144,
        height: 4192,
      })
      const md = `
| Col1 | Col2 |
|------|------|
| ![a](./a.jpg) | ![b](./b.jpg) |
`
      const result = await processMarkdown(md, { resolveImage })
      expect(result.html).toContain('class="carousel"')
      // 220 * 3144/4192 = 165
      expect(result.html).toContain('sizes="165px"')
      expect(result.html).not.toContain('calc(100vw - 80px)')
    })

    it('leaves body images on the full-width sizes declaration', async () => {
      // Guards the inverse: the carousel fix must not leak onto ordinary
      // images, which really do render full-bleed.
      const resolveImage = async (ref: string) => ({
        src: `/notes-assets/${ref}-800.webp`,
        srcset: `/notes-assets/${ref}-512.webp 512w, /notes-assets/${ref}-800.webp 800w`,
        width: 3144,
        height: 4192,
      })
      const result = await processMarkdown('![a](./a.jpg)\n', { resolveImage })
      expect(result.html).toContain('calc(100vw - 80px)')
      expect(result.html).not.toContain('sizes="165px"')
    })

    it('builds a carousel from self-linked images, the shape editors export', async () => {
      // Obsidian and friends write galleries as `[![](x)](x)`. The anchor hid
      // the image from the detector, so a gallery stayed a table.
      const md = `
| Col1 | Col2 |
|------|------|
| [![](/a.jpg)](/a.jpg) | [![](/b.jpg)](/b.jpg) |
`
      const result = await processMarkdown(md)
      expect(result.html).toContain('class="carousel"')
      expect(result.html).not.toContain('<table>')
    })
  })

  describe('self-linked images', () => {
    it('unwraps an image linked to itself', async () => {
      // The anchor is worse than redundant: `src` gets rewritten to the
      // generated asset while `href` keeps the authored path, so the link
      // 404s. It also swallowed the click that opens the lightbox.
      const result = await processMarkdown('[![alt](/a.jpg)](/a.jpg)')
      expect(result.html).toContain('<img')
      expect(result.html).toContain('src="/a.jpg"')
      expect(result.html).not.toContain('<a')
    })

    it('normalises a leading ./ on either side', async () => {
      const result = await processMarkdown('[![alt](./a.jpg)](a.jpg)')
      expect(result.html).toContain('<img')
      expect(result.html).not.toContain('<a')
    })

    it('matches through percent-encoding', async () => {
      // `<>` around the destination is what lets it hold a space at all —
      // a bare `(my shot.jpg)` is not a link in CommonMark, so a test
      // written that way would pass without proving anything.
      const result = await processMarkdown('[![alt](my%20shot.jpg)](<my shot.jpg>)')
      expect(result.html).toContain('<img')
      expect(result.html).not.toContain('<a')
    })

    it('keeps an image that links somewhere else', async () => {
      // A real link — removing it would delete something the author meant.
      const result = await processMarkdown(`[![](/thumb.jpg)](https://example.com)`)
      expect(result.html).toContain('href="https://example.com"')
      expect(result.html).toContain('<img')
    })

    it('keeps an anchor that also carries text', async () => {
      const result = await processMarkdown(`[![](/a.jpg) caption](/a.jpg)`)
      expect(result.html).toContain('<a')
    })

    it('leaves ordinary links alone', async () => {
      const result = await processMarkdown(`[docs](https://example.org)`)
      expect(result.html).toContain('href="https://example.org"')
    })
  })

  describe('rawText extraction', () => {
    it('strips markdown formatting characters', async () => {
      const result = await processMarkdown(`**bold** _italic_ ~~strike~~ regular text`)
      expect(result.rawText).not.toContain('**')
      expect(result.rawText).not.toContain('_')
      expect(result.rawText).toContain('bold')
      expect(result.rawText).toContain('italic')
      expect(result.rawText).toContain('regular text')
    })

    it('includes heading text', async () => {
      const result = await processMarkdown(`# My Title\n\nBody content here.`)
      expect(result.rawText).toContain('My Title')
      expect(result.rawText).toContain('Body content here')
    })

    it('collapses whitespace', async () => {
      const result = await processMarkdown(`Line 1\n\n\nLine 2\n\n\n\nLine 3`)
      expect(result.rawText).not.toMatch(/\s{2,}/)
    })

    it('strips link syntax but keeps link text', async () => {
      const result = await processMarkdown(`Visit [our site](https://example.com) please.`)
      expect(result.rawText).toContain('our site')
      expect(result.rawText).not.toContain('https://')
    })
  })

  describe('external links', () => {
    it('decorates http(s) anchors with external-link class and target=_blank', async () => {
      const result = await processMarkdown(`[Site](https://example.com).`)
      expect(result.html).toContain('class="external-link"')
      expect(result.html).toContain('target="_blank"')
      expect(result.html).toContain('rel="noopener noreferrer"')
    })

    it('does not decorate internal links', async () => {
      const result = await processMarkdown(`[Foo](/notes/foo)`)
      expect(result.html).not.toContain('external-link')
    })

    it('deduplicates external URLs in the outgoing list', async () => {
      const result = await processMarkdown(
        `Visit [foo](https://x.com) twice: [again](https://x.com).`,
      )
      expect(result.outgoingLinks).toEqual([
        { kind: 'external', href: 'https://x.com' },
      ])
    })
  })

  describe('wiki links', () => {
    function resolveFoo(target: string) {
      if (target.toLowerCase() === 'foo') return { slug: 'foo', title: 'Foo' }
      return null
    }

    it('rewrites resolved wiki links to /notes/<slug>', async () => {
      const result = await processMarkdown(`See [[Foo]].`, {
        resolveWikiLink: resolveFoo,
      })
      expect(result.html).toContain('href="/notes/foo"')
      expect(result.html).toContain('data-note-slug="foo"')
      expect(result.html).toContain('class="wikilink"')
    })

    it('marks broken wiki links with wikilink-broken class', async () => {
      const result = await processMarkdown(`See [[Missing]].`, {
        resolveWikiLink: resolveFoo,
      })
      expect(result.html).toContain('wikilink-broken')
    })

    it('honours display text [[Target|Label]]', async () => {
      const result = await processMarkdown(`See [[Foo|the link]].`, {
        resolveWikiLink: resolveFoo,
      })
      expect(result.html).toContain('the link')
    })
  })

  describe('inline image marker', () => {
    it('marks ?inline images with the inline-image class', async () => {
      const result = await processMarkdown(`Yes ![ok](/icon.svg?inline) here.`)
      expect(result.html).toContain('class="inline-image"')
    })

    it('strips the ?inline marker from src', async () => {
      const result = await processMarkdown(`![ok](/icon.svg?inline)`)
      expect(result.html).not.toContain('?inline')
      expect(result.html).toContain('/icon.svg')
    })
  })

  describe('mermaid', () => {
    it('replaces mermaid code blocks with a placeholder div carrying the source', async () => {
      const md = '```mermaid\ngraph TD; A-->B;\n```'
      const result = await processMarkdown(md)
      expect(result.html).toContain('class="mermaid"')
      expect(result.html).not.toContain('<pre')
    })
  })

  describe('full pipeline', () => {
    it('produces valid HTML output', async () => {
      const result = await processMarkdown(`# Hello\n\nThis is a **paragraph**.`)
      expect(result.html).toContain('<h1')
      expect(result.html).toContain('Hello')
      expect(result.html).toContain('<strong>paragraph</strong>')
    })

    it('handles empty input gracefully', async () => {
      const result = await processMarkdown('')
      expect(result.html).toBe('')
      expect(result.headings).toEqual([])
      expect(result.outgoingLinks).toEqual([])
      expect(result.rawText).toBe('')
    })

    it('renders inline code', async () => {
      const result = await processMarkdown(`Use \`const x = 1\` here.`)
      expect(result.html).toContain('<code>const x = 1</code>')
    })
  })
})

describe('lazy iframes', () => {
  const IFRAME = '<iframe src="https://www.youtube-nocookie.com/embed/abc" title="YouTube video player"></iframe>'

  it('defers a pasted embed, which arrives as raw HTML rather than an element', async () => {
    // The regression this guards: matching only on parsed `element` nodes did
    // nothing here, because `allowDangerousHtml` keeps author HTML as a raw
    // string all the way to the output.
    const result = await processMarkdown(IFRAME)
    expect(result.html).toContain('loading="lazy"')
    expect(result.html).toContain('youtube-nocookie.com/embed/abc')
  })

  it('does not override an explicit loading choice', async () => {
    const eager = IFRAME.replace('<iframe ', '<iframe loading="eager" ')
    const result = await processMarkdown(eager)
    expect(result.html).toContain('loading="eager"')
    expect(result.html).not.toContain('loading="lazy"')
  })

  it('adds the attribute exactly once', async () => {
    const result = await processMarkdown(`${IFRAME}\n\n${IFRAME}`)
    expect((result.html.match(/loading="lazy"/g) ?? []).length).toBe(2)
  })

  it('handles a self-closing tag', async () => {
    const result = await processMarkdown('<iframe src="https://example.com/e" />')
    expect(result.html).toContain('loading="lazy"')
    expect(result.html).not.toContain('loading="lazy"/loading')
  })

  it('leaves other markup alone', async () => {
    const result = await processMarkdown('Just **text** and a [link](https://example.org).')
    expect(result.html).not.toContain('loading="lazy"')
  })
})

describe('note videos', () => {
  // The video plugin is only registered when a resolver is supplied, so a
  // bare `processMarkdown` call leaves the `<img>` untouched — passing one is
  // what makes these tests exercise anything at all.
  const resolveVideo = async () => ({
    src: '/notes-assets/clip-abc123.webm',
    mimeType: 'video/webm',
  })

  it('does not preload a resolved video, so a page view costs no bytes', async () => {
    // A metadata preload is two connections and ~94 KB in Chrome, spent on a
    // page where most readers never press play. `.note-video` pins the aspect
    // ratio in CSS, so nothing shifts by deferring it.
    const result = await processMarkdown('![clip](./a.webm)', { resolveVideo })
    expect(result.html).toContain('<video')
    expect(result.html).toContain('preload="none"')
    expect(result.html).not.toContain('preload="metadata"')
  })

  it('does not preload an external video either', async () => {
    const result = await processMarkdown('![clip](https://example.com/a.webm)', {
      resolveVideo,
    })
    expect(result.html).toContain('<video')
    expect(result.html).toContain('preload="none"')
  })

  it('keeps controls so there is still something to press', async () => {
    const result = await processMarkdown('![clip](./a.webm)', { resolveVideo })
    expect(result.html).toContain('controls')
  })

  it('declares the source type so the browser need not sniff', async () => {
    const result = await processMarkdown('![clip](./a.webm)', { resolveVideo })
    expect(result.html).toContain('type="video/webm"')
  })

  it('leaves ordinary images alone', async () => {
    const result = await processMarkdown('![pic](./a.png)', { resolveVideo })
    expect(result.html).not.toContain('<video')
  })
})
