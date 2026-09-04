/** A turn that fails (model returns prose, decode AgentFailure) must be
 * digested by the host - it must NEVER become an unhandled rejection that
 * crashes the process (seen live in the pm2 web console). */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { noopLogger } from "@effect-agent/logger"
import type { Model } from "@effect-agent/builtin"
import { WebConsole } from "../src/hosts/webui/console.ts"

describe("turn failures are digested", () => {
  test("a prose reply (undecodable FinalReply) fails the turn, not the process", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-fail-"))
    try {
      const model = {
        generate: (_s: string, _m: unknown[], _t: unknown[]) => Effect.succeed({ text: "this is prose, not JSON", toolCalls: [] })
      } as unknown as Model
      const web = new WebConsole({ model, logger: noopLogger() })
      const result = await web.chatSync("fail-1", "hello") // would crash on an unhandled rejection
      expect(result.ok).toBe(true) // digested: no crash, no reply
      expect(result.reply).toBeUndefined()
      // the failure is visible in the conversation timeline as a note
      await new Promise((resolve) => setTimeout(resolve, 20))
      const note = web.conversationTimeline("fail-1").find((e) => e.kind === "note")
      expect(note).toBeDefined()
      // host handle itself never rejects either
      const hostTurn = web.host.handle({
        id: "t", text: "again", conversationId: "fail-2", conversationType: "single",
        senderId: "op", addressed: true, ts: Date.now()
      })
      await expect(hostTurn).resolves.toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
