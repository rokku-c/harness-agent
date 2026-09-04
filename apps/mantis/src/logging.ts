/**
 * Turn HarnessEvent (the driver's observable loop) into leveled log entries.
 * A host attaches this hook per session so tool calls, outputs and failures
 * flow into its unified logger (console and/or persistent file sinks).
 */
import { Effect } from "effect"
import { Harness, type HarnessEvent, type HarnessHook } from "@effect-agent/core"
import type { Logger } from "@effect-agent/logger"

export const sessionLogHook = (logger: Logger): HarnessHook<never, never> =>
  Harness.hook("mantis-log", (event: HarnessEvent) =>
    Effect.sync(() => {
      switch (event._tag) {
        case "RunStarted":
          logger.info("session started", { agent: event.agent })
          break
        case "DriverPrepared":
          logger.debug("session prepared", { agent: event.agent, runtime: event.runtime })
          break
        case "ToolStarted":
          logger.debug("tool call", { agent: event.agent, tool: event.tool, input: event.input })
          break
        case "ToolCompleted":
          logger.debug("tool ok", { agent: event.agent, tool: event.tool, output: event.output })
          break
        case "Output":
          logger.debug("output", { agent: event.agent, output: event.output })
          break
        case "RunFailed":
          logger.error("session failed", { agent: event.agent, error: String(event.error) })
          break
        case "RunCompleted":
          logger.info("session completed", { agent: event.agent })
          break
      }
    })
  )
