import type { SiteConfig } from '@config/site'

export const config: SiteConfig = {
  owner: {
    name: 'Vadym Yaroshchuk',
    handle: 'y9vad9',
    profileImage: '/images/hero.webp',
    bio: 'I am a Software Engineer and software design enthusiast based in Munich. My main focus is system design and the Kotlin ecosystem, where I enjoy solving the structural puzzles that others often overlook. I use this space to explore how to build software that lasts — focusing on clear contracts, intentional design, and code that speaks for itself.',
    socials: [
      { platform: 'telegram', url: 'https://t.me/y9vad9' },
      { platform: 'linkedin', url: 'https://linkedin.com/in/y9vad9' },
      { platform: 'github', url: 'https://github.com/y9vad9' },
      { platform: 'instagram', url: 'https://instagram.com/y9vad9' },
      { platform: 'twitter', url: 'https://x.com/y9vad9' },
      { platform: 'threads', url: 'https://www.threads.net/@y9vad9' },
    ],
  },

  locales: {
    primary: 'en',
    supported: ['en', 'de', 'uk'],
  },

  defaultTheme: 'system',
  mode: 'static',

  pwa: {
    name: 'Vadym Yaroshchuk',
    shortName: 'y9vad9',
    description: 'Software Engineer & software design enthusiast in Munich. Exploring system design and the Kotlin ecosystem to build software that lasts with clear contracts.',
    themeColor: '#7c3aed',
    backgroundColor: '#fafafa',
  },

  navigation: {
    featuredNotes: ['contract-violation-handling', 'semantic-typing', 'package-naming-problem'],
    workExperienceNote: 'experience',
    projectsNote: 'projects',
    educationNote: 'education',
    summaryNote: 'summary',
  },

  home: {
    workExperience: [
      {
        company: 'Jochen Schweizer mydays Group',
        role: 'Web (JS/TS) Software Engineer • Apprenticeship',
        period: 'September 2025 — Present',
        url: 'notes/experience#jochen-schweizer-mydays-group',
        logo: '/images/jochen-schweizer-mydays-group-logo.webp?dark-invert',
      },
      {
        company: 'Ajax Systems',
        role: 'Android Software Engineer',
        period: 'January 2023 — April 2023',
        url: 'notes/experience#ajax-systems',
        logo: '/images/ajax-systems-logo.webp?dark-invert',
      },
    ],

    projects: [
      {
        name: 'Cadento',
        description: 'Multiplatform productivity application built with Kotlin, Compose, Coroutines and Ktor.',
        url: 'notes/projects#cadento',
      },
      {
        name: 'Krawler',
        description: 'Kotlin-powered Club Manager Bot for Brawl Stars (Telegram & Discord)',
        url: 'notes/projects#krawler',
      },
      {
        name: 'Onvu',
        description: 'Portfolio and digital garden template built with Next.js. It powers this site.',
        url: 'notes/projects#onvu',
      },
    ],

    education: [
      {
        institution: 'Open International University of Human Development "Ukraine"',
        degree: "Bachelor's in Software Engineering",
        period: 'September 2022 — June 2026',
        logo: '/images/OIUHD-Ukraine-logo.webp',
        url: 'notes/education#open-international-university-of-human-development-ukraine',
      },
      {
        institution: 'College of Kyiv International University',
        degree: 'Incomplete Professional Junior Bachelor in "Computer Science"',
        period: 'September 2020 — June 2022',
        logo: '/images/KyMU-logo.webp',
        url: 'notes/education#college-of-kyiv-international-university',
      },
    ],
  },

  comments: {
    provider: 'giscus',
    repo: 'y9vad9/y9vad9.com',
    repoId: 'R_kgDOTBG89w',
    category: 'Announcements',
    categoryId: 'DIC_kwDOTBG8984C_nHl',
  },

  seo: {
    siteUrl: 'https://y9vad9.com',
    noindexPaths: ['/notes/graph'],
  },

  agents: {
    markdown: {
      enabled: true,
      resolveWikilinks: true,
      include: {
        frontmatter: true,
        // Frontmatter names parents but an agent can't follow a name; this
        // resolves them to the same URLs the breadcrumb links.
        parents: true,
        series: true,
        backlinks: true,
        outgoing: true,
        relatedNotes: true,
      },
    },
    llmsTxt: { enabled: true, full: true },
    discovery: {
      linkAlternate: true,
      jsonLdEncoding: true,
      // Cloudflare Pages honours `_headers` (see .github/workflows/deploy.yml),
      // so mirrors get served as text/markdown inline rather than prompting a
      // download. Our rules are fenced and merged into the existing file —
      // the CSP and HSTS policy in `public/_headers` is left alone.
      emitHeadersFile: true,
    },
    schema: {
      series: true,
      mentions: true,
      definedTerms: true,
      citations: true,
      knowsAbout: true,
    },
    // Crawling is fine; training is not. The training group is turned away
    // while the crawlers that put this site into AI answers are allowed
    // through, so the writing stays findable and quotable without feeding
    // the next model. This costs nothing in Google Search: Google-Extended
    // is a robots.txt control token rather than a crawler, and Googlebot is
    // untouched. `training: 'block'` is also onvu's default now — spelled
    // out here so the intent is on the record rather than inherited.
    crawlers: { training: 'block', aiSearch: 'allow', userTriggered: 'allow' },
    // The same position on the other axis. `crawlers` above says who may
    // fetch; this says what may be done with the result, and it binds
    // fetchers that read robots.txt without being named in any group. Saying
    // yes to ai-input is the deliberate counterpart to allowing the AI-answer
    // crawlers — being cited is the point; being training data is not.
    contentSignals: { search: true, aiInput: true, aiTrain: false },
  },
  // comments: {
  //   provider: 'giscus',
  //   repo: 'yourusername/your-repo',
  //   repoId: 'R_xxxx',
  //   category: 'Announcements',
  //   categoryId: 'DIC_xxxx',
  // },

  // Machine-readable surfaces for AI agents. Leave this block commented out
  // and nothing below is generated or advertised.
  //
  // One exception, and it is deliberate: robots.txt refuses AI *training* out
  // of the box (`Content-Signal: search=yes, ai-train=no`, plus a blocked
  // group for each training crawler). Search and AI-answer crawlers are still
  // allowed, and Google-Extended is a robots.txt token rather than a crawler,
  // so this costs nothing in Google Search — you stay findable and quotable,
  // your writing stays out of the next model. To opt back in:
  //
  //   agents: { crawlers: { training: 'allow' } }
  //
  // Set expectations first: Google states you "don't need to create new
  // machine readable files, AI text files, markup, or Markdown to appear in
  // Google Search", and that such files "neither harm nor help" because
  // Search ignores them. None of this is an SEO lever, and llms.txt in
  // particular is skipped by most AI crawlers today.
  //
  // What it does help: agents that fetch your page live — coding agents,
  // ChatGPT/Claude browsing, Perplexity-User. They pay tokens for your nav
  // chrome and get nothing from it; a markdown mirror is far cheaper to read.
  // See https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
  //
  // One related switch lives outside this file. `functions/[locale]/notes/`
  // is a Cloudflare Pages middleware that answers `Accept: text/markdown`
  // with the mirror instead of the HTML — the one thing a static export
  // cannot do by itself, since negotiation is per request rather than per
  // URL. Its presence is the switch: delete the directory to serve note
  // pages straight from the edge. It is inert on other hosts and needs no
  // configuration, falling back to HTML whenever no mirror exists.
  //
  // agents: {
  //   markdown: {
  //     enabled: true,
  //     // [[Wiki Links]] → absolute URLs. On by default: an agent can't
  //     // follow [[deep-modules]], so an unresolved mirror is half a document.
  //     resolveWikilinks: true,
  //     include: {
  //       frontmatter: true,    // title, dates, tags, canonical URL
  //       parents: true,        // parent notes, resolved to links
  //       series: true,         // "part N of X" + sibling links
  //       backlinks: true,      // notes linking here
  //       outgoing: true,       // links out of this note
  //       relatedNotes: true,   // notes sharing a parent
  //     },
  //   },
  //   llmsTxt: { enabled: true, full: false },
  //   discovery: {
  //     linkAlternate: true,    // <link rel="alternate" type="text/markdown">
  //     jsonLdEncoding: true,   // schema.org `encoding` → the mirror
  //     // Netlify/Cloudflare Pages `_headers`. Serves mirrors as
  //     // text/markdown, and adds RFC 8288 `Link` headers so an agent can
  //     // discover llms.txt and a page's mirror from a HEAD request, without
  //     // parsing HTML. Merged into an existing `_headers` behind a fence, so
  //     // your own CSP/HSTS/cache rules are left alone.
  //     emitHeadersFile: false,
  //   },
  //   schema: {
  //     series: true,           // isPartOf CreativeWorkSeries + position
  //     mentions: true,         // mentions, from the wiki-link graph
  //     definedTerms: true,     // DefinedTerm / DefinedTermSet
  //     citations: true,        // citation, from outbound external links
  //     knowsAbout: true,       // Person.knowsAbout, from note tags
  //   },
  //
  //   // robots.txt policy for AI crawlers. Omit and robots.txt is unchanged.
  //   //
  //   // The three groups exist because "AI crawler" covers three jobs whose
  //   // costs differ, and you can't tell which is which from the name:
  //   //
  //   //   training      — feeds model training. Blocking costs you nothing
  //   //                   in any search product. (GPTBot, ClaudeBot,
  //   //                   Google-Extended, CCBot, …)
  //   //   aiSearch      — the retrieval index AI answers cite. Blocking
  //   //                   these is what removes you from AI answers.
  //   //                   (OAI-SearchBot, Claude-SearchBot, PerplexityBot, …)
  //   //   userTriggered — a fetch because someone just asked about your page.
  //   //                   OpenAI and Perplexity both document that these
  //   //                   largely ignore robots.txt, so treat a rule here as
  //   //                   a stated preference rather than a control.
  //   //
  //   // The common ask — "don't train on me, but do cite me" — is also the
  //   // default; `training: 'block'` is spelled out here only for clarity.
  //   crawlers: {
  //     training: 'block',
  //     aiSearch: 'allow',
  //     // Per-token escape hatch; keys need not be crawlers onvu knows about.
  //     // overrides: { CCBot: 'allow', 'SomeNewBot': 'block' },
  //   },
  //
  //   // `Content-Signal` in robots.txt — a different axis from `crawlers`.
  //   // `crawlers` says who may *fetch*; this says what may be *done* with
  //   // the content afterwards, which is why it isn't derived from the above.
  //   // Defaults to `search=yes, ai-train=no`; `ai-input` is left unset,
  //   // since the policy treats an absent signal as neither granting nor
  //   // restricting and that is a genuine choice to make rather than assume.
  //   // https://contentsignals.org
  //   contentSignals: {
  //     search: true,     // index it, link it, quote a snippet
  //     aiInput: true,    // ground an AI answer in it
  //     aiTrain: false,   // do not train on it
  //   },
  //
  //   // Tools for an AI agent running inside the reader's browser. Read the
  //   // note on `WebMcpConfig` before enabling: for a reading-only site this
  //   // duplicates what llms.txt and the mirrors already give every agent
  //   // over plain HTTP, and the spec is still moving.
  //   webmcp: { enabled: false },
  // },
  // The built-in `rss` action copies the feed URL. This site has a note
  // that explains feeds and lists every language's, which is a better
  // destination than a URL on the clipboard.
  garden: {
    actions: ['graph', 'random', { label: 'RSS Feeds', href: 'notes/rss', icon: 'rss' }],
  },
}
