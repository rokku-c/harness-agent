/** Barrel: the BoardService split by CONCEPT (see ./board/). contract.ts =
 *  the faceted BoardApi; rules.ts = pure workflow rules; context.ts = shared
 *  transition context; reads.ts / item-create.ts / start.ts / outcomes.ts /
 *  exec-res.ts = api slices; assembly.ts = makeBoard wiring. */
export type { BoardOptions, BoardSnapshot, BoardApi, BoardDeps } from "./board/contract.ts"
export { makeBoard } from "./board/assembly.ts"
