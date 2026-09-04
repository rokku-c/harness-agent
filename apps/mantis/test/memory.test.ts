/**
 * Conversation memory: later turns of the same conversation must see the
 * earlier ones. The history binding has to re-render on every materialize -
 * a snapshot captured at session creation would freeze the agent forever.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { noopLogger } from "@effect-agent/logger"
import type { Model, WireMessage } from "@effect-agent/builtin"
import { WebConsole } from "../src/hosts/webui/console.ts"

const finalJson = (reply: string) => ({
  text: JSON.stringify({ reply, tone: "plain", asksConfirmation: false }),
  toolCalls: [] as Array<never>
})

describe("conversation memory", () => {
  test("turn 2's model request contains turn 1 (history binding is live, not a frozen snapshot)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-memory-"))
    try {
      const requests: Array<string> = []
      const model = {
        generate: (_system: string, messages: ReadonlyArray<WireMessage>, _tools: unknown[]) => {
          requests.push(messages.map((m) => String(m.content)).join("\n"))
          return Effect.succeed(finalJson("ok"))
        }
      } as unknown as Model
      const web = new WebConsole({ model, uiDir: dir, logger: noopLogger() })

      await web.chatSync("mem-1", "记住这句话：alpha bravo")
      await web.chatSync("mem-1", "我上一句说了什么？")

      expect(requests.length).toBe(2)
      // the second model request carries the first turn (user text + reply)
      expect(requests[1]!).toContain("alpha bravo")
      expect(requests[1]!).toContain("mantis: ok")
      expect(requests[1]!).toContain("我上一句说了什么？")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

