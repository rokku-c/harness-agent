/**
 * The AI Gateway console: the model plane an operator runs, on one page.
 *
 * The order is the three questions the standard asks, in the order it asks
 * them. What this is, then the figures that say how much it is carrying, then
 * the providers — the thing the page exists for, since every row is one the
 * operator can ask to answer — and only then the rules and endpoints behind it.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { region } from "@effect-agent/effect-ui"
import { heading, MODEL_SOURCE, row, signal, sourceVerdict, text } from "./effect-ui-nodes.ts"
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
  actions: [{ name: "gateway.testProvider", method: "POST", url: "/models/providers/{providerId}/test", result: "/health/result" }],
  nodes: [
    heading("AI Gateway", { size: "6" }),
    text("Model proxy: serves OpenAI Chat, OpenAI Responses, and Anthropic Messages traffic from the providers below.", { size: "2", color: "gray" }),
    // the one source's own read, before everything it feeds: every list below
    // reads the same answer, so a failed read is one fact about one read
    ...sourceVerdict,
    // A page-wide fact rather than a row's state: it says what the gateway is
    // keeping, and it is worth the ink only while it is on.
    row([signal("Request bodies are recorded", "/models/captureBodies", "amber")]),
    // The figures are the page's headline and belong to every exchange the lists
    // below are made of, so they stay above the fold and the lists move under them.
    ...usageNodes,
    region([providersSection, activitySection, rulesSection, endpointsSection]),
  ],
}
