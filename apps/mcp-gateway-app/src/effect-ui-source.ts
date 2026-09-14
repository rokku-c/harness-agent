/**
 * The three reads the console is about, declared once.
 *
 * Each one is the app's own operation read over HTTP rather than a second
 * account of it, so what the console shows and what an agent calling the same
 * operation as a tool receives cannot disagree.
 *
 * All three are on the same ten-second cadence because they answer one subject
 * at three depths — what the door can offer, who may knock, what it decided —
 * and a page that refreshed one of them faster would paint a refusal over a
 * stale topology, which reads as a contradiction rather than as an old row.
 *
 * Nothing here names a state path of its own: the answers land where
 * `effect-ui-paths.ts` says, and how each read went is the runtime's record at
 * `/_sources/<id>`, which `sourceStates` reads.
 */
import type { UiSourceSpec } from "@effect-agent/effect-ui"
import { AUDIT, DIRECTORY, EVENTS, GATEWAY, IDENTITIES, TOPOLOGY } from "./effect-ui-paths.ts"

export const gatewaySources: readonly UiSourceSpec[] = [
  { id: TOPOLOGY, url: "/mcp-gateway", state: GATEWAY, refreshMs: 10000 },
  { id: AUDIT, url: "/mcp-gateway/audit", state: EVENTS, refreshMs: 10000 },
  { id: IDENTITIES, url: "/mcp-gateway/identities", state: DIRECTORY, refreshMs: 10000 },
]
