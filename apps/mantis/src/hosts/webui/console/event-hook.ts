/**
 * console/event-hook.ts - SESSION EVENTS -> bus + timeline.
 *
 * Concept: harness events stream tool steps to the observability bus AND the
 * active conversation's timeline. Attribution comes from the async context
 * (AsyncLocalStorage) of the turn that is running.
 */
import { Effect } from "effect"
import { Harness, type HarnessEvent, type HarnessHook } from "@effect-agent/core"
import type { Bus } from "../bus.ts"
import { short } from "./helpers.ts"

export const eventHook = (
  bus: Bus,
  activeConversation: () => string | undefined,
  recordTool: (tool: string, state: "call" | "ok" | "fail", detail: string | undefined) => void
): HarnessHook<never, never> =>
  Harness.hook("webui-events", (event: HarnessEvent) =>
    Effect.sync(() => {
      const conversationId = activeConversation() ?? ""
      switch (event._tag) {
        case "RunStarted": bus.push({ type: "session.start", conversationId }); break
        case "RunCompleted": bus.push({ type: "session.stop", conversationId }); break
        case "RunFailed": bus.push({ type: "session.stop", conversationId }); break
        case "ToolStarted": {
          const detail = short(event.input)
          recordTool(event.tool, "call", detail)
          bus.push({ type: "tool", conversationId, tool: event.tool, state: "call", detail })
          break
        }
        case "ToolCompleted": {
          const output = event.output as { ok?: boolean } | undefined
          const failed = output !== null && typeof output === "object" && output.ok === false
          const detail = short(event.output)
          recordTool(event.tool, failed ? "fail" : "ok", detail)
          bus.push({ type: "tool", conversationId, tool: event.tool, state: failed ? "fail" : "ok", detail })
          break
        }
      }
    }))
