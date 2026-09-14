import * as React from "react"
import { Button, Callout, Card, Flex, Grid, Heading, Text } from "@radix-ui/themes"
import { navigate } from "./console-nav.ts"
import { Freshness } from "./console-freshness.tsx"
import { useSource, sourceValue } from "./console-source.ts"
import { loadInbox, type ActionItem, type Decision } from "./console-decision.ts"
import { ActionRow, ItemRow } from "./console-inbox-rows.tsx"
import { DecisionCard } from "./console-decision-card.tsx"
import { useRouteDetailFor } from "./console-live.ts"
import type { Place } from "./console-place.ts"

const InboxPlace = ({ decisionId }: { readonly decisionId?: string }) => {
  const inbox = useSource("inbox", loadInbox)
  const snapshot = sourceValue(inbox.state)
  const decisions: readonly Decision[] = snapshot?.decisions ?? []
  const actionItems: readonly ActionItem[] = snapshot?.actionItems ?? []
  const open = decisionId === undefined ? undefined : decisions.find((item) => item.id === decisionId)
  useRouteDetailFor("inbox", snapshot === undefined ? undefined : `${decisions.length + actionItems.length} waiting`)
  return <Flex direction="column" gap="5">
    <Flex direction="column" gap="1">
      <Heading size="6">Inbox</Heading>
      <Freshness state={inbox.state} onRetry={inbox.retry} />
    </Flex>
    {snapshot === undefined
      ? <Text size="2" color="gray">This queue cannot be read, so it cannot say whether anything is waiting.</Text>
      : decisions.length === 0 && actionItems.length === 0
        ? <Callout.Root color="gray">
            <Callout.Text>
              Nothing is waiting on you. <Button size="1" variant="ghost" onClick={() => navigate({ kind: "activity", filter: {} })}>Read the host record</Button>
            </Callout.Text>
          </Callout.Root>
        : <Grid columns={{ initial: "1", md: "320px 1fr" }} gap="4" align="start">
            <Card>
              <Flex direction="column" gap="1">
                {decisions.map((item) => <ItemRow key={item.id} label={item.subject} detail={`${item.class} · ${item.raisedBy}`}
                  active={item.id === decisionId} open={() => navigate({ kind: "inbox", decisionId: item.id })} />)}
                {actionItems.length === 0 ? null : <Text size="1" color="gray" mt="3">Action items</Text>}
                {actionItems.map((item) => <ActionRow key={item.id} item={item} />)}
              </Flex>
            </Card>
            <Card size="3">
              {decisionId === undefined
                ? <Text size="2" color="gray">Select a decision to read what it is holding up.</Text>
                : open === undefined
                  ? <Text size="2" color="gray">{`No decision "${decisionId}" is waiting.`}</Text>
                  : <DecisionCard decision={open} />}
            </Card>
          </Grid>}
  </Flex>
}

export const INBOX: Place = {
  id: "inbox",
  title: "Inbox",
  route: { kind: "inbox" },
  mark: "Tray",
  color: "violet",
  chrome: "page",
  kinds: ["inbox"],
  claim: (address) => address.parts[0] === "inbox"
    ? { kind: "inbox", ...(address.parts[1] === undefined ? {} : { decisionId: address.parts[1] }) }
    : undefined,
  view: (route) => <InboxPlace decisionId={route.kind === "inbox" ? route.decisionId : undefined} />,
}
