/**
 * A Signal is control input into a RUNNING agent: injected context or a
 * cooperative stop. Signals drain at the loop's step boundaries - the
 * agent never loses its place, and interruption is honored between steps.
 */
import type { Queue } from "effect"
import type { Content } from "./content.ts"

export type Signal =
  | { readonly _tag: "Inject"; readonly content: ReadonlyArray<Content> }
  | { readonly _tag: "Interrupt" }

export type SignalBox = Queue.Queue<Signal>

