/**
 * Escape text for interpolation into an XML document.
 *
 * The RSS feed is built by string concatenation, and the channel `<title>` and
 * `<description>` were interpolated raw — so a single `&` in `owner.name` or
 * `owner.bio` produced a malformed document and every reader dropped the feed
 * silently. An ampersand in a bio is not an edge case; it is how people write.
 *
 * Applied uniformly rather than to those two fields, because the alternative
 * the item elements used — `<![CDATA[…]]>` — has its own hole: a title
 * containing `]]>` closes the section early. One rule with no exceptions beats
 * two mechanisms with different failure modes.
 *
 * `<` and `&` are the only characters XML strictly requires escaping in text,
 * but `>` is escaped too (harmless, and it makes `]]>` unrepresentable), and
 * the quotes so the same function is safe inside an attribute — which is where
 * cover-image URLs land, query strings and all.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
