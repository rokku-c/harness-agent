/**
 * The state a host is in before anything is registered (§2.H11).
 *
 * A host with services but no app that draws is not broken and not empty: it is
 * running, and it has an app index with nothing in it. So this names what it does
 * have — the status line's own words, never a second count derived beside it —
 * and then the three things a first operator needs, in the order the flows put
 * them.
 *
 * `Register an MCP server` is a line and not a link. The registry is an app, and
 * with an app index this empty there is no address to give it; the console holds
 * no table of app ids to look one up in, and inventing an id here would be
 * exactly the per-app knowledge `console-surface` §1 forbids.
 */

import * as React from "react"
import { Button, Callout, Flex, Text } from "@radix-ui/themes"
import { navigate } from "./console-nav.ts"

export const FirstSteps = ({ status, quiet }: {
  /** The chrome's status line, the host's own words for what it is running. */
  readonly status: string
  /** Nothing is registered at all, not merely nothing that draws. */
  readonly quiet: boolean
}) =>
  <Flex direction="column" gap="4" align="start">
    <Callout.Root color="amber"><Callout.Text>
      {quiet ? "No apps discovered. " : ""}No app has registered a screen of its own.
    </Callout.Text></Callout.Root>
    <Text size="2" color="gray">{status}</Text>
    <Flex direction="column" gap="2" align="start">
      <Text size="2" color="gray">1. Register an MCP server.</Text>
      <Button size="2" variant="soft" color="gray" onClick={() => navigate({ kind: "activity", filter: {} })}>2. Read the host record</Button>
      <Button size="2" variant="soft" color="gray" onClick={() => navigate({ kind: "settings" })}>3. Configure an app when one is registered</Button>
    </Flex>
  </Flex>
