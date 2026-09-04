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
  /**
   * The run's output is the schema's decoded value. Drivers that serve this
   * over native tool calls expose ONE synthetic tool whose input schema IS
   * the result - its NAME and description come from `asTool`, declared by the
   * agent layer (core stays generic; naming belongs to the agent, not core).
   */
  | { readonly _tag: "Schema"; readonly schema: Schema.Schema<A, any, never>; readonly asTool?: { readonly name: string; readonly description?: string } }

export const Until = {
  text: { _tag: "Text" } as Until<string>,
  thinking: { _tag: "Thinking" } as Until<string>,
  toolCall: { _tag: "ToolCall" } as Until<Extract<import("./content.ts").Content, { _tag: "ToolCall" }>>,
  stop: { _tag: "Stop" } as Until<string>,
  /** structured result; pass asTool to serve it as a native tool call */
  schema: <A>(
    schema: Schema.Schema<A, any, never>,
    asTool?: { readonly name: string; readonly description?: string }
  ): Until<A> => ({ _tag: "Schema", schema, ...(asTool === undefined ? {} : { asTool }) })
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

