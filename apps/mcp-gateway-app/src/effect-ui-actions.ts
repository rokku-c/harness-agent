/**
 * Every move this console can make, declared once.
 *
 * A door is an action with `opens` and no `url`, which is what makes "the
 * destination is the part of the press that has no failure mode" true: a door
 * that could fail would leave an operator standing on a screen with nothing to
 * say why. A read is an action with a `url`; where each of its parameters comes
 * from is stated here and not at the press, so the retry under a failure repeats
 * the request that failed with the values still where the first press read them.
 *
 * The four screen parameters are read from `/_nav` — written by `useNavState`
 * before the screen's `onEnter` runs — so a press and a link pasted into the
 * address bar take one path (`screen.ts`). The question's own choice lives in
 * plain view state instead, because `useNavState` rewrites `/_nav` whole on
 * every arrival and a choice kept there would be gone the moment the operator
 * pressed Back.
 */
import type { UiActionSpec } from "@effect-agent/effect-ui"
import {
  ACCESS_RESULT, ACCESS_SCREEN, AGENT, AUDIT, AUDIT_SCREEN, DRAFT_DAYS, DRAFT_ID, DRAFT_KIND, DRAFT_NAME,
  IDENTITIES, ISSUE_DISMISSED, ISSUE_RESULT, NAV_AGENT, NAV_TOOL, PRINCIPALS_SCREEN, PRINCIPAL_RESULT,
  REVOKE_RESULT, TOPOLOGY, TOPOLOGY_SCREEN, TOOL,
} from "./effect-ui-paths.ts"

const doors: readonly UiActionSpec[] = [
  { name: "gateway.openAccess", opens: ACCESS_SCREEN, params: { agent: { state: AGENT }, tool: { state: TOOL } } },
  { name: "gateway.openPrincipals", opens: PRINCIPALS_SCREEN },
  { name: "gateway.openTopology", opens: TOPOLOGY_SCREEN },
  { name: "gateway.openAudit", opens: AUDIT_SCREEN },
  // `Show all` is a door to the screen it stands on, carrying nothing: `/_nav` is
  // written whole on each arrival, so entering the screen with no parameters is
  // how a filter is dropped, and no second way to write that path is invented.
  { name: "gateway.showEveryServer", opens: TOPOLOGY_SCREEN },
]

/**
 * A read run again, and nothing else. It has no `url` because it makes no call
 * of its own: the runtime re-runs the source it names, which is the only thing
 * that may write `/_sources/<id>` — a declared call writing that path directly
 * would leave a verdict saying `failed` over rows that had just arrived.
 */
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
  // Giving the revealed token up is the one irreversible thing on the screen, and
  // a press can only take state away by succeeding at a call (`Formal/Refresh`).
  // So the act's call is the directory read this screen is already about; the
  // answer goes to a path nobody reads, and its *failure* is shown, because a
  // dismissal that did not happen must not look like one that did.
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
