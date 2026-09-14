/**
 * What the host already reports about itself, kept from the console this act
 * replaces (`console-surface` §7): the service table with each service's enabled
 * state and priority, the catalogued-app and operation counts, the failure list,
 * and the warning naming disabled services.
 *
 * It is kept because it is the only answer the console has to "is this host
 * healthy", and H9 puts it below the stream rather than in a place of its own:
 * reading the record and reading the host's health are one visit.
 */

import * as React from "react"
import { Card, Flex, Grid, Heading, Table, Text } from "@radix-ui/themes"
import type { ActivitySnapshot } from "./console-activity.ts"

type Row = readonly [string, string]

const CardTable = ({ title, empty, rows }: { readonly title: string; readonly empty: string; readonly rows: readonly Row[] }) =>
  <Card>
    <Flex direction="column" gap="3">
      <Heading size="3">{title}</Heading>
      {rows.length === 0 ? <Text size="2" color="gray">{empty}</Text>
        : <Table.Root variant="ghost" size="1"><Table.Body>
            {rows.map(([label, detail], index) => <Table.Row key={`${label}:${String(index)}`}>
              <Table.Cell><Text size="2">{label}</Text></Table.Cell>
              <Table.Cell><Text size="2" color="gray">{detail}</Text></Table.Cell>
            </Table.Row>)}
          </Table.Body></Table.Root>}
    </Flex>
  </Card>

export const ActivityReadOuts = ({ snapshot }: { readonly snapshot: ActivitySnapshot }) => {
  const enabled = snapshot.services.filter((service) => service.enabled).length
  const offline = snapshot.services.filter((service) => !service.enabled).map((service) => service.id)
  return <Flex direction="column" gap="4">
    <Grid columns={{ initial: "1", md: "2" }} gap="4" align="start">
      <CardTable title={`Services (${String(enabled)}/${String(snapshot.services.length)})`} empty="Nothing reported yet."
        rows={snapshot.services.map((service): Row => [service.id, service.enabled ? `enabled, priority ${String(service.priority)}` : "disabled"])} />
      <CardTable title="Apps" empty="Nothing reported yet." rows={[
        ["catalogued apps", String(snapshot.appCount)],
        ["app operations", String(snapshot.appOperations)],
        ["host operations", String(snapshot.privilegedOperations)],
      ]} />
      <CardTable title={`Failures (${String(snapshot.failures.length)})`} empty="No failures observed."
        rows={snapshot.failures.map((item): Row => [item.target, item.error ?? ""])} />
    </Grid>
    {offline.length === 0 ? null
      : <Text size="2" color="amber">{`${String(offline.length)} service(s) disabled: ${offline.join(", ")}`}</Text>}
  </Flex>
}
