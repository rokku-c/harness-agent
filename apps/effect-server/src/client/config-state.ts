import type { ConfigState } from "./config-api.ts"

/** Wording follows server state, never an optimistic client-side assumption. */
export function describeConfigState(state: Pick<ConfigState, "ok" | "pendingRestart" | "revision">) {
  const pending = state.pendingRestart
  /**
   * Written out rather than left to the conditional, because a property of a
   * returned object literal widens to `string` and the surface below colours a
   * callout by looking the tone up in a map of exactly these three. Naming the
   * set here is what makes that lookup total: a fourth tone would fail here,
   * where it is produced, instead of at the callout.
   */
  const tone: "error" | "pending" | "active" = !state.ok ? "error" : pending ? "pending" : "active"
  return {
    tone,
    label: !state.ok ? "Configuration error" : pending ? "Saved · restart or apply pending" : "Configuration is active",
    detail: pending ? "Saved values are not fully active; apply them explicitly or restart the service." : "Reload reads the persisted server values.",
    revision: state.revision === undefined ? "" : `revision ${state.revision}`,
    canApply: pending,
  }
}
