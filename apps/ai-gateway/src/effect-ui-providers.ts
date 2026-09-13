/**
 * The providers the gateway proxies to, and the reachability probe.
 *
 * This is the page's primary task, so it sits directly under the figures: an
 * operator reads which upstreams exist and asks one of them to answer. The
 * answer stays in this card, where the press was, and nothing renders there
 * until a press has produced one.
 */
import { failureCallout, type UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, chip, emptyList, section, table, text } from "./effect-ui-nodes.ts"

/**
 * The state a provider is in. `credential` is the server's own word for it, so
 * the badge binds the field and takes the design system's default colour — it
 * is one of a set, and a set has no signal to colour. `enabled` is a boolean
 * and a bound badge would render it as no text at all, so it shows the one side
 * that is worth a signal: a disabled upstream is not in the rotation.
 */
const statusCell: UiNodeSpec = cellOf([
  { component: "Flex", props: { direction: "column", gap: "2", align: "start" }, children: [
    { component: "Badge", props: { variant: "soft", color: "red", value: "Disabled" }, visible: { source: { item: "enabled" }, equals: false } },
    { component: "Badge", props: { variant: "soft" }, item: "credential" },
  ] },
])

/** The row's own action. A row leads with what it is, not with an id. */
const providerCells: readonly UiNodeSpec[] = [
  cellOf([chip("id")]), cell("apiType"), cell("baseURL"), statusCell,
  cellOf([{ component: "Button", props: { value: "Test", size: "1", variant: "soft" },
    onPress: "gateway.testProvider", params: { providerId: { item: "id" } } }]),
]

/**
 * What the last probe said, in three parts: it answered, it did not answer, or
 * the request never got out. Each is guarded on the action's own result, so the
 * card ships no empty chip before the first press.
 */
const probeResult: readonly UiNodeSpec[] = [
  { component: "Callout.Root", props: { size: "1", variant: "soft", color: "green" },
    visible: { source: { state: "/health/result/health/reachable" }, equals: true },
    children: [{ component: "Callout.Text", children: [
      { component: "Code", bind: "/health/result/health/providerId" },
      text(" answered in "),
      { component: "Text", bind: "/health/result/health/durationMs" },
      text(" ms"),
    ] }] },
  { component: "Callout.Root", props: { size: "1", variant: "soft", color: "red" },
    visible: { source: { state: "/health/result/health/reachable" }, equals: false },
    children: [{ component: "Callout.Text", children: [
      { component: "Code", bind: "/health/result/health/providerId" },
      text(" could not be reached: "),
      { component: "Text", bind: "/health/result/health/error" },
    ] }] },
  failureCallout("/health/result/error"),
]

export const providersSection: UiNodeSpec = section("Providers", [
  text("Every upstream the gateway can proxy to. Test asks one to answer on the same egress the proxy uses.", { size: "2", color: "gray" }),
  emptyList("/models/providers", "No providers are configured."),
  table(["Provider", "API type", "Base URL", "Status", "Test"], providerCells, "/models/providers", "id"),
  ...probeResult,
])
