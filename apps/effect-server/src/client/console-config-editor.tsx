/**
 * One app's configuration, at both of the addresses that show it.
 *
 * `flows.md` §1.4 gives configuration two addresses and one editor: `#settings/<app>`
 * is the place, with the app's row selected, and `#app/<id>/settings` is the same
 * editor reached without leaving the app (§2.H7). One editor rendering both is the
 * point — two would drift, and an operator who learned one would have to learn the
 * other.
 *
 * An app that declares no configuration gets §2.H7's sentence in place, keeping
 * the address, instead of the old silent fall back to plain Settings: a link that
 * names an app and lands somewhere that does not name it is a link the reader
 * cannot trust.
 */

import * as React from "react"
import { Button, Flex, Text } from "@radix-ui/themes"
import { navigate } from "./console-nav.ts"
import { ConfigSurface } from "./config-surface.tsx"
import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleSurfaces } from "./console-surfaces.ts"

export const ConfigEditor = ({ id, plan, surfaces }: {
  readonly id: string
  readonly plan: readonly ConsoleEntry[]
  readonly surfaces: ConsoleSurfaces
}) => {
  if (!plan.some((entry) => entry.id === id && entry.hasConfig)) {
    return <Flex direction="column" gap="3" align="start">
      <Text size="2" color="gray">{`"${id}" declares no configuration.`}</Text>
      <Button size="1" variant="soft" color="gray" onClick={() => navigate({ kind: "settings" })}>All configuration</Button>
    </Flex>
  }
  // Keyed by the app: a different app's editor is a different form, and reusing the
  // node would leave the previous app's values in fields the schema no longer has.
  return <ConfigSurface key={id} id={id} api={surfaces.config.api} mountConfig={surfaces.config.mountConfig} />
}
