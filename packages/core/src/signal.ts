import type { Queue } from "effect"
import type { Content } from "./content.ts"

export type Signal =
  | { readonly _tag: "Inject"; readonly content: ReadonlyArray<Content> }
  | { readonly _tag: "Interrupt" }
  | { readonly _tag: "Pause" }

export type SignalBox = Queue.Queue<Signal>
