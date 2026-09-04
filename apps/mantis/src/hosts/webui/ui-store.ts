/**
 * Agent-driven UI (official A2UI v0.9): an agent renders a surface by
 * emitting A2UI messages (createSurface/updateComponents ...). Every accepted
 * batch is versioned and persisted as a numbered git-tracked file - UI
 * changes are under version control and can be reviewed, diffed, rolled back.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { A2uiMessage } from "./a2ui.ts"
import { surfaceIdOfBatch } from "./a2ui.ts"

export interface UiVersionMeta {
  readonly n: number
  readonly ts: string
  readonly author: string
  readonly surfaceId: string
  readonly file: string
}

export interface UiVersion extends UiVersionMeta {
  readonly messages: ReadonlyArray<A2uiMessage>
}

interface Stored {
  readonly version: number
  readonly ts: string
  readonly author: string
  readonly messages: A2uiMessage[]
}

const surfaceIdOf = (messages: ReadonlyArray<A2uiMessage>): string => surfaceIdOfBatch(messages)

/** accepted A2UI message batches live under <dir>/<surfaceId>.json + versions/ */
export class UiStore {
  readonly #dir: string
  constructor(dir: string) {
    this.#dir = dir
    mkdirSync(join(dir, "versions"), { recursive: true })
  }
  /** persist one accepted batch as the next version (git-tracked file) */
  readonly push = (messages: ReadonlyArray<A2uiMessage>, author: string): UiVersion => {
    const versionDir = join(this.#dir, "versions")
    const existing = readdirSync(versionDir).filter((f) => f.endsWith(".json")).sort()
    const last = existing.length > 0 ? Number(existing[existing.length - 1]!.split("-")[0]) : 0
    const n = (Number.isFinite(last) ? last : 0) + 1
    const ts = new Date().toISOString()
    const file = join(versionDir, n + "-" + ts.replace(/[:.]/g, "-") + ".json")
    const stored: Stored = { version: n, ts, author, messages: [...messages] }
    writeFileSync(file, JSON.stringify(stored, null, 2) + "\n", "utf-8")
    const surfaceId = surfaceIdOf(messages)
    writeFileSync(join(this.#dir, surfaceId + ".json"), JSON.stringify(stored, null, 2) + "\n", "utf-8")
    writeFileSync(join(this.#dir, "latest.json"), JSON.stringify(stored, null, 2) + "\n", "utf-8")
    return { n, ts, author, surfaceId, file, messages: stored.messages }
  }
  /** version metadata, newest first */
  readonly versions = (): UiVersionMeta[] =>
    readdirSync(join(this.#dir, "versions"))
      .filter((f) => f.endsWith(".json"))
      .map((file) => {
        const raw = JSON.parse(readFileSync(join(this.#dir, "versions", file), "utf-8")) as Stored
        return { n: raw.version, ts: raw.ts, author: raw.author, surfaceId: surfaceIdOf(raw.messages), file }
      })
      .sort((a, b) => b.n - a.n)
  /** the current accepted batch (latest update) */
  readonly latest = (): ReadonlyArray<A2uiMessage> | undefined => {
    const file = join(this.#dir, "latest.json")
    if (!existsSync(file)) return undefined
    return (JSON.parse(readFileSync(file, "utf-8")) as Stored).messages
  }
  readonly get = (n: number): ReadonlyArray<A2uiMessage> | undefined => {
    const version = this.versions().find((v) => v.n === n)
    if (version === undefined) return undefined
    return (JSON.parse(readFileSync(join(this.#dir, "versions", version.file), "utf-8")) as Stored).messages
  }
}
