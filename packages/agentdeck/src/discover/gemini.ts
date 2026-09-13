/**
 * gemini CLI session store: `~/.gemini/tmp/<project-hash>/chats/session-*.json`.
 * One JSON document per session (not JSONL), holding sessionId/startTime/
 * lastUpdated/messages. The store records no working directory - the hash names
 * a project the CLI keeps elsewhere - so cwd is left undefined rather than
 * guessed from an opaque hash.
 */
import { join } from "node:path"
import { mapLimit, newest } from "./bounds.ts"
import { findFiles, readJson, readWhole } from "./files.ts"
import { headline, looksMachine, millis, record } from "./text.ts"
import type { DiscoveredSession, SessionSource } from "./types.ts"

/** One JSON document per session, with the metadata we need AFTER the message
 *  array, so unlike the JSONL stores this cannot be head-read - the document is
 *  read whole. Real sessions here run to a couple of MB, hence the ceiling. */
const MAX_BYTES = 8 * 1024 * 1024
const CONCURRENCY = 4

const firstUserText = (messages: ReadonlyArray<unknown>): string | undefined => {
  for (const raw of messages) {
    const message = record(raw)
    if (message.type !== "user") continue
    const content = message.content
    if (typeof content === "string" && !looksMachine(content)) return headline(content)
  }
  return undefined
}

export const geminiSource: SessionSource = {
  kind: "gemini",
  discover: async (home, limit) => {
    const root = join(home, ".gemini", "tmp")
    const files = await findFiles(root, (name) => name.startsWith("session-") && name.endsWith(".json"), 3)
    const recent = newest(files, limit)
    return mapLimit(recent, CONCURRENCY, async (file): Promise<DiscoveredSession | undefined> => {
      const parsed = record(readJson(await readWhole(file.path, MAX_BYTES)))
      const id = typeof parsed.sessionId === "string" ? parsed.sessionId : undefined
      if (id === undefined) return undefined
      const messages = Array.isArray(parsed.messages) ? parsed.messages : []
      const started = millis(parsed.startTime, file.birthtimeMs)
      return {
        kind: "gemini",
        sessionId: id,
        title: firstUserText(messages),
        startedAt: started,
        updatedAt: millis(parsed.lastUpdated, Math.max(file.mtimeMs, started)),
        bytes: file.size,
        source: file.path
      }
    }).then((found) => found.filter((session): session is DiscoveredSession => session !== undefined))
  }
}
