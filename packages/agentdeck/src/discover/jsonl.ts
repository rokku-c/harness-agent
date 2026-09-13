/**
 * the JSONL session-store family: `<root>/<cwd-slug>/<session-id>.jsonl`, one
 * JSON object per line. claude code (`~/.claude/projects`) and pi
 * (`~/.pi/agent/sessions`) share this layout, so the reader is parameterised by
 * kind rather than duplicated - and a store that turns out to differ degrades
 * to "no sessions", it does not throw.
 */
import { basename, join } from "node:path"
import type { AgentKind } from "../types.ts"
import { mapLimit, newest } from "./bounds.ts"
import { findFiles, jsonLines, readHead } from "./files.ts"
import { firstField, headline, looksMachine, millis, record } from "./text.ts"
import type { DiscoveredSession, SessionSource } from "./types.ts"

/** session metadata lives at the top of the transcript; never read the rest */
const HEAD_BYTES = 32 * 1024
const CONCURRENCY = 8

/** first human line of the conversation, skipping injected instructions */
const firstUserText = (records: ReadonlyArray<unknown>): string | undefined => {
  for (const raw of records) {
    const entry = record(raw)
    if (entry.type !== undefined && entry.type !== "user") continue
    const content = record(entry.message).content ?? entry.content
    if (typeof content === "string") {
      if (!looksMachine(content)) return headline(content)
      continue
    }
    if (!Array.isArray(content)) continue
    for (const block of content) {
      const part = record(block)
      if (part.type !== "text") continue
      const value = part.text
      if (typeof value === "string" && !looksMachine(value)) return headline(value)
    }
  }
  return undefined
}

export const makeJsonlSource = (kind: AgentKind, relativeRoot: string): SessionSource => ({
  kind,
  discover: async (home, limit) => {
    const root = join(home, relativeRoot)
    const files = await findFiles(root, (name) => name.endsWith(".jsonl"), 3)
    const recent = newest(files, limit)
    return mapLimit(recent, CONCURRENCY, async (file): Promise<DiscoveredSession> => {
      const head = await readHead(file.path, HEAD_BYTES).catch(() => "")
      const records = jsonLines(head)
      const opened = millis(record(records[0]).timestamp, file.birthtimeMs)
      return {
        kind,
        sessionId: firstField(records, "sessionId") ?? basename(file.path, ".jsonl"),
        cwd: firstField(records, "cwd"),
        title: firstUserText(records),
        startedAt: opened,
        updatedAt: Math.max(file.mtimeMs, opened),
        bytes: file.size,
        source: file.path
      }
    })
  }
})
