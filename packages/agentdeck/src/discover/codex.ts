/**
 * codex CLI session store: `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl`.
 * The first line is always `session_meta` carrying id, cwd and start time.
 *
 * Titles come from `~/.codex/session_index.jsonl` where codex has one (it names
 * the thread itself), NOT from the transcript head: a rollout injects AGENTS.md
 * instructions past the first 50KB and the human's actual prompt can sit
 * megabytes in, so scanning for it would mean reading whole 25MB rollouts to
 * label a list row.
 */
import { basename, join } from "node:path"
import { mapLimit, newest } from "./bounds.ts"
import { findFiles, jsonLines, readHead, readWhole } from "./files.ts"
import { headline, looksMachine, millis, record, text } from "./text.ts"
import type { DiscoveredSession, SessionSource } from "./types.ts"

const HEAD_BYTES = 32 * 1024
const INDEX_BYTES = 1024 * 1024
const CONCURRENCY = 8
const META = "session_meta"

/** id -> the thread name codex recorded for it (last write wins) */
const readIndex = async (home: string): Promise<ReadonlyMap<string, string>> => {
  const lines = jsonLines(await readWhole(join(home, ".codex", "session_index.jsonl"), INDEX_BYTES))
  const names = new Map<string, string>()
  for (const raw of lines) {
    const entry = record(raw)
    const id = text(entry.id)
    const name = text(entry.thread_name)
    if (id !== undefined && name !== undefined && !looksMachine(name)) names.set(id, headline(name))
  }
  return names
}

const inFileTitle = (records: ReadonlyArray<unknown>): string | undefined => {
  for (const raw of records) {
    const entry = record(raw)
    if (entry.type !== "response_item") continue
    const payload = record(entry.payload)
    if (payload.role !== "user") continue
    const content = payload.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      const value = record(block).text
      if (typeof value === "string" && !looksMachine(value)) return headline(value)
    }
  }
  return undefined
}

export const codexSource: SessionSource = {
  kind: "codex",
  discover: async (home, limit) => {
    const names = await readIndex(home)
    const files = await findFiles(join(home, ".codex", "sessions"), (name) => name.startsWith("rollout-") && name.endsWith(".jsonl"), 4)
    return mapLimit(newest(files, limit), CONCURRENCY, async (file): Promise<DiscoveredSession> => {
      const records = jsonLines(await readHead(file.path, HEAD_BYTES).catch(() => ""))
      const meta = record(record(records.find((raw) => record(raw).type === META)).payload)
      const id = text(meta.id) ?? basename(file.path, ".jsonl")
      const started = millis(meta.timestamp, file.birthtimeMs)
      return {
        kind: "codex",
        sessionId: id,
        cwd: typeof meta.cwd === "string" ? meta.cwd : undefined,
        title: names.get(id) ?? inFileTitle(records),
        startedAt: started,
        updatedAt: Math.max(file.mtimeMs, started),
        bytes: file.size,
        source: file.path
      }
    })
  }
}
