/**
 * A pasted address, offered as a destination (§6.4 rule 3).
 *
 * It appears when the query starts with `#` and is resolved the way any address
 * is — through the same resolver the shell uses, against the same plan and the
 * same places — so what the row promises and what the console then draws cannot
 * disagree. The palette is a navigator and a runner, never a shell: nothing here
 * fetches, nothing here interprets, and a pasted text that is not an address is
 * searched like any other text.
 *
 * An address that resolves to nothing is still offered, and it says so. A stale
 * link is a legitimate thing to paste — it is how a reader finds out whether a
 * link still works — and the console's answer to it is the Not found pane with
 * the address kept (`flows.md` §2.H13). Offering `Go to this address` is that
 * same answer, reached from the keyboard.
 *
 * The file is `.tsx` for one reason and it is not JSX: resolution lives with the
 * surfaces, in `console-places.tsx` (`console-route.ts` says itself that it
 * resolves nothing), and a plain `.ts` module may not reach into a `.tsx` one —
 * the TypeScript project would refuse it wherever JSX is not configured. The
 * alternative was a second resolver, and a second resolver is how a palette comes
 * to offer a destination the console does not answer.
 */

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
