import type { ConfigState } from "./config-api.ts"

export function describeConfigState(state: Pick<ConfigState, "ok" | "pendingRestart" | "revision">) {
  const pending = state.pendingRestart
  const tone: "error" | "pending" | "active" = !state.ok ? "error" : pending ? "pending" : "active"
  return {
    tone,
    label: !state.ok ? "Configuration error" : pending ? "Saved · restart or apply pending" : "Configuration is active",
    detail: pending ? "Saved values are not fully active; apply them explicitly or restart the service." : "Reload reads the persisted server values.",
    revision: state.revision === undefined ? "" : `revision ${state.revision}`,
    canApply: pending,
  }
}
