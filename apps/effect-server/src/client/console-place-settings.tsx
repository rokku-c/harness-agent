import * as React from "react"
import { Button, Callout, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes"
import { AppAvatar, markOf } from "./console-app-icon.tsx"
import { navigate } from "./console-nav.ts"
import { configApps } from "./console-plan.ts"
import { ConfigEditor } from "./console-config-editor.tsx"
import type { Place, PlaceContext } from "./console-place.ts"

const SettingsPlace = ({ app, context }: { readonly app?: string; readonly context: PlaceContext }) => {
  const apps = configApps(context.plan)
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
              {apps.map((entry) => <Button key={entry.id} size="3" variant={entry.id === app ? "soft" : "ghost"}
                color={entry.id === app ? "jade" : "gray"} style={{ justifyContent: "flex-start" }}
                onClick={() => navigate({ kind: "settings", app: entry.id })}>
                <AppAvatar mark={markOf(entry)} size="4" />{entry.title}
              </Button>)}
            </Flex>
          </Card>
          <Card size="3">
            {app === undefined
              ? <Text size="2" color="gray">Select an app to inspect and change its configuration.</Text>
              : <ConfigEditor id={app} plan={context.plan} surfaces={context.surfaces} />}
          </Card>
        </Grid>}
  </Flex>
}

export const SETTINGS: Place = {
  id: "settings",
  title: "Settings",
  route: { kind: "settings" },
  mark: "Gear",
  color: "gray",
  chrome: "page",
  kinds: ["settings"],
  claim: (address) => address.parts[0] === "settings"
    ? { kind: "settings", ...(address.parts[1] === undefined ? {} : { app: address.parts[1] }) }
    : undefined,
  view: (route, context) => <SettingsPlace app={route.kind === "settings" ? route.app : undefined} context={context} />,
}
