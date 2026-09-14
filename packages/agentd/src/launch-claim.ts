import type { LaunchIntent, LaunchState } from "./launch-types.ts"

const OPEN: readonly LaunchState[] = ["queued", "claimed", "running"]

export const settled = (state: LaunchState): boolean => !OPEN.includes(state)

export const claimLapsed = (intent: LaunchIntent, at: number, claimTtlMs: number): boolean =>
  intent.state === "claimed" && (intent.claimedAt ?? 0) + claimTtlMs <= at
