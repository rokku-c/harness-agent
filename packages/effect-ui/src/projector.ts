/**
 * Project a RenderContract (+ data) into ANY representation the consumer
 * prefers — json / toml / compact text — while keeping every element's
 * interactivity markers visible in each output. Same rules, arbitrary
 * expressions.
 */

import type { ContractElement, RenderContract } from "./contract.ts"

const objAt = (root: unknown, path?: string): unknown => {
  if (path === undefined || path === "") return undefined
  let cur: unknown = root
  for (const seg of path.replace(/^\//, "").split("/")) {
    if (cur === null || typeof cur !== "object" || !(seg in (cur as Record<string, unknown>))) return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

const show = (value: unknown): string => {
  if (value === undefined) return ""
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const mark = (e: ContractElement): string =>
  (e.interactive ?? []).map((i) => `[${i.on}:${i.action}${Object.keys(i.args ?? {}).length ? " " + show(i.args) : ""}]`).join(" ")

export const contractToJson = (contract: RenderContract, data?: unknown): string =>
  JSON.stringify({ contract, data }, null, 2)

export const contractToToml = (contract: RenderContract, data?: unknown): string => {
  const out: string[] = []
  out.push("lang = \"contract\"")
  out.push("empty_data_rule = " + JSON.stringify(contract.emptyDataRule))
  for (const e of contract.elements) {
    out.push("\n[[elements]]")
    out.push("id = " + JSON.stringify(e.id))
    out.push("component = " + JSON.stringify(e.component))
    if (e.data !== undefined) out.push("data = " + JSON.stringify(e.data))
    if (e.display === false) out.push("display = false")
    for (const i of e.interactive ?? []) {
      out.push("[[elements.interactive]]")
      out.push("on = " + JSON.stringify(i.on))
      out.push("action = " + JSON.stringify(i.action))
      if (i.args !== undefined) out.push("args = " + JSON.stringify(i.args))
    }
  }
  out.push("\n[data]")
  out.push(JSON.stringify(data ?? {}))
  return out.join("\n")
}

export const contractToCompact = (contract: RenderContract, data?: unknown): string => {
  const lines: string[] = []
  for (const e of contract.elements) {
    const value = show(objAt(data, e.data))
    const tag = mark(e)
    const desc = e.display === false ? "control" : "display"
    lines.push(
      `- ${e.component} "${e.id}" (${desc})` +
        (e.data !== undefined ? ` data=${e.data} value=${value}` : "") +
        (tag !== "" ? ` → ${tag}` : ""),
    )
  }
  const actionLine =
    contract.actions.length > 0 ? "actions: " + contract.actions.map((a) => a.name).join(", ") : "actions: none"
  lines.push(actionLine)
  lines.push(`empty-data rule: ${contract.emptyDataRule}`)
  return lines.join("\n")
}
