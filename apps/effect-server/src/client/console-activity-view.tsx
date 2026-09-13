import * as React from "react"
import { Callout, Card, Flex, Grid, Heading, Spinner, Table, Text } from "@radix-ui/themes"
import { fetchActivity, loadActivity, type ActivitySnapshot } from "./console-activity.ts"

type Row = readonly [string, string]
type State = { readonly status: "loading" } | { readonly status: "ready"; readonly snapshot: ActivitySnapshot } | { readonly status: "error"; readonly message: string }

const ActivityCard = ({ title, empty, rows }: { readonly title: string; readonly empty: string; readonly rows: readonly Row[] }) =>
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

const Snapshot = ({ snapshot }: { readonly snapshot: ActivitySnapshot }) => {
  const enabled = snapshot.services.filter((service) => service.enabled).length
  const offline = snapshot.services.filter((service) => !service.enabled).map((service) => service.id)
  return <Flex direction="column" gap="4">
    <Grid columns={{ initial: "1", md: "2" }} gap="4" align="start">
      <ActivityCard title={`Services (${String(enabled)}/${String(snapshot.services.length)})`} empty="Nothing reported yet."
        rows={snapshot.services.map((service): Row => [service.id, service.enabled ? `enabled — priority ${String(service.priority)}` : "disabled"])} />
      <ActivityCard title="Apps" empty="Nothing reported yet." rows={[
        ["catalogued apps", String(snapshot.appCount)],
        ["app operations", String(snapshot.appOperations)],
        ["host operations", String(snapshot.privilegedOperations)],
      ]} />
      <ActivityCard title="Recent activity" empty="Nothing reported yet."
        rows={snapshot.observations.slice(-20).reverse().map((item): Row => [item.target || item.perspective, new Date(item.at).toLocaleTimeString()])} />
      <ActivityCard title={`Failures (${String(snapshot.failures.length)})`} empty="No failures observed."
        rows={snapshot.failures.map((item): Row => [item.target, item.error ?? ""])} />
    </Grid>
    {offline.length === 0 ? null
      : <Text size="2" color="amber">{`${String(offline.length)} service(s) disabled: ${offline.join(", ")}`}</Text>}
  </Flex>
}

/** What the host already reports about itself, drawn as it is reported. */
export const ConsoleActivity = () => {
  const [state, setState] = React.useState<State>({ status: "loading" })
  React.useEffect(() => {
    let live = true
    void loadActivity(fetchActivity).then(
      (snapshot) => { if (live) setState({ status: "ready", snapshot }) },
      (cause: Error) => { if (live) setState({ status: "error", message: cause.message }) },
    )
    return () => { live = false }
  }, [])
  return <Flex direction="column" gap="5">
    <Flex direction="column" gap="1">
      <Heading size="6">Activity</Heading>
      <Text size="2" color="gray">What the host reports about itself, drawn as it is reported.</Text>
    </Flex>
    {state.status === "loading" ? <Spinner size="3" /> : null}
    {state.status === "error" ? <Callout.Root color="red"><Callout.Text>{state.message}</Callout.Text></Callout.Root> : null}
    {state.status === "ready" ? <Snapshot snapshot={state.snapshot} /> : null}
  </Flex>
}
