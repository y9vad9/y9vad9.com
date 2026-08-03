/**
 * Writing a generated block into a file the site owns.
 *
 * `_headers` and `_redirects` are both host configuration that an adopter
 * legitimately edits by hand: the first typically carries CSP, HSTS and cache
 * policy, the second carries redirects for note slugs they have renamed.
 * Neither can be overwritten, and neither can be left alone, so both get a
 * fenced block rewritten in place.
 *
 * The two rules for anyone adding a third: the markers must be escaped before
 * they go into a regex, and the file must be rebuilt from a saved base rather
 * than appended to.
 */

export interface Fence {
  /** Comment line opening the generated region. */
  begin: string
  /** Comment line closing it. */
  end: string
}

/**
 * A regex matching the fenced region, surrounding blank lines included.
 *
 * The markers carry `(generated, do not edit)`, so they have to be escaped:
 * unescaped, those parentheses become a capture group, the fence never
 * matches, and every build appends another block instead of replacing one.
 */
export function fenceRegex(fence: Fence): RegExp {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\n*${escape(fence.begin)}[\\s\\S]*?${escape(fence.end)}\\n*`, 'g')
}

/** Everything in `content` that is not ours. */
export function stripFencedBlock(content: string, fence: Fence): string {
  return content.replace(fenceRegex(fence), '\n').trimEnd()
}

/** Does `content` already carry a generated region? */
export function hasFencedBlock(content: string, fence: Fence): boolean {
  return fenceRegex(fence).test(content)
}

/**
 * The site's own content, then ours, fenced.
 *
 * Pure, so the composition can be tested without a filesystem. `writeFenced`
 * below is the only thing that decides what `base` is.
 */
export function composeFencedFile(base: string, fence: Fence, block: string): string {
  const fenced = `${fence.begin}\n${block.trimEnd()}\n${fence.end}`
  return base ? `${base}\n\n${fenced}\n` : `${fenced}\n`
}

/**
 * Reading and writing, injected so tests need no temp directory.
 *
 * `write` must be atomic from a reader's point of view. `fs.writeFile`
 * truncates before it writes, and page generation runs across worker
 * processes, so a plain write leaves a window in which another worker reads an
 * existing-but-empty file. See `writeFenced` for what that cost.
 */
export interface FencedFileIo {
  read: (path: string) => Promise<string | null>
  write: (path: string, content: string) => Promise<void>
}

export interface WriteFencedOptions {
  /** The file the host reads. */
  target: string
  /**
   * Where the site's own content is snapshotted the first time we touch the
   * file, so it can be recovered on later builds.
   */
  snapshot: string
  fence: Fence
  /** Generated content, without the markers. */
  block: string
  io: FencedFileIo
}

/**
 * Rewrite the generated region of a user-owned file.
 *
 * Never appends to its own output. Page generation runs across worker
 * processes, and read-then-append let two of them both observe a fence-free
 * file and each add a block. Instead the site's own content is captured once as
 * a base and the file is rebuilt from it every time, so concurrent workers
 * write byte-identical content and duplication is not representable.
 *
 * Two rules keep that safe under concurrency, and both were learned the
 * expensive way: an existing snapshot is never rewritten, and an empty base is
 * never snapshotted. Without them a worker that read the target mid-truncate
 * saw an existing-but-empty file, concluded the site owned nothing, and wrote
 * that conclusion over the snapshot. The next write then rebuilt the file from
 * nothing, and a fork's redirects were gone with no error anywhere. `io.write`
 * being atomic closes the window; these two make the outcome unreachable even
 * if it reopens.
 */
export async function writeFenced(opts: WriteFencedOptions): Promise<void> {
  const { target, snapshot, fence, block, io } = opts
  const saved = await io.read(snapshot)
  const current = await io.read(target)

  let base: string
  if (saved !== null) {
    // Already captured. This is the authority from here on: the target has our
    // block in it now, so it can only ever be an approximation of the original.
    base = saved
  } else if (current === null) {
    base = ''
  } else if (hasFencedBlock(current, fence)) {
    base = stripFencedBlock(current, fence)
  } else {
    base = current.trimEnd()
    // Only when there is something to save. An empty snapshot is
    // indistinguishable from a captured "the site owns nothing", and writing
    // one is how the real content became unrecoverable.
    if (base) await io.write(snapshot, base)
  }

  await io.write(target, composeFencedFile(base, fence, block))
}
