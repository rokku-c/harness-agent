/**
 * interactiveSpec — text + form rendering of a parity view.
 *
 * The human sees the agent's world: the current view + live state read out as
 * text, and — for every action — a form whose inputs come from the action's
 * own JSON schema. Fills the same role an agent plays: same view, same state,
 * same tool set.
 */

import { esc, formOf } from "./form.ts"
import type { ParityAppView } from "./types.ts"

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)

const textParts = (d: Record<string, unknown>, keys: readonly string[]): string[] =>
  keys.map((k) => d[k]).filter((x): x is string => typeof x === "string" && x.length > 0)

/** A short human text for an arbitrary UiDocument / view value. */
export const describeView = (view: unknown): string => {
  if (view === undefined || view === null) return "(no view)"
  if (typeof view === "string") return view
  if (!isObj(view)) return JSON.stringify(view)
  const d = view
  if (typeof d["lang"] === "string") {
    const inner = d["view"] ?? d["spec"]
    if (inner !== undefined) return `${d["lang"]}: ${describeView(inner)}`
    if (typeof d["html"] === "string") return `html: (${d["html"].length} chars)`
  }
  const parts = textParts(d, ["title", "description", "kind", "name", "viewId", "id"])
  if (parts.length > 0) {
    const inner = typeof d["view"] === "string" ? d["view"] : ""
    return inner !== "" && !parts.join(" ").includes(inner) ? `${parts.join(" — ")} — ${inner}` : parts.join(" — ")
  }
  return JSON.stringify(view)
}

const stateText = (state: unknown): string => {
  if (state === undefined) return "(no state)"
  try {
    return JSON.stringify(state, null, 2)
  } catch {
    return String(state)
  }
}

const textBlock = (title: string, body: string, cls: string): string =>
  `<section class="parity-${cls}"><h3>${title}</h3><pre>${esc(body)}</pre></section>`

export const interactiveSpec = (view: ParityAppView): string => {
  const head = `<h2 class="parity-app">${esc(`${view.ns}::${view.appId}`)}</h2>`
  const viewBlock = textBlock("view", describeView(view.view), "view")
  const stateBlock = textBlock("state", stateText(view.state), "state")
  const actions = view.actions.length > 0
    ? `<section class="parity-actions"><h3>actions (${view.actions.length})</h3>` +
      view.actions.map((a, i) => formOf(a, i)).join("\n") +
      `</section>`
    : `<p class="parity-actions">(no actions)</p>`
  return `<div class="parity-view" data-ns="${esc(view.ns)}" data-app="${esc(view.appId)}">` +
    head + viewBlock + stateBlock + actions +
    `</div>`
}
