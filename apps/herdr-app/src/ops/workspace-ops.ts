import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { typed, type HerdrSurfaces, type HerdrWorkspace } from "./surfaces.ts"

export const workspaceOperations = ({ client, socketPath }: HerdrSurfaces): readonly Operation[] => [
  operation({
    name: "herdr_workspaces",
    description: "Every workspace this Herdr server has open: its label, how many tabs and panes it holds, and whether an agent in it wants attention",
    access: "read", input: noInput, http: { method: "GET", path: "/herdr/workspaces" },
    handler: async () => {
      const answer = typed<{ workspaces: readonly HerdrWorkspace[] }>(await client.call("workspace.list"))
      return { ok: true, server: { socketPath }, workspaces: answer.workspaces }
    },
  }),
]
