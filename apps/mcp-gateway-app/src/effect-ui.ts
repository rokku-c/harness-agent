/**
 * The MCP gateway console, declared once.
 *
 * The app's loop is a question, so the question is the screen it starts on: two
 * chosen values and a press that asks the door's own engine whether this
 * principal reaches this tool. Everything else on this surface is the evidence
 * around that answer — the directory the principal comes from, the topology the
 * grants are declared in, and the records of what the door decided — which is
 * why the three are destinations rather than panels, and why every one of them
 * is reachable from the question.
 *
 * The answer is a screen and not a section, because a screen is what an address
 * can name and a screen is what can read itself on arrival (`onEnter`): that is
 * the whole of M4's third point, and it is what turns a denial from a screenshot
 * into a link a colleague can re-run.
 *
 * The operations are declared once in `ops.ts` and served to the console and to
 * an agent from there, so what this file adds is where a value comes from and
 * which screen a press enters — never a second account of what a gateway
 * operation is.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { gatewayActions } from "./effect-ui-actions.ts"
import { answerScreen } from "./effect-ui-answer.ts"
import { auditScreen } from "./effect-ui-audit.ts"
import { ACCESS_SCREEN, AUDIT_SCREEN, PRINCIPALS_SCREEN, TOPOLOGY_SCREEN } from "./effect-ui-paths.ts"
import { principalsScreen } from "./effect-ui-principals.ts"
import { questionScreen } from "./effect-ui-question.ts"
import { gatewaySources } from "./effect-ui-source.ts"
import { topologyScreen } from "./effect-ui-topology.ts"

export const effectUiView: EffectUiView = {
  viewId: "mcp-gateway-console",
  title: "MCP Gateway",
  /**
   * One subtree per read, at the paths the reads land on, plus what the operator
   * has chosen and what a press answered. The three drafts and the two answers
   * start absent rather than blank: a refusal is read off the path it was written
   * to, and an empty string there would paint a readout nobody earned.
   */
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
    { id: PRINCIPALS_SCREEN, title: "Principals", nodes: principalsScreen },
    { id: TOPOLOGY_SCREEN, title: "Topology", nodes: topologyScreen },
    { id: AUDIT_SCREEN, title: "Audit", nodes: auditScreen },
  ],
}
