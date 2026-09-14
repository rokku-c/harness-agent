/**
 * An address that resolves to nothing, at that address.
 *
 * Today there is no not-found screen: an address naming nothing is silently
 * resolved to Home or Settings and the bar is rewritten with `replaceState`, so a
 * broken deep link looks like a working one and nobody can tell which link they
 * were handed (`console-surface` §6, `Absent`). This pane is the fix —
 * `flows.md` §2.H13 — and the two lines that keep it a fix are that nothing here
 * ever writes the address, and that it reports which of the three parts failed,
 * in the order the address is read: the place, then the app, then the screen.
 *
 * What it can offer near the failure is exactly what the catalogue holds: an
 * app's own screens when the app resolved and the screen did not, the app's real
 * addresses when the app resolved and has no start screen at all, and the ids
 * nearest to what was typed when no app answered to it.
 */

import * as React from "react"
import { Button, Flex, Heading, Text } from "@radix-ui/themes"
import { navigate } from "./console-nav.ts"
import { appRoute, type ConsoleEntry } from "./console-plan.ts"
import type { UnresolvedPart } from "./console-route.ts"

export interface NotFoundProps {
  /** The address as it was written. Reported here because the bar keeps it and nothing rewrites it. */
  readonly address: string
  readonly part: UnresolvedPart
  readonly text: string
  /** The app the screen was looked for in, when the app itself resolved. */
  readonly app?: string
  readonly plan: readonly ConsoleEntry[]
  /** The app's actual screens, when the app resolved and the screen did not. */
  readonly screens?: readonly { readonly id: string; readonly title: string }[]
}

const sentence = (part: UnresolvedPart, text: string, app: string | undefined, known?: ConsoleEntry): string => {
  if (part === "place") return text === "" ? "This console has no place at this address." : `This console has no place called "${text}".`
  if (part === "app") {
    // Two different failures arrive as "the app part" and they need different sentences: the app is
    // gone, or the app is here and declares no view. The plan is what tells them apart, and only
    // when it read something — an empty plan is a failed catalogue, not a host with no apps.
    if (known !== undefined) return `"${known.title}" declares no screen of its own.`
    return text === "" ? "This address names no app." : `No app is registered as "${text}".`
  }
  return `"${app ?? ""}" has no screen called "${text}".`
}

const shared = (a: string, b: string): number => {
  let count = 0
  while (count < a.length && count < b.length && a[count] === b[count]) count += 1
  return count
}

/** The nearest ids without an edit-distance library: the ones that start the way the typed one did. */
const nearest = (plan: readonly ConsoleEntry[], text: string): readonly ConsoleEntry[] =>
  plan.filter((entry) => shared(entry.id, text) > 0)
    .sort((left, right) => shared(right.id, text) - shared(left.id, text) || left.id.localeCompare(right.id))
    .slice(0, 3)

const Link = ({ label, route }: { readonly label: string; readonly route: Parameters<typeof navigate>[0] }) =>
  <Button size="1" variant="soft" color="gray" onClick={() => navigate(route)}>{label}</Button>

export const NotFound = ({ address, part, text, app, plan, screens }: NotFoundProps) => {
  const entry = part === "app" ? plan.find((item) => item.id === text) : undefined
  return <Flex direction="column" gap="5">
    <Flex direction="column" gap="1">
      <Heading size="6">Not found</Heading>
      <Text size="2" color="gray">{sentence(part, text, app, entry)}</Text>
      <Text size="1" color="gray">{address}</Text>
    </Flex>
    {screens === undefined || screens.length === 0 ? null
      : <Flex gap="2" wrap="wrap">
          {screens.map((screen) => <Link key={screen.id} label={screen.title} route={{ kind: "app", id: app ?? "", screen: screen.id }} />)}
        </Flex>}
    {entry === undefined ? null
      // The app resolved and draws nothing: an app with operations or configuration is reached
      // at the address for that surface, never at the view address it does not have (§1.6).
      : <Flex gap="2" wrap="wrap">
          {entry.hasTools ? <Link label={`Operations of ${entry.title}`} route={{ kind: "tools", app: entry.id }} /> : null}
          {entry.hasConfig ? <Link label={`Configure ${entry.title}`} route={{ kind: "settings", app: entry.id }} /> : null}
        </Flex>}
    {entry === undefined && part === "app" ? <Flex gap="2" wrap="wrap">
      {nearest(plan, text).map((candidate) => <Link key={candidate.id} label={candidate.title} route={appRoute(candidate.id)} />)}
    </Flex> : null}
    {/* `Search for "<text>"` is H13's secondary action, and it opens the palette: that is the command
        registry's mechanism (§9.11) and arrives with it. A control that cannot act is worse than none. */}
    <Flex gap="2"><Link label="Go to Home" route={{ kind: "home" }} /></Flex>
  </Flex>
}
