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
  return <ConfigSurface key={id} id={id} api={surfaces.config.api} mountConfig={surfaces.config.mountConfig} />
}
