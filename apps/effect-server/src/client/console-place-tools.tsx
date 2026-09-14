import * as React from "react"
import { Button, Callout, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes"
import { navigate } from "./console-nav.ts"
import { unresolved } from "./console-route.ts"
import { Freshness } from "./console-freshness.tsx"
import { sourceValue, useSource } from "./console-source.ts"
import { loadTools, operationOf } from "./console-tools-read.ts"
import { InspectorDetail } from "./inspector-detail.tsx"
import type { Place } from "./console-place.ts"

const Row = ({ label, detail, active, open }: {
  readonly label: string
  readonly detail?: string
  readonly active: boolean
  readonly open: () => void
}) =>
  <Button size={detail === undefined ? "2" : "3"} variant={active ? "soft" : "ghost"} color={active ? "jade" : "gray"}
    style={{ justifyContent: "flex-start", marginLeft: detail === undefined ? "var(--space-3)" : undefined }} onClick={open}>
    {label}{detail === undefined ? null : ` · ${detail}`}
  </Button>

const ToolsPlace = ({ app, operation }: { readonly app?: string; readonly operation?: string }) => {
  const tools = useSource("tools", loadTools)
  const catalogue = sourceValue(tools.state)
  const apps = catalogue?.apps ?? []
  const scoped = apps.find((entry) => entry.id === app)
  const tool = scoped === undefined ? undefined : operationOf(scoped, operation)
  return <Flex direction="column" gap="5">
    <Flex direction="column" gap="1">
      <Heading size="6">Tools</Heading>
      <Freshness state={tools.state} onRetry={tools.retry} />
    </Flex>
    {catalogue === undefined ? null
      : apps.length === 0
        ? <Callout.Root color="gray">
            <Callout.Text>
              No app has registered an operation.{" "}
              <Button size="1" variant="ghost" onClick={() => navigate({ kind: "activity", filter: {} })}>See which services are active</Button>
            </Callout.Text>
          </Callout.Root>
        : <Grid columns={{ initial: "1", md: "320px 1fr" }} gap="4" align="start">
            <Card>
              <Flex direction="column" gap="1">
                {apps.map((entry) => <Row key={entry.id} label={entry.title} detail={`${entry.tools.length}`}
                  active={entry.id === app} open={() => navigate({ kind: "tools", app: entry.id })} />)}
                {scoped === undefined ? null
                  : scoped.tools.map((entry) => <Row key={entry.name} label={entry.title ?? entry.name} active={entry.name === operation}
                      open={() => navigate({ kind: "tools", app: scoped.id, operation: entry.name })} />)}
              </Flex>
            </Card>
            <Card size="3">
              {scoped === undefined
                ? <Text size="2" color="gray">Select a tool to see what it takes.</Text>
                : tool === undefined
                  ? <Text size="2" color="gray">{`"${scoped.title}" has no operation called "${operation ?? ""}".`}</Text>
                  : <InspectorDetail key={tool.name} id={scoped.id} tool={tool} />}
            </Card>
          </Grid>}
  </Flex>
}

export const TOOLS: Place = {
  id: "tools",
  title: "Tools",
  route: { kind: "tools" },
  mark: "Wrench",
  color: "cyan",
  chrome: "page",
  kinds: ["tools"],
  claim: (address, plan) => {
    if (address.parts[0] !== "tools") return undefined
    const app = address.parts[1]
    if (app === undefined) return { kind: "tools" }
    if (plan.length > 0 && plan.find((entry) => entry.id === app)?.hasTools !== true) return unresolved(address, "app", app)
    const operation = address.parts[2]
    return { kind: "tools", app, ...(operation === undefined ? {} : { operation }) }
  },
  view: (route) => <ToolsPlace app={route.kind === "tools" ? route.app : undefined} operation={route.kind === "tools" ? route.operation : undefined} />,
}
