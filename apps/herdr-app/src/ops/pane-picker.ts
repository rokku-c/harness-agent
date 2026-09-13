/**
 * Which pane a start goes in.
 *
 * Herdr starts an agent only in a pane that already holds a free shell — it will
 * not create layout, because layout is the operator's. A caller made to name a
 * pane is therefore being made to know Herdr's topology to do something that has
 * nothing to do with topology. These two reads are what lets a caller name a
 * workspace instead, and get back a pane.
 */
import type { HerdrClient } from "../herdr-client.ts"
import { typed, type HerdrPane, type HerdrWorkspace } from "./surfaces.ts"

/** The workspace a start falls back to: the focused one, or the first there is. */
export const startWorkspace = async (client: HerdrClient): Promise<string | undefined> => {
  const answer = typed<{ workspaces: readonly HerdrWorkspace[] }>(await client.call("workspace.list"))
  return (answer.workspaces.find((workspace) => workspace.focused) ?? answer.workspaces[0])?.workspace_id
}

/** The first pane in a workspace holding a plain shell, which is what a start needs. */
export const freePane = async (client: HerdrClient, workspaceId: string): Promise<string | undefined> => {
  const answer = typed<{ panes: readonly HerdrPane[] }>(await client.call("pane.list", { workspace_id: workspaceId }))
  return answer.panes.find((pane) => pane.agent === null)?.pane_id
}
