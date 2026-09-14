import { OperationFault, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { liveName } from "./agent-fields.ts"
import { freePane, startWorkspace } from "./pane-picker.ts"
import type { HerdrSurfaces } from "./surfaces.ts"

const chosen = (value: string | undefined): string | undefined =>
  value === undefined || value === "" ? undefined : value

export const agentStartOperations = ({ client }: HerdrSurfaces): readonly Operation[] => [
  operation({
    name: "herdr_agent_start",
    description: "Start a coding agent under a unique live name, in a free shell pane of the workspace you name, or of the focused workspace when you name none; Herdr validates the kind and starts tracking the agent's lifecycle",
    input: z.object({
      name: liveName,
      kind: z.string().min(1),
      workspaceId: z.string().optional(),
      args: z.array(z.string()).optional(),
    }).strict(),
    http: { method: "POST", path: "/herdr/agents", status: 201 },
    handler: async (input) => {
      const workspaceId = chosen(input.workspaceId) ?? await startWorkspace(client)
      const paneId = workspaceId === undefined ? undefined : await freePane(client, workspaceId)
      if (paneId === undefined) {
        throw new OperationFault(409, workspaceId === undefined
          ? "this Herdr server has no workspace open to start an agent in"
          : `workspace ${workspaceId} has no pane holding a free shell, and Herdr starts an agent only in a pane a shell is already waiting in`)
      }
      return { ok: true, started: await client.call("agent.start", {
        name: input.name, kind: input.kind, pane_id: paneId,
        ...(input.args === undefined ? {} : { args: input.args }),
      }) }
    },
  }),
]
