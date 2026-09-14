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
    health: { result: undefined },
  },
  sources: [{ id: MODEL_SOURCE, url: "/models", state: "/models", refreshMs: 10000 }],
  actions: [
    { name: "gateway.testProvider", method: "POST", url: "/models/providers/{providerId}/test", result: "/health/result" },
    { name: "gateway.exchanges", opens: "exchanges" },
    { name: "gateway.rules", opens: "rules" },
    { name: "gateway.endpoints", opens: "endpoints" },
  ],
  nodes: [gatewayHeader, ...readState, ...usageFigures, region([...providersSection])],
  screens: [
    { id: "exchanges", title: "Exchanges", nodes: [...readState, region([...exchangesSection])] },
    { id: "rules", title: "Routing rules", nodes: [...readState, region([...rulesSection])] },
    { id: "endpoints", title: "Upstream endpoints", nodes: [...readState, region([...endpointsSection])] },
  ],
}
