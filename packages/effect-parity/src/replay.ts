import type { ObservationSnapshot } from "@effect-agent/effect-observe"
import type { ParityAppView } from "./types.ts"

const isParityView = (data: unknown): data is ParityAppView => {
  if (typeof data !== "object" || data === null) return false
  const view = data as Partial<ParityAppView>
  return typeof view.ns === "string" && typeof view.appId === "string" && Array.isArray(view.actions)
}

export const parityFromSnapshot = (snapshot: ObservationSnapshot): ParityAppView | undefined => {
  const data = snapshot.data
  return isParityView(data) ? data : undefined
}
