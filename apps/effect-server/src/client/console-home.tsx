import * as React from "react"
import { Callout, Flex, Grid, Heading, Text } from "@radix-ui/themes"
import { AppTile } from "./console-app-icon.tsx"
import { navigate } from "./console-nav.ts"
import { appRoute, type ConsoleEntry } from "./console-plan.ts"

/** The springboard. Every app that owns a surface, as the app draws itself. */
export const ConsoleHome = ({ plan }: { readonly plan: readonly ConsoleEntry[] }) => {
  const apps = plan.filter((entry) => entry.hasView)
  return <Flex direction="column" gap="5">
    <Flex direction="column" gap="1">
      <Heading size="6">Apps</Heading>
    </Flex>
    {apps.length === 0
      ? <Callout.Root color="amber"><Callout.Text>No apps discovered.</Callout.Text></Callout.Root>
      : <Grid columns={{ initial: "2", sm: "4", md: "6" }} gap="3">
          {apps.map((entry) => <AppTile key={entry.id} entry={entry} onSelect={() => navigate(appRoute(entry.id, entry.hasView))} />)}
        </Grid>}
  </Flex>
}
