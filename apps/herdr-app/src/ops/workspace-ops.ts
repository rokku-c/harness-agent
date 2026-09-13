/**
 * Herdr's workspaces, read.
 *
 * Read-only on purpose. A workspace is where layout lives, Herdr already has a
 * UI for arranging it, and the console is here for the agents inside one — so
 * this exists to tell a start which workspace it is starting in, and to let an
 * operator see that their own screen is still the thing being described.
 */
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { typed, type HerdrSurfaces, type HerdrWorkspace } from "./surfaces.ts"

export const workspaceOperations = ({ client, socketPath }: HerdrSurfaces): readonly Operation[] => [
  operation({
    name: "herdr_workspaces",
    description: "Every workspace this Herdr server has open: its label, how many tabs and panes it holds, and whether an agent in it wants attention",
    access: "read", input: noInput, http: { method: "GET", path: "/herdr/workspaces" },
    // the server is named in the same answer the console draws its rows from, so
    // a page showing two machines' workspaces says which socket it read
    handler: async () => {
      const answer = typed<{ workspaces: readonly HerdrWorkspace[] }>(await client.call("workspace.list"))
      return { ok: true, server: { socketPath }, workspaces: answer.workspaces }
    },
  }),
]
