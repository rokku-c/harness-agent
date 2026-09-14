import type { UiCondition, UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip, failureCallout, text } from "@effect-agent/effect-ui"
import { caption, listRows, mono, monoBind, note } from "./effect-ui-nodes.ts"

const PROBE = "/health/result/health"

const badge = (value: string, color: string, visible: UiCondition, variant = "soft"): UiNodeSpec =>
  ({ component: "Badge", props: { variant, color, highContrast: true, value }, visible })

const provider: UiNodeSpec = cellOf([chip("id")])

const protocol: UiNodeSpec = cellOf([
  { component: "Badge", props: { variant: "soft", color: "blue", highContrast: true }, item: "apiType" },
])

const upstream: UiNodeSpec = cellOf([mono("baseURL")])

const status: UiNodeSpec = cellOf([{
  component: "Flex", props: { direction: "column", gap: "1", align: "start" },
  children: [
    badge("No credential", "red", { source: { item: "credential" }, equals: "missing" }),
    { component: "Flex", visible: { source: { item: "credential" }, equals: "missing", not: true },
      children: [
        badge("Disabled", "blue", { source: { item: "enabled" }, equals: false }),
        badge("Ready", "jade", { source: { item: "enabled" } }, "surface"),
      ] },
  ],
}])

const mine: UiCondition = { source: { item: "id" }, equals: { state: `${PROBE}/providerId` } }

const reach: UiNodeSpec = {
  component: "Flex", props: { gap: "1", align: "baseline" },
  visible: { source: { state: `${PROBE}/reachable` } },
  children: [
    text("Answered", { size: "1" }),
    monoBind(`${PROBE}/status`, { size: "1" }),
    text("in", { size: "1" }),
    monoBind(`${PROBE}/durationMs`, { size: "1" }),
    text("ms", { size: "1" }),
  ],
}

const unreachable: readonly UiNodeSpec[] = [
  badge("Did not answer", "red", { source: { state: `${PROBE}/reachable` }, not: true }),
  { component: "Text", props: { size: "1", color: "red", highContrast: true }, bind: `${PROBE}/error`,
    visible: { source: { state: `${PROBE}/error` } } },
]

const probe: UiNodeSpec = cellOf([{
  component: "Flex", props: { direction: "column", gap: "2", align: "start" },
  children: [
    { component: "Button", props: { value: "Test", size: "1", variant: "soft" },
      onPress: "gateway.testProvider", params: { providerId: { item: "id" } } },
    { component: "Flex", props: { direction: "column", gap: "1", align: "start" }, visible: mine,
      children: [reach, ...unreachable] },
  ],
}])

export const providersSection: readonly UiNodeSpec[] = [
  note("Every upstream this app proxies to. Test asks one to answer over the same egress the proxy itself uses."),
  ...listRows(["Provider", "Protocol", "Upstream", "Status", "Test"], [provider, protocol, upstream, status, probe],
    "/models/providers", "No provider is configured. Providers are declared in this app's configuration.", "id"),
  failureCallout("/health/result/error"),
  caption("An answer under Test is the record of the last press, not a live reading; it stays on that row until the next one."),
]
