/**
 * How much of a machine's sessions to look at, and how many at once.
 *
 * Separate from the file readers because it is a policy, not a read: every
 * adapter wants "the newest N" and every walk wants a bounded number of files
 * open, and keeping that in one place is what stops an adapter from quietly
 * reading a whole store to answer a question about its newest few.
 */
/** run `work` over items with bounded concurrency, preserving order */
export const mapLimit = async <A, B>(
  items: ReadonlyArray<A>,
  limit: number,
  work: (item: A) => Promise<B>
): Promise<ReadonlyArray<B>> => {
  const out: Array<B> = new Array(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++
      if (index >= items.length) return
      out[index] = await work(items[index] as A)
    }
  }
  const width = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: width }, worker))
  return out
}

/** newest first, capped - every adapter wants this before reading anything */
export const newest = <T extends { readonly mtimeMs: number }>(
  files: ReadonlyArray<T>,
  limit: number
): ReadonlyArray<T> => [...files].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit)
