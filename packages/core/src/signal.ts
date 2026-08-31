/**
 * A Signal is control input into a RUNNING agent: injected context, a
 * cooperative stop, or a checkpoint-and-pause. Signals drain at the loop's
 * step boundaries - the agent never loses its place, and every signal is
 * honored between steps.
 */
import type { Queue } from "effect"
import type { Content } from "./content.ts"

export type Signal =
  | { readonly _tag: "Inject"; readonly content: ReadonlyArray<Content> }
  | { readonly _tag: "Interrupt" }
  | { readonly _tag: "Pause" }

export type SignalBox = Queue.Queue<Signal>

