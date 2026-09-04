/**
 * console/ui-ops.ts - VERSIONING the agent UI.
 *
 * Concept: official A2UI v0.9 batches pushed by an agent (or the operator)
 * are versioned + announced as ui.updated; restore re-publishes an older
 * version as a new one (strict append log, no mutation).
 */
import type { Bus } from "../bus.ts"
import type { UiStore } from "../ui-store.ts"
import type { A2uiMessage } from "../a2ui.ts"

export const acceptUi = (ui: UiStore, bus: Bus, messages: ReadonlyArray<A2uiMessage>, author: string): void => {
  const version = ui.push(messages, author)
  bus.push({ type: "ui.updated", version: version.n, author })
}

/** re-publish an older agent-UI version as the current one (rollback) */
export const restoreUi = (ui: UiStore, version: number): { ok: boolean; detail?: string } => {
  const messages = ui.get(version)
  if (messages === undefined) return { ok: false, detail: "no such version" }
  ui.push(messages, "restore")
  return { ok: true }
}
