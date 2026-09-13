/**
 * Which of an agent's ops a driver may expose.
 *
 * An agent declares access to a binding either as a read (`.uses(binding)`) or
 * as a write (`.writes(binding)`), and each op on that binding declares its own
 * mode. The rule is one sentence: **read ops are always callable; write ops
 * only where write access was granted** — which is what `.writes()` means, and
 * the whole of what stands between a read-only grant and a mutating call.
 *
 * Both drivers need it: the Effect loop turns these into its tool surface, the
 * Claude Code adapter turns them into native MCP tools inside its own process.
 * Written twice, the same agent definition could call a write op under one
 * driver and not the other, so the check is stated once and read by both.
 */

import type { Access, Op } from "@effect-agent/core"

/** The ops callable under this grant, in binding order. */
export const callableOps = <R>(access: ReadonlyArray<Access<R>>): ReadonlyArray<Op<unknown, unknown, unknown, R>> =>
  access.flatMap(({ binding, write }) =>
    (binding.ops ?? []).filter((op) => op.access === "read" || write)
  ) as ReadonlyArray<Op<unknown, unknown, unknown, R>>
