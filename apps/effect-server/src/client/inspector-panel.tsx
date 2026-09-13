/**
 * The tool inspector: the app's tools on one side, the selected one open beside
 * them.
 *
 * This is the surface an app that only registers MCP gets, so it is built to be
 * read like a debugging tool rather than a product page: every tool the app
 * published, what each one takes, and a place to call it and see the answer.
 * The list is the settings page's list, for the same reason — one selected row,
 * one panel, and a reader who already knows how to use one knows the other.
 */

import * as React from "react"
import { Button, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes"
import { InspectorDetail } from "./inspector-detail.tsx"
import type { InspectorPayload } from "./inspector-types.ts"

export const Inspector = ({ id, title, tools }: InspectorPayload) => {
  const [selected, setSelected] = React.useState(tools[0]?.name ?? "")
  const tool = tools.find((candidate) => candidate.name === selected)
  return <Flex direction="column" gap="5">
    <Flex direction="column" gap="1">
      <Heading size="6">{title}</Heading>
      <Text size="2" color="gray">
        {tools.length === 1 ? "1 tool" : `${tools.length} tools`} registered over MCP, with no interface of its own.
      </Text>
    </Flex>
    <Grid columns={{ initial: "1", md: "280px 1fr" }} gap="4" align="start">
      <Card>
        <Flex direction="column" gap="1">
          {tools.map((entry) => <Button key={entry.name} size="3" variant={entry.name === selected ? "soft" : "ghost"}
            color={entry.name === selected ? "jade" : "gray"} style={{ justifyContent: "flex-start" }}
            onClick={() => setSelected(entry.name)}>
            {entry.title ?? entry.name}
          </Button>)}
        </Flex>
      </Card>
      <Card size="3">
        {tool === undefined
          ? <Text size="2" color="gray">Select a tool to see what it takes.</Text>
          : <InspectorDetail key={tool.name} id={id} tool={tool} />}
      </Card>
    </Grid>
  </Flex>
}
