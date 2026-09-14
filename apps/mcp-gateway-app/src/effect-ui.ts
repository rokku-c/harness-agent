import type { EffectUiView } from "@effect-agent/effect-ui"
import { gatewayActions } from "./effect-ui-actions.ts"
import { answerScreen } from "./effect-ui-answer.ts"
import { auditScreen } from "./effect-ui-audit.ts"
import { grantEditorScreen } from "./effect-ui-grant-editor.ts"
import { ACCESS_SCREEN, AUDIT_SCREEN, GRANTS_SCREEN, PRINCIPALS_SCREEN, TOPOLOGY_SCREEN } from "./effect-ui-paths.ts"
import { principalsScreen } from "./effect-ui-principals.ts"
import { questionScreen } from "./effect-ui-question.ts"
import { gatewaySources } from "./effect-ui-source.ts"
import { topologyScreen } from "./effect-ui-topology.ts"

export const effectUiView: EffectUiView = {
  viewId: "mcp-gateway-console",
  title: "MCP Gateway",
  state: {
    gateway: { servers: [], sets: [], bindings: [], tools: [], revision: 0 },
    audit: { events: [] },
    identities: { principals: [], tokens: [] },
    access: { agent: "", tool: "", result: undefined },
    issue: { draft: { kind: "app", id: "", name: "", days: "" }, result: undefined, dismissed: undefined },
    principals: { result: undefined, revoked: undefined },
  },
  sources: gatewaySources,
  actions: gatewayActions,
  nodes: questionScreen,
  screens: [
    { id: ACCESS_SCREEN, title: "Access decision", onEnter: "gateway.previewAccess", nodes: answerScreen },
    { id: GRANTS_SCREEN, title: "Grant editor", parent: ACCESS_SCREEN, nodes: grantEditorScreen },
    { id: PRINCIPALS_SCREEN, title: "Principals", nodes: principalsScreen },
    { id: TOPOLOGY_SCREEN, title: "Topology", nodes: topologyScreen },
    { id: AUDIT_SCREEN, title: "Audit", nodes: auditScreen },
  ],
}
