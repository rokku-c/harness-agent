let entries: readonly string[] = []

const current = (): string | undefined => entries[entries.length - 1]

export const backTarget = (): string | undefined =>
  entries.length < 2 ? undefined : entries[entries.length - 2]

export const canGoBack = (): boolean => entries.length >= 2

export const pushed = (hash: string): void => { entries = [...entries, hash] }

const reconcile = (hash: string): void => {
  if (hash === current()) return
  entries = hash === backTarget() ? entries.slice(0, -1) : [hash]
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => { reconcile(window.location.hash) })
  reconcile(window.location.hash)
}
