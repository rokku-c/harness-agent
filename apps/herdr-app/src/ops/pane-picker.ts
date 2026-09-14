import type { HerdrClient } from "../herdr-client.ts"
import { typed, type HerdrPane, type HerdrWorkspace } from "./surfaces.ts"

export const startWorkspace = async (client: HerdrClient): Promise<string | undefined> => {
  const answer = typed<{ workspaces: readonly HerdrWorkspace[] }>(await client.call("workspace.list"))
  return (answer.workspaces.find((workspace) => workspace.focused) ?? answer.workspaces[0])?.workspace_id
}

export const freePane = async (client: HerdrClient, workspaceId: string): Promise<string | undefined> => {
  const answer = typed<{ panes: readonly HerdrPane[] }>(await client.call("pane.list", { workspace_id: workspaceId }))
  return answer.panes.find((pane) => pane.agent === null)?.pane_id
}
