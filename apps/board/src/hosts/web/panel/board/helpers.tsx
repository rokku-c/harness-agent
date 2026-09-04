/** panel/board/helpers.tsx - tiny view helpers + color mapping.
 *  Concept: state/priority/resource-kind/executor-state -> Mantine color,
 *  time/type label formatting, and the Dot + When micro components. Pure. */
import type { ReactNode } from "react"

export const stateColor = (s: string): string =>
  ({ todo: "gray", ready: "blue", doing: "indigo", blocked: "yellow", done: "green", failed: "red", cancelled: "gray" })[s] ?? "gray"
export const prioLevel = (p?: string): string => (p && p !== "normal" ? p : "")
export const prioColor = (p: string): string => ({ urgent: "red", high: "orange", low: "gray" })[p] ?? "gray"
export const resKindColor = (k: string): string => ({ workspace: "brand", slot: "teal", external: "violet" })[k] ?? "gray"
export const execColor = (s: string): string =>
  ({ online: "teal", active: "teal", idle: "gray", registered: "gray", busy: "blue", blocked: "yellow", unavailable: "gray" })[s] ?? "gray"
export const tsText = (ts: number): string => new Date(ts).toLocaleTimeString([], { hour12: false })
export const typeLabel = (t: string): string => t.replace(/\./g, " · ").replace(/^board · /, "")

export function Dot({ tone }: { tone: string }) {
  return <span className={"dot dot-" + tone} aria-hidden />
}
export function When({ c, children }: { c: boolean; children?: ReactNode }) {
  return c ? <>{children}</> : null
}
