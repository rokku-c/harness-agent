import type { Access, Op } from "@effect-agent/core"

export const callableOps = <R>(access: ReadonlyArray<Access<R>>): ReadonlyArray<Op<unknown, unknown, unknown, R>> =>
  access.flatMap(({ binding, write }) =>
    (binding.ops ?? []).filter((op) => op.access === "read" || write)
  ) as ReadonlyArray<Op<unknown, unknown, unknown, R>>
