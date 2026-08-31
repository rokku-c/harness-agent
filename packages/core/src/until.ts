import type { Schema } from "effect"
import type { Capabilities } from "./capabilities.ts"
import { UnsupportedCapability } from "./errors.ts"

/**
 * The termination condition as data - and the agent's OUTPUT type. An agent
 * declares what it returns by declaring when it stops.
 */
export type Until<A> =
  | { readonly _tag: "Text" }
  | { readonly _tag: "Thinking" }
  | { readonly _tag: "ToolCall" }
  | { readonly _tag: "Stop" }
  | { readonly _tag: "Schema"; readonly schema: Schema.Schema<A, any, never> }

export const Until = {
  text: { _tag: "Text" } as Until<string>,
  thinking: { _tag: "Thinking" } as Until<string>,
  toolCall: { _tag: "ToolCall" } as Until<Extract<import("./content.ts").Content, { _tag: "ToolCall" }>>,
  stop: { _tag: "Stop" } as Until<string>,
  schema: <A>(schema: Schema.Schema<A, any, never>): Until<A> => ({ _tag: "Schema", schema })
}

/** Check a driver's capabilities against the requested until - fail loud, precisely. */
export const requireUntil = <A>(id: string, capabilities: Capabilities, until: Until<A>) => {
  const reject = (required: string, actual: string) => new UnsupportedCapability({ agent: id, required, actual })
  switch (until._tag) {
    case "Text":
      return capabilities.granularity === "event" || capabilities.pause
        ? undefined
        : reject("pause at next text", "granularity=" + capabilities.granularity + ", pause=false")
    case "Thinking":
      return capabilities.thinking && (capabilities.granularity === "event" || capabilities.pause)
        ? undefined
        : reject("pause at next thinking", capabilities.thinking ? "pause=false" : "not exposed")
    case "ToolCall":
      return capabilities.toolCalls === "intercept" ? undefined : reject("pre-execution tool call", capabilities.toolCalls)
    case "Schema":
      return capabilities.structuredOutput !== "none" ? undefined : reject("structured output", "none")
    case "Stop":
      return undefined
  }
}

