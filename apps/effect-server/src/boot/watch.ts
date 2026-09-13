/**
 * Reloading an app when its source changes (development only).
 *
 * The server can reload one app on demand (see reload.ts); this is the part that
 * decides *when*, so that editing a view and looking at the browser is the whole
 * loop — no restart, no separate command to remember.
 *
 * It is off unless asked for. A watcher in production would reload an app on any
 * write under its directory, including a build artifact landing there, and
 * "nothing reloaded because nobody edited anything" is not a property worth
 * guessing at.
 *
 * Events are debounced per app, because an editor saving a file is several
 * events and a reload is a module import: reloading once per event would load a
 * half-written module and then load the whole one over the top of it.
 *
 * An event is not an edit, and taking one for the other is a reload loop:
 * compiling a bundle copies the app's own asset directories into the artifact,
 * and the filesystem reports the *source* directory as renamed when it does. So
 * an event is judged by the file, and only an mtime that moved past the last
 * time this app reacted is an edit.
 */

import { statSync, watch, type FSWatcher } from "node:fs"
import { join, sep } from "node:path"
import { discoverManifests, type Discovered } from "../yaml-manifest.ts"
import type { ReloadOutcome } from "./reload-types.ts"

export interface SourceWatcher { close(): void }

export interface SourceWatcherOptions {
  readonly roots: readonly string[]
  /** The app layer's reload, told *which* app — one edit never touches its neighbours. */
  readonly reload: (appId: string) => Promise<ReloadOutcome>
  readonly onOutcome: (outcome: ReloadOutcome) => void
  readonly debounceMs?: number
}

/**
 * Trees an app's source never lives in, and whose writes are never an edit. The
 * list stops there: guessing at which of an app's own directories are "really"
 * source would silently stop reloading the ones guessed wrong.
 */
const ignored = [join("node_modules", ""), join(".git", "")]

export const makeSourceWatcher = (options: SourceWatcherOptions): SourceWatcher => {
  let apps: readonly Discovered[] = discoverManifests(options.roots)
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const watchers: FSWatcher[] = []
  const startedAt = Date.now()
  /** When each app last reacted: the line an event's modification time is read against. */
  const reactedAt = new Map<string, number>()

  /** Whether this path was *written*: a path gone since we looked counts, since `stat` cannot date a deletion. */
  const modified = (path: string, since: number): boolean => {
    try { return statSync(path).mtimeMs > since } catch { return true }
  }

  /** The app owning a path, deepest directory wins — roots may nest. */
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
        // Whose file this is gets read from disk rather than remembered: a source
        // tree gains and loses apps while the process runs.
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
