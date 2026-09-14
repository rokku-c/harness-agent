/**
 * Settings: one row per configurable app, one editor beside it.
 *
 * The rows come from the catalogue's config contributions and nothing else — the
 * console holds no list of app ids — and the editor is the same component an app
 * shows at `#app/<id>/settings` (§2.H7). What is new here is the address: an app's
 * row is `#settings/<app>`, so a colleague can be sent the editor for the app that
 * is misbehaving, and the two spellings this screen used to answer
 * (`#settings/config/<id>` and `#config/<id>`) are gone, because one screen
 * answering two addresses means an operator cannot tell which link they were
 * handed (§1.4).
 */

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
  /**
   * Selecting an app is all this address does. An app id that is not configurable
   * is not a reason to refuse the address: H7 renders that sentence in place, with
   * the address kept, which is the one case the flows name explicitly.
   */
  claim: (address) => address.parts[0] === "settings"
    ? { kind: "settings", ...(address.parts[1] === undefined ? {} : { app: address.parts[1] }) }
    : undefined,
  view: (route, context) => <SettingsPlace app={route.kind === "settings" ? route.app : undefined} context={context} />,
}
