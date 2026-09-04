/** board/rules.ts - PURE WORKFLOW RULES.
 *  Concept: priority coercion (anything unknown is normal) and dependency
 *  readiness (all deps exist and are done) - no Effect, unit-testable. */
import type { WorkItem } from "../domain.ts"

export const PRIORITY_OF = (value: string): "low" | "normal" | "high" | "urgent" =>
  value === "low" || value === "urgent" || value === "high" ? value : "normal"

export const dependenciesDone = (item: WorkItem, items: ReadonlyMap<string, WorkItem>): { ok: boolean; missing: string[] } => {
  const missing: string[] = []
  for (const dep of item.dependencies) {
    const depItem = items.get(dep)
    if (depItem === undefined || depItem.state !== "done") missing.push(dep)
  }
  return { ok: missing.length === 0, missing }
}

/** stable item id: slugified title + random salt */
export const newItemId = (title: string): string =>
  title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) + "-" + Math.random().toString(36).slice(2, 10)
