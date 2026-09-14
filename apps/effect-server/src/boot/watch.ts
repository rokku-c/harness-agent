import { statSync, watch, type FSWatcher } from "node:fs"
import { join, sep } from "node:path"
import { discoverManifests, type Discovered } from "../yaml-manifest.ts"
import type { ReloadOutcome } from "./reload-types.ts"

export interface SourceWatcher { close(): void }

export interface SourceWatcherOptions {
  readonly roots: readonly string[]
  readonly reload: (appId: string) => Promise<ReloadOutcome>
  readonly onOutcome: (outcome: ReloadOutcome) => void
  readonly debounceMs?: number
}

const ignored = [join("node_modules", ""), join(".git", "")]

export const makeSourceWatcher = (options: SourceWatcherOptions): SourceWatcher => {
  let apps: readonly Discovered[] = discoverManifests(options.roots)
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const watchers: FSWatcher[] = []
  const startedAt = Date.now()
  const reactedAt = new Map<string, number>()

  const modified = (path: string, since: number): boolean => {
    try { return statSync(path).mtimeMs > since } catch { return true }
  }

  const owner = (path: string): string | undefined => {
    let best: Discovered | undefined
    for (const app of apps) {
      if (path !== app.dir && !path.startsWith(app.dir + sep)) continue
      if (best === undefined || app.dir.length > best.dir.length) best = app
    }
    return best?.manifest.id
  }

  for (const root of options.roots) {
    try {
      watchers.push(watch(root, { recursive: true }, (_event, name) => {
        if (name === null || ignored.some((skip) => name.includes(skip))) return
        apps = discoverManifests(options.roots)
        const path = join(root, name)
        const appId = owner(path)
        if (appId === undefined) return
        if (!modified(path, reactedAt.get(appId) ?? startedAt)) return
        const running = timers.get(appId)
        if (running !== undefined) clearTimeout(running)
        timers.set(appId, setTimeout(() => {
          timers.delete(appId)
          reactedAt.set(appId, Date.now())
          void options.reload(appId).then(options.onOutcome)
        }, options.debounceMs ?? 150))
      }))
    } catch { /* a root that cannot be watched is a root with nothing to reload */ }
  }

  return {
    close: () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      for (const watcher of watchers) watcher.close()
    },
  }
}
