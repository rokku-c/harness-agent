import { hashOf } from "./console-nav.ts"
import { parseConsoleHash } from "./console-places.tsx"
import { titleOf } from "./console-titles.ts"
import type { CommandRow } from "./console-commands.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { Place } from "./console-place.ts"

export const addressRow = (
  query: string,
  plan: readonly ConsoleEntry[],
  places: readonly Place[],
): CommandRow | undefined => {
  const text = query.trim()
  if (!text.startsWith("#")) return undefined
  const route = parseConsoleHash(text, plan)
  const known = route.kind !== "not-found"
  return {
    id: "address",
    label: known ? `Go to ${titleOf(route, plan, places)}` : "Go to this address",
    caption: known ? "Address" : "Not found",
    glyph: "ArrowSquareOut",
    address: hashOf(route),
    action: { kind: "go", route },
  }
}
