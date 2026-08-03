/** Writing direction of a locale's script. */
export type TextDirection = 'ltr' | 'rtl'

/**
 * Which way a locale reads, for `<html dir>`.
 *
 * Asked of `Intl` rather than kept as a list. Every implementation of "is this
 * RTL?" starts as `['ar', 'he', 'fa', 'ur']` and is wrong by omission from the
 * first day — it misses Pashto, Sindhi, Dhivehi, Uyghur, Yiddish, and Central
 * Kurdish (`ckb`, which `Intl` gets right and almost no hand-written list
 * does). It is also wrong in the other direction for the scripts that carry a
 * subtag: `az-Arab` is RTL while `az` is not, and `pa-Arab` differs from `pa`.
 * CLDR already knows all of this and ships inside the runtime.
 *
 * The fallback exists because `textInfo` is comparatively recent — Node 20+,
 * Safari 17+ — and an older runtime should render LTR rather than throw. It is
 * deliberately not a "known RTL locales" list: guessing badly and guessing
 * nothing look identical to a reader, and only one of them invites someone to
 * maintain it.
 */
export function localeDirection(locale: string): TextDirection {
  try {
    const resolved = new Intl.Locale(locale) as Intl.Locale & {
      textInfo?: { direction?: string }
      getTextInfo?: () => { direction?: string }
    }
    // Two spellings of the same proposal: a property in V8/Node and modern
    // Chrome, a method in the older draft that shipped in some Safari builds.
    const info = resolved.textInfo ?? resolved.getTextInfo?.()
    return info?.direction === 'rtl' ? 'rtl' : 'ltr'
  } catch {
    // An unparseable tag reaching this far is a config error, not a reason to
    // fail a render.
    return 'ltr'
  }
}
