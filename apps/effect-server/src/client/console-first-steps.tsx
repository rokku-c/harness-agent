import * as React from "react"
import { Button, Callout, Flex, Text } from "@radix-ui/themes"
import { navigate } from "./console-nav.ts"

export const FirstSteps = ({ status, quiet }: {
  readonly status: string
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
