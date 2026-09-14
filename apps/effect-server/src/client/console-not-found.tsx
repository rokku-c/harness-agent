import * as React from "react"
import { Button, Flex, Heading, Text } from "@radix-ui/themes"
import { navigate } from "./console-nav.ts"
import { appRoute, type ConsoleEntry } from "./console-plan.ts"
import type { UnresolvedPart } from "./console-route.ts"

export interface NotFoundProps {
  readonly address: string
  readonly part: UnresolvedPart
  readonly text: string
  readonly app?: string
  readonly plan: readonly ConsoleEntry[]
  readonly screens?: readonly { readonly id: string; readonly title: string }[]
}

const sentence = (part: UnresolvedPart, text: string, app: string | undefined, known?: ConsoleEntry): string => {
  if (part === "place") return text === "" ? "This console has no place at this address." : `This console has no place called "${text}".`
  if (part === "app") {
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
      : <Flex gap="2" wrap="wrap">
          {entry.hasTools ? <Link label={`Operations of ${entry.title}`} route={{ kind: "tools", app: entry.id }} /> : null}
          {entry.hasConfig ? <Link label={`Configure ${entry.title}`} route={{ kind: "settings", app: entry.id }} /> : null}
        </Flex>}
    {entry === undefined && part === "app" ? <Flex gap="2" wrap="wrap">
      {nearest(plan, text).map((candidate) => <Link key={candidate.id} label={candidate.title} route={appRoute(candidate.id)} />)}
    </Flex> : null}

    <Flex gap="2"><Link label="Go to Home" route={{ kind: "home" }} /></Flex>
  </Flex>
}
