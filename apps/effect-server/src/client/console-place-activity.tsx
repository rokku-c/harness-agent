/**
 * Activity: the host's own record.
 *
 * The filters are address parameters (§2.H9), so a filtered record is a link a
 * colleague can be handed — which is the point of the place having an address at
 * all, and the reason the controls here navigate rather than keeping state: two
 * copies of "which filter is on" is one copy that is wrong after a paste.
 *
 * What a filter is applied to, and the one it cannot be, is
 * `console-activity-filter.ts`'s question; what this file does with the answer is
 * say so in one line rather than draw a control that quietly does nothing.
 */

import * as React from "react"
import { Button, Card, Flex, Heading, Select, Text } from "@radix-ui/themes"
import { navigate } from "./console-nav.ts"
import { Freshness } from "./console-freshness.tsx"
import { useSource, sourceValue } from "./console-source.ts"
import { loadActivity, fetchActivity, type ActivitySnapshot } from "./console-activity.ts"
import { ACTORS, applyFilter, unhonouredKind } from "./console-activity-filter.ts"
import { ActivityStream } from "./console-activity-stream.tsx"
import { ActivityReadOuts } from "./console-activity-readouts.tsx"
import { filtersOf, type ActivityFilter } from "./console-route.ts"
import type { Place, PlaceContext } from "./console-place.ts"

/** One read for the whole place: the host's health and its record come from the same snapshot. */
export const loadHostRecord = (): Promise<ActivitySnapshot> => loadActivity(fetchActivity)

const Option = ({ value, label }: { readonly value: string; readonly label: string }) =>
  <Select.Item value={value}>{label}</Select.Item>

const FilterBar = ({ filter, plan }: { readonly filter: ActivityFilter; readonly plan: PlaceContext["plan"] }) => {
  const set = (next: typeof filter): void => { navigate({ kind: "activity", filter: next }) }
  const carried = unhonouredKind(filter)
  return <Flex direction="column" gap="2">
    <Flex align="center" gap="3" wrap="wrap">
      <Text size="2" color="gray">Actor</Text>
      {/* `data-filter` is §6.3's `/`: the one control on a surface that the key focuses. It is a
          marker on the element rather than a ref the chrome has to be told about, because the
          chrome draws no part of this bar and cannot reach into it. */}
      <Select.Root value={filter.actor ?? "all"} onValueChange={(value) => set({ ...filter, actor: value })}>
        <Select.Trigger aria-label="Actor" data-filter="" /><Select.Content>
          {ACTORS.map((actor) => <Option key={actor} value={actor} label={actor === "all" ? "All actors" : actor} />)}
        </Select.Content>
      </Select.Root>
      <Text size="2" color="gray">App</Text>
      <Select.Root value={filter.app ?? "all"} onValueChange={(value) => set({ ...filter, app: value })}>
        <Select.Trigger aria-label="App" /><Select.Content>
          <Option value="all" label="All apps" />
          {plan.map((entry) => <Option key={entry.id} value={entry.id} label={entry.title} />)}
        </Select.Content>
      </Select.Root>
      {filter.actor === undefined && filter.app === undefined && filter.kind === undefined && filter.since === undefined ? null
        : <Button size="1" variant="soft" color="gray" onClick={() => set({})}>Clear filters</Button>}
    </Flex>
    {/* H9 asks for a `kind` filter and the record carries no kind: §9.4 is what will put one on
        every record, so the address keeps the filter and this says it is not applied rather than
        guessing a vocabulary the mechanism is about to define. */}
    {carried === undefined ? null
      : <Text size="1" color="amber">{`The host record carries no kind yet, so "${carried}" is kept in the address and not applied.`}</Text>}
  </Flex>
}

const ActivityPlace = ({ filter, context }: { readonly filter: ActivityFilter; readonly context: PlaceContext }) => {
  const record = useSource("activity", loadHostRecord)
  const snapshot = sourceValue(record.state)
  const filtered = filter.actor !== undefined || filter.app !== undefined || filter.kind !== undefined || filter.since !== undefined
  return <Flex direction="column" gap="5">
    <Flex direction="column" gap="1">
      <Heading size="6">Activity</Heading>
      <Text size="2" color="gray">What the host reports about itself, drawn as it is reported.</Text>
      <Freshness state={record.state} onRetry={record.retry} />
    </Flex>
    <FilterBar filter={filter} plan={context.plan} />
    {snapshot === undefined ? null
      : <Flex direction="column" gap="4">
          <Card>
            <ActivityStream observations={applyFilter(snapshot.observations.slice(-20).reverse(), filter)}
              empty={filtered ? "No row matches this filter." : "Nothing reported yet."} />
          </Card>
          <ActivityReadOuts snapshot={snapshot} />
        </Flex>}
  </Flex>
}

export const ACTIVITY: Place = {
  id: "activity",
  title: "Activity",
  route: { kind: "activity", filter: {} },
  mark: "ListBullets",
  color: "orange",
  chrome: "page",
  kinds: ["activity"],
  claim: (address) => address.parts[0] === "activity" ? { kind: "activity", filter: filtersOf(address.query) } : undefined,
  view: (route, context) => <ActivityPlace filter={route.kind === "activity" ? route.filter : {}} context={context} />,
}
