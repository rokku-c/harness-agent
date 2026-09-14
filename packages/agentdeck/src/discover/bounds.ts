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

export const newest = <T extends { readonly mtimeMs: number }>(
  files: ReadonlyArray<T>,
  limit: number
): ReadonlyArray<T> => [...files].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit)
