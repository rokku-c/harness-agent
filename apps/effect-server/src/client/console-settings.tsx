import * as React from "react"
import { Button, Callout, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes"
import { AppAvatar } from "./console-app-icon.tsx"
import { ConfigSurface } from "./config-surface.tsx"
import { navigate } from "./console-nav.ts"
import type { ConsoleSurfaces } from "./console-surfaces.ts"
import type { ConsoleEntry } from "./console-plan.ts"

/** Settings is the config surface: one row per configurable app, one editor beside it. */
export const ConsoleSettings = ({ plan, selected, config }: {
  readonly plan: readonly ConsoleEntry[]
  readonly selected: string | undefined
  readonly config: ConsoleSurfaces["config"]
}) => {
  const apps = plan.filter((entry) => entry.hasConfig)
  return <Flex direction="column" gap="5">
    <Flex direction="column" gap="1">
      <Heading size="6">Settings</Heading>
      <Text size="2" color="gray">One row per configurable app, with its editor beside it.</Text>
    </Flex>
    {apps.length === 0
      ? <Callout.Root color="amber"><Callout.Text>No configurable apps.</Callout.Text></Callout.Root>
      : <Grid columns={{ initial: "1", md: "280px 1fr" }} gap="4" align="start">
          <Card>
            <Flex direction="column" gap="1">
              {apps.map((entry) => <Button key={entry.id} size="3" variant={entry.id === selected ? "soft" : "ghost"}
                color={entry.id === selected ? "jade" : "gray"} style={{ justifyContent: "flex-start" }}
                onClick={() => navigate({ kind: "settings-config", id: entry.id })}>
                <AppAvatar entry={entry} size="4" />{entry.title}
              </Button>)}
            </Flex>
          </Card>
          <Card size="3">
            {selected === undefined
              ? <Text size="2" color="gray">Select an app to inspect and change its configuration.</Text>
              : <ConfigSurface key={selected} id={selected} api={config.api} mountConfig={config.mountConfig} />}
          </Card>
        </Grid>}
  </Flex>
}
