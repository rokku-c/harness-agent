/**
 * Tokenized projection — symbols + collapse to keep what an agent must read
 * short, while still carrying the same interaction/data rules.
 *
 *  - symbolization: long values repeated across the UI are defined once in a
 *    `symbols` legend and referenced as @s0 elsewhere (saves characters);
 *  - collapse: collapsible elements (rules.collapsibleIds) are shown as a
 *    single `[+]` marker when their data is large — expand on click
 *    (exclusive: expanding one collapses the others).
 */

import type { ContractElement, RenderContract } from "./contract.ts"
import { show, valueAt } from "./pointer.ts"

const COLLAPSE_MIN = 3

const renderElement = (e: ContractElement, data: unknown): string => {
  const value = valueAt(data, e.data)
  const kind = e.display === false ? "control" : "display"
  const interactive = (e.interactive ?? []).map((i) => `[${i.on}:${i.action}]`).join(" ")
  const base = `${e.component} "${e.id}" (${kind})` + (e.data !== undefined ? ` data=${e.data}` : "")

  if (e.collapsible === true && Array.isArray(value) && value.length > COLLAPSE_MIN) {
    return `${base} [+] collapsible (${value.length} items) → expand on click${interactive ? " " + interactive : ""}`
  }
  return `${base} value=${show(value)}` + (interactive !== "" ? ` ${interactive}` : "")
}

/** Intern long repeated values into symbols and shorten the text. */
const symbolize = (lines: string[]): string[] => {
  const text = lines.join("\n")
  const tokens = new Map<string, number>()
  const collect = (v: unknown): void => {
    if (typeof v === "string" && v.length > 5) tokens.set(v, (tokens.get(v) ?? 0) + 1)
  }
  lines.forEach((line) => {
    const open = line.indexOf("value=")
    if (open >= 0) {
      const raw = line.slice(open + 6)
      const match = raw.match(/^(".+")/)
      if (match !== null) {
        try {
          collect(JSON.parse(match[1]))
        } catch {
          /* ignore */
        }
      }
    }
  })
  const repeated = [...tokens.entries()].filter(([, n]) => n > 1).sort((a, b) => b[0].length - a[0].length)
  if (repeated.length === 0) return lines
  let out = text
  const legend: string[] = []
  repeated.forEach(([token], i) => {
    const symbol = `@s${i}`
    out = out.split(JSON.stringify(token)).join(symbol)
    legend.push(`${symbol} = ${JSON.stringify(token)}`)
  })
  return [out, "symbols:", ...legend]
}

export const contractToTokenized = (contract: RenderContract, data?: unknown): string => {
  const lines = contract.elements.map((e) => renderElement(e, data))
  lines.push("actions: " + (contract.actions.length ? contract.actions.map((a) => a.name).join(", ") : "none"))
  if (contract.rules.collapsibleIds.length > 0) {
    lines.push(
      `rules.collapse: [${contract.rules.collapsibleIds.join(", ")}] → exclusive=${contract.rules.exclusive} expandOn=${contract.rules.expandOn}`,
    )
  }
  lines.push("empty-data rule: " + contract.emptyDataRule)
  return symbolize(lines).join("\n")
}
