import { makeLauncher, type LaunchConfig, type LaunchRequest, type Launcher } from "@effect-agent/agentdeck"
import type { GatewayAgentConfig } from "@effect-agent/agentd"
import type { LaunchOrder, LaunchResult, LaunchRunner } from "./launch-order.ts"

export interface MachineLauncherOptions {
  readonly launcher?: Launcher
}

const armedConfig = (gateway: GatewayAgentConfig): LaunchConfig => ({
  mcp: Object.fromEntries(Object.entries(gateway.mcpServers).map(([name, server]) => [
    name, { url: server.url, token: server.headers.authorization.slice("Bearer ".length) },
  ])),
})

const requestFor = (order: LaunchOrder): LaunchRequest =>
  "command" in order
    ? {
        kind: "custom",
        workdir: order.workdir,
        prompt: "",
        config: { command: order.command, ...(order.args === undefined ? {} : { args: order.args }) },
      }
    : { kind: order.kind, workdir: order.workdir, prompt: order.prompt, config: armedConfig(order.gateway) }

export const makeLaunchRunner = (options: MachineLauncherOptions = {}): LaunchRunner => {
  const launcher = options.launcher ?? makeLauncher()
  return {
    run: async (order: LaunchOrder): Promise<LaunchResult> => {
      const outcome = await launcher.run(requestFor(order))
      return {
        ok: outcome.ok,
        output: outcome.output,
        durationMs: outcome.durationMs,
        ...(outcome.detail === undefined ? {} : { detail: outcome.detail }),
      }
    },
  }
}
