/**
 * The providers, and the one thing this console can ask of them.
 *
 * This is the screen's task, so it is the first thing under the figures, and the
 * probe is a press on the row it is about rather than a form elsewhere.
 *
 * The Status column is the design system's first-match rule written out: a
 * provider that cannot authenticate is the loud one, one the operator has taken
 * out of rotation is a fact, and one that is both enabled and credentialed is
 * `ok`, the jade word the tone table gives health. No row is left blank there,
 * because a blank status beside a provider reads as a status that failed to load
 * rather than as a provider that is fine.
 */
import type { UiCondition, UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, chip, failureCallout, text } from "@effect-agent/effect-ui"
import { caption, listRows, mono, monoBind, note } from "./effect-ui-nodes.ts"

const PROBE = "/health/result/health"

const badge = (value: string, color: string, visible: UiCondition, variant = "soft"): UiNodeSpec =>
  ({ component: "Badge", props: { variant, color, highContrast: true, value }, visible })

const provider: UiNodeSpec = cellOf([chip("id")])

/** A protocol is a kind — a distinguishing literal, which the tone table reads as `info` and never as health. */
const protocol: UiNodeSpec = cellOf([
  { component: "Badge", props: { variant: "soft", color: "blue", highContrast: true }, item: "apiType" },
])

/** An address: mono, because an operator copies it far more often than reads it. */
const upstream: UiNodeSpec = cellOf([mono("baseURL")])

const status: UiNodeSpec = cellOf([{
  component: "Flex", props: { direction: "column", gap: "1", align: "start" },
  children: [
    badge("No credential", "red", { source: { item: "credential" }, equals: "missing" }),
    // the rest of the rule: only a credentialed provider is disabled or healthy,
    // so both of those are stated inside this guard
    { component: "Flex", visible: { source: { item: "credential" }, equals: "missing", not: true },
      children: [
        badge("Disabled", "blue", { source: { item: "enabled" }, equals: false }),
        badge("Ready", "jade", { source: { item: "enabled" } }, "surface"),
      ] },
  ],
}])

/**
 * The press and its answer, on the row that caused it.
 *
 * The answer is one value in view state — the last probe, whichever row ran it —
 * so a row has to claim it, or the same answer would appear on every row and say
 * four providers replied when one did. The claim compares the row's own id with
 * the id the answer names, and it is written with the row on the left because
 * the language resolves a state path on either side of a comparison but an item
 * path only on the left: the plain "the answer names my id" never matches, and
 * the answer would then be invisible on every row.
 *
 * It keeps its place until the next press, which is why the table's line calls it a record, not a reading.
 */
const mine: UiCondition = { source: { item: "id" }, equals: { state: `${PROBE}/providerId` } }

/** The answer when it came back: the word in body text, the two readings in mono.
 *  `ok` is quiet on purpose — the design system keeps green off whole screens —
 *  and there is no glyph to add, since a view names only what the library
 *  exports and the console's icon set is not among those names. */
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
