/**
 * Shared vitest setup for both `node` and `jsdom` projects.
 *
 * Why a single file: the node project doesn't need jest-dom matchers or DOM
 * polyfills, but importing them under the `typeof window === 'undefined'`
 * guard is cheap and lets every test file rely on the same baseline.
 *
 * Note the `next/navigation` and `next-intl` mocks below. Component tests
 * grab these via `vi.mocked(useRouter)` / `useTranslations` and tweak them
 * per case — `tests/utils/router.ts` exports tiny helpers around that.
 */
import { afterEach, vi } from 'vitest'

// In jsdom, register testing-library matchers + auto-cleanup.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => {
    cleanup()
    // RTL's cleanup only unmounts containers it created with `render()`.
    // Anything a test wrote directly via `document.body.innerHTML = …`
    // survives — and the next test in the same jsdom worker then sees
    // those stray nodes (caught us with a duplicate <a> leaking from
    // ArticleEnhancer tests into a NoteCard `getByRole('link')` lookup).
    // Reset the body so each jsdom test starts from a clean DOM.
    if (typeof document !== 'undefined') document.body.innerHTML = ''
  })

  // Neither is `matchMedia`, which any component asking about
  // `prefers-color-scheme` or a breakpoint calls unguarded — `useMediaQuery`
  // and the graph's palette watcher both do. Four suites each carried their own
  // stub before this; a default here means a component that starts asking does
  // not take an unrelated test file down with it. Suites that need a specific
  // answer still override it with `vi.stubGlobal`.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }

  // ResizeObserver isn't implemented by jsdom. Tests that care about the
  // restore-on-grow loop in useTabScrollRestore reach for the polyfill via
  // (globalThis as any).__resizeObservers to fire callbacks manually.
  class FakeResizeObserver {
    callback: ResizeObserverCallback
    elements: Element[] = []
    constructor(cb: ResizeObserverCallback) {
      this.callback = cb
      ;((globalThis as { __resizeObservers?: FakeResizeObserver[] }).__resizeObservers ??= []).push(this)
    }
    observe(el: Element) { this.elements.push(el) }
    unobserve(el: Element) { this.elements = this.elements.filter((e) => e !== el) }
    disconnect() { this.elements = [] }
    // Test helper: fire the callback as if a resize happened.
    trigger() {
      this.callback(
        this.elements.map((target) => ({ target } as unknown as ResizeObserverEntry)),
        this as unknown as ResizeObserver,
      )
    }
  }
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver

  // jsdom doesn't ship PointerEvent — alias it to MouseEvent for tests.
  if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
    class FakePointerEvent extends MouseEvent {
      pointerId: number
      // Carried through because behaviour hangs off it: the graph's
      // long-press labels are gated on `pointerType === 'touch'`, and a
      // polyfill that dropped it would make every test look like a mouse.
      pointerType: string
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
        this.pointerType = init.pointerType ?? 'mouse'
      }
    }
    ;(globalThis as { PointerEvent?: unknown }).PointerEvent = FakePointerEvent
  }

  // jsdom doesn't implement scrollIntoView; harmless no-op.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }

  // Zustand persist stores read localStorage when a setState is committed.
  // jsdom is inconsistent here: locally it provides a working Storage,
  // but on CI it sometimes hands back an object whose `setItem` is
  // missing (the engine refuses storage at `about:blank` and only
  // populates the API once a real URL is loaded). The presence check
  // we used before passed straight through this broken shape, so the
  // persist middleware crashed with `storage.setItem is not a function`.
  // Probe for the actual method before deciding whether to swap in our
  // own Map-backed Storage.
  const ls = (window as { localStorage?: Partial<Storage> }).localStorage
  if (!ls || typeof ls.setItem !== 'function' || typeof ls.getItem !== 'function') {
    const store = new Map<string, string>()
    const fake: Storage = {
      get length() { return store.size },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => { store.clear() },
    }
    Object.defineProperty(window, 'localStorage', { value: fake, configurable: true })
  }
}

// next/navigation — controllable router. Tests reset between cases.
vi.mock('next/navigation', () => {
  const push = vi.fn()
  const replace = vi.fn()
  const refresh = vi.fn()
  const back = vi.fn()
  const forward = vi.fn()
  const prefetch = vi.fn()
  const router = { push, replace, refresh, back, forward, prefetch }
  const state: {
    params: Record<string, string>
    pathname: string
    searchParams: URLSearchParams
  } = {
    params: { locale: 'en' },
    pathname: '/en',
    searchParams: new URLSearchParams(),
  }
  return {
    __router: router,
    __state: state,
    useRouter: () => router,
    useParams: () => state.params,
    usePathname: () => state.pathname,
    useSearchParams: () => state.searchParams,
    notFound: () => { throw new Error('NEXT_NOT_FOUND') },
    redirect: (url: string) => { throw new Error(`NEXT_REDIRECT ${url}`) },
  }
})

// next-intl — identity translations + simple locale provider so component
// trees don't need a real IntlProvider in tests.
vi.mock('next-intl', () => {
  return {
    useTranslations: (_ns?: string) => {
      const t = (key: string, values?: Record<string, unknown>) => {
        if (values && Object.keys(values).length > 0) {
          return `${key}(${JSON.stringify(values)})`
        }
        return key
      }
      // The real `useTranslations` returns a callable carrying `has()`. Code
      // that asks before translating — `themeLabel`, so a custom theme falls
      // back to its literal label instead of rendering `theme.ocean` — needs
      // it here too. Answering `true` matches this mock's own contract: it
      // resolves every key, verbatim.
      t.has = (_key: string) => true
      return t
    },
    useLocale: () => 'en',
    useFormatter: () => ({
      dateTime: (d: Date) => d.toISOString(),
      number: (n: number) => String(n),
      relativeTime: (d: Date) => d.toISOString(),
    }),
    useMessages: () => ({
      language: { en: 'English', uk: 'Українська', de: 'Deutsch' },
    }),
  }
})

// Reset spy state between tests so assertions don't leak.
afterEach(() => {
  vi.clearAllMocks()
})
