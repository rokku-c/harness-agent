/**
 * The AI Gateway console: the model plane an operator runs.
 *
 * The first screen answers the three questions the standard asks, in the order
 * it asks them. What this is, then the figures that say how much it is carrying,
 * then the providers — the thing the console exists for, since every row is one
 * the operator can ask to answer. The rules and the endpoints behind them are
 * destinations rather than sections: a list an operator only reads is somewhere
 * they go, and on a phone a section is somewhere they scroll to. The header
 * carries the doors, because a view that names its own screens is offered no
 * menu and its first screen has to state where it leads.
 *
 * Every screen that draws this source's lists states the read's own loading and
 * failure above them, because a screen is a surface and a failure noticed only
 * on another one is a failure the operator meets as a bare table. The read is
 * one, so a screen holding one of its lists says it once.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { region } from "@effect-agent/effect-ui"
import { gatewayHeader } from "./effect-ui-header.ts"
import { MODEL_SOURCE, row, signal, sourceVerdict } from "./effect-ui-nodes.ts"
import { usageNodes, activitySection } from "./effect-ui-usage.ts"
import { providersSection } from "./effect-ui-providers.ts"
import { rulesSection, endpointsSection } from "./effect-ui-routing.ts"

export const effectUiView: EffectUiView = {
  viewId: "ai-gateway-console",
  title: "AI Gateway",
  state: {
    models: { providers: [], rules: [], endpoints: [], captureBodies: false, usage: { requests: 0, responses: 0, errors: 0, averageDurationMs: null, recent: [] } },
    health: { result: undefined },
  },
  sources: [{ id: MODEL_SOURCE, url: "/models", state: "/models", refreshMs: 10000 }],
  actions: [
    { name: "gateway.testProvider", method: "POST", url: "/models/providers/{providerId}/test", result: "/health/result" },
    // nothing to read on the way in: each screen's content is the read this
    // console already keeps, and the one list that is not on the first screen is
    // complete the moment it is entered
    { name: "gateway.activity", opens: "activity" },
    { name: "gateway.rules", opens: "rules" },
    { name: "gateway.endpoints", opens: "endpoints" },
  ],
  nodes: [
    gatewayHeader,
    // the one source's own read, before everything it feeds: every list reads the
    // same answer, so a failed read is one fact about one read
    ...sourceVerdict,
    // A page-wide fact rather than a row's state: it says what the gateway is
    // keeping, and it is worth the ink only while it is on.
    row([signal("Request bodies are recorded", "/models/captureBodies", "amber")]),
    // The figures are the first screen's headline and belong to every exchange the
    // lists are made of, so they stay above the fold and the providers move under
    // them — in the region, whose box scrolls, so the header's doors stay put.
    ...usageNodes,
    region([providersSection]),
  ],
  screens: [
    { id: "activity", title: "Recent activity", nodes: [...sourceVerdict, activitySection] },
    { id: "rules", title: "Routing rules", nodes: [...sourceVerdict, rulesSection] },
    { id: "endpoints", title: "Upstream endpoints", nodes: [...sourceVerdict, endpointsSection] },
  ],
}
