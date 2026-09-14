/**
 * The AI Gateway console: the model plane an operator runs.
 *
 * The first screen answers the standard's three questions in their order. What
 * this is, then what it has carried, then the providers — the screen's own task,
 * since every row is one the operator can ask to answer. The three read-only
 * lists are doors in the header rather than sections under the table: a list an
 * operator only reads is somewhere they go, and a door that scrolls away with
 * the region is a door an operator finds again on every screen.
 *
 * Every screen states the one read's loading and failure above its lists. The
 * read is one and it feeds every list, so a failure is one fact about one read;
 * stating it per list would put four identical callouts on a screen for it. The
 * screens behind the doors state it too, because a screen is a surface and a
 * failure met only on another one is met as a bare table.
 *
 * The header carries the posture line, and it is not a caveat for its own sake:
 * this app declares three reads and a probe, so the console cannot change the
 * plane it presents, and a surface that looks controllable and is not is the
 * defect the line exists to prevent.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { region } from "@effect-agent/effect-ui"
import { exchangesSection } from "./effect-ui-exchanges.ts"
import { usageFigures } from "./effect-ui-figures.ts"
import { gatewayHeader } from "./effect-ui-header.ts"
import { MODEL_SOURCE, readState } from "./effect-ui-nodes.ts"
import { providersSection } from "./effect-ui-providers.ts"
import { endpointsSection, rulesSection } from "./effect-ui-routing.ts"

export const effectUiView: EffectUiView = {
  viewId: "ai-gateway-console",
  title: "AI Gateway",
  state: {
    models: {
      providers: [], rules: [], endpoints: [], captureBodies: false,
      usage: { requests: 0, responses: 0, errors: 0, averageDurationMs: null, recent: [] },
    },
    // where the probe's answer lands; empty until the first Test
    health: { result: undefined },
  },
  sources: [{ id: MODEL_SOURCE, url: "/models", state: "/models", refreshMs: 10000 }],
  actions: [
    { name: "gateway.testProvider", method: "POST", url: "/models/providers/{providerId}/test", result: "/health/result" },
    // the three doors carry nothing on the way in: every list they show is part
    // of the read this console already keeps, so the screen is complete when it
    // is entered and none of them makes a call
    { name: "gateway.exchanges", opens: "exchanges" },
    { name: "gateway.rules", opens: "rules" },
    { name: "gateway.endpoints", opens: "endpoints" },
  ],
  nodes: [gatewayHeader, ...readState, ...usageFigures, region([...providersSection])],
  screens: [
    // titled for what they hold, not for the place they used to share with the
    // console's own activity: an exchange is a request and its answer
    { id: "exchanges", title: "Exchanges", nodes: [...readState, region([...exchangesSection])] },
    { id: "rules", title: "Routing rules", nodes: [...readState, region([...rulesSection])] },
    { id: "endpoints", title: "Upstream endpoints", nodes: [...readState, region([...endpointsSection])] },
  ],
}
