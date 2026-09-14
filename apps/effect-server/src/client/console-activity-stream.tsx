import * as React from "react"
import { Table, Text } from "@radix-ui/themes"
import { actorOf } from "./console-activity-filter.ts"
import type { ActivityObservation } from "./console-activity.ts"

const Time = ({ at }: { readonly at: number }) =>
  <Text size="1" color="gray" style={{ fontVariantNumeric: "tabular-nums" }}>{new Date(at).toLocaleTimeString()}</Text>

export const ActivityStream = ({ observations, empty = "Nothing reported yet." }: {
  readonly observations: readonly ActivityObservation[]
  readonly empty?: string
}) =>
  observations.length === 0
    ? <Text size="2" color="gray">{empty}</Text>
    : <Table.Root variant="ghost" size="1">
        <Table.Header><Table.Row>
          <Table.Cell><Text size="1" color="gray">Actor</Text></Table.Cell>
          <Table.Cell><Text size="1" color="gray">App</Text></Table.Cell>
          <Table.Cell><Text size="1" color="gray">Outcome</Text></Table.Cell>
          <Table.Cell><Text size="1" color="gray">When</Text></Table.Cell>
        </Table.Row></Table.Header>
        <Table.Body>
          {observations.map((observation, index) => <Table.Row key={`${String(observation.at)}:${observation.target}:${String(index)}`}>
            <Table.Cell><Text size="2">{actorOf(observation)}</Text></Table.Cell>
            <Table.Cell><Text size="2">{observation.target}</Text></Table.Cell>
            <Table.Cell><Text size="1" color={observation.error === undefined ? "gray" : "red"}>{observation.error ?? "ok"}</Text></Table.Cell>
            <Table.Cell><Time at={observation.at} /></Table.Cell>
          </Table.Row>)}
        </Table.Body>
      </Table.Root>
