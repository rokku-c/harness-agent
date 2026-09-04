/** small shared bits for panel views */
import type { RefObject } from "react"
import type { TimelineItem } from "./store.ts"

export const fmtTime = (ts: number): string => {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return hh + ":" + mm + ":" + ss
}

export const shortId = (id: string): string => (id.length > 22 ? id.slice(0, 10) + "…" + id.slice(-6) : id)

export interface TimelineProps {
  readonly items: ReadonlyArray<TimelineItem>
  readonly endRef: RefObject<HTMLDivElement | null>
}
import { useEffect, useState, type JSX } from "react"

/** narrow/touch layout? true when the viewport is phone-ish (<=700px CSS px).
 *  Used by views to switch column stacks to touch-friendly single columns. */
export const useCompactViewport = (): boolean => {
  const query = "(max-width: 700px)"
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setCompact(e.matches)
    mql.addEventListener("change", onChange)
    setCompact(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [query])
  return compact
}
