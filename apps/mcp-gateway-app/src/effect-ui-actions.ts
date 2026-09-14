import type { UiActionSpec } from "@effect-agent/effect-ui"
import {
  ACCESS_RESULT, ACCESS_SCREEN, AGENT, AUDIT, AUDIT_SCREEN, DRAFT_DAYS, DRAFT_ID, DRAFT_KIND, DRAFT_NAME, FIXING,
  GRANTS_SCREEN, IDENTITIES, ISSUE_DISMISSED, ISSUE_RESULT, NAV_AGENT, NAV_TOOL, PRINCIPALS_SCREEN, PRINCIPAL_RESULT,
  REVOKE_RESULT, TOPOLOGY, TOPOLOGY_SCREEN, TOOL,
} from "./effect-ui-paths.ts"

const doors: readonly UiActionSpec[] = [
  { name: "gateway.openAccess", opens: ACCESS_SCREEN, params: { agent: { state: AGENT }, tool: { state: TOOL } } },
  { name: "gateway.openPrincipals", opens: PRINCIPALS_SCREEN },
  { name: "gateway.openTopology", opens: TOPOLOGY_SCREEN },
  { name: "gateway.openAudit", opens: AUDIT_SCREEN },
  { name: "gateway.showEveryServer", opens: TOPOLOGY_SCREEN },
  { name: "gateway.openGrants", opens: GRANTS_SCREEN, params: {
    agent: { state: NAV_AGENT }, setId: { state: `${FIXING}/setId` }, list: { state: `${FIXING}/list` },
    entry: { state: `${FIXING}/tool` }, serverId: { state: `${FIXING}/serverId` },
  } },
]

const again: readonly UiActionSpec[] = [
  { name: "gateway.readTopology", refresh: [TOPOLOGY] },
  { name: "gateway.readAudit", refresh: [AUDIT] },
  { name: "gateway.readDirectory", refresh: [IDENTITIES] },
]

const moves: readonly UiActionSpec[] = [
  {
    name: "gateway.previewAccess", method: "GET", url: "/mcp-gateway/access",
    params: { agent: { state: NAV_AGENT }, tool: { state: NAV_TOOL } }, result: ACCESS_RESULT,
  },
  {
    name: "gateway.issueToken", method: "POST", url: "/mcp-gateway/tokens",
    params: { kind: { state: DRAFT_KIND }, id: { state: DRAFT_ID }, displayName: { state: DRAFT_NAME }, ttlDays: { state: DRAFT_DAYS } },
    result: ISSUE_RESULT, clear: [DRAFT_ID], refresh: [IDENTITIES],
  },
  {
    name: "gateway.dismissToken", method: "GET", url: "/mcp-gateway/identities",
    result: ISSUE_DISMISSED, clear: [ISSUE_RESULT],
  },
  {
    name: "gateway.disablePrincipal", method: "POST", url: "/mcp-gateway/principals/status",
    params: { status: "disabled" }, result: PRINCIPAL_RESULT, refresh: [IDENTITIES],
  },
  {
    name: "gateway.enablePrincipal", method: "POST", url: "/mcp-gateway/principals/status",
    params: { status: "active" }, result: PRINCIPAL_RESULT, refresh: [IDENTITIES],
  },
  {
    name: "gateway.revokeToken", method: "POST", url: "/mcp-gateway/tokens/revoke",
    result: REVOKE_RESULT, refresh: [IDENTITIES],
  },
]

export const gatewayActions: readonly UiActionSpec[] = [...doors, ...again, ...moves]
