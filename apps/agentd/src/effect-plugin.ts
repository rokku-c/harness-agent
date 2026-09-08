import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import { z } from "@effect-agent/effect-config"
import { makeAgentdControl, type AgentdControl } from "@effect-agent/agentd"
import type { EffectTool } from "@effect-agent/effect-interface"

const tool = (name: string, input: z.ZodType, handler: (args: unknown) => unknown): EffectTool => ({ name, input, handler })
let runtimeControl: AgentdControl | undefined
const tools = (control: AgentdControl): readonly EffectTool[] => [
  tool("agentd_status", z.object({}).strict(), () => control.status()),
  tool("agentd_register_machine", z.record(z.string(), z.unknown()), (args) => control.registerMachine(args as never)),
  tool("agentd_register_agent", z.record(z.string(), z.unknown()), (args) => control.registerAgent(args as never)),
  tool("agentd_register_mcp_server", z.record(z.string(), z.unknown()), (args) => control.registerServer(args as never)),
  tool("agentd_upsert_mcpset", z.record(z.string(), z.unknown()), (args) => control.upsertSet(args as never)),
  tool("agentd_bind", z.object({ agentId: z.string(), setIds: z.array(z.string()) }).strict(), (args) => { const value = args as { agentId: string; setIds: string[] }; return control.bindAgent(value.agentId, value.setIds) }),
]
export const createAgentdPlugin = (): EffectPlugin => ({
  id: "agentd",
  load: async (): Promise<LoadedPlane> => {
    const control = runtimeControl ??= makeAgentdControl()
    return { tools: tools(control), handle: async (request) => Response.json({ app: "agentd", status: control.status() }) }
  },
})
