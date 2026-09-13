import { makeLauncher, type LaunchConfig, type LaunchRequest, type Launcher } from "@effect-agent/agentdeck"
import type { GatewayAgentConfig } from "@effect-agent/agentd"
import type { LaunchOrder, LaunchResult, LaunchRunner } from "./launch-order.ts"

/**
 * The launch runner this machine runs by default: agentdeck's launcher, which
 * knows the CLI dialects and how to spawn one turn in a working directory.
 *
 * It lives here, at the edge, on purpose — `launch-cycle.ts` declares what it
 * needs structurally and stays free of any dialect opinion, and this file is
 * the one place in the package that knows which library supplies them.
 *
 * It is also where the control plane's `LaunchOrder` becomes agentdeck's
 * `LaunchRequest`. Two types for one job: the order is what a machine was told,
 * the request is what a dialect renderer takes, and neither package should grow
 * a field for the other's convenience.
 */
export interface MachineLauncherOptions {
  /** Absent = this host, with agentdeck's built-in dialects. */
  readonly launcher?: Launcher
}

/**
 * The platform's config in agentdeck's words. The `Bearer ` prefix is dropped
 * rather than parsed: there is nothing left to decide, because
 * `validateGatewayConfig` already refused every other spelling at the door, and
 * a header re-read here would be a second opinion about a fact already settled.
 */
const armedConfig = (gateway: GatewayAgentConfig): LaunchConfig => ({
  mcp: Object.fromEntries(Object.entries(gateway.mcpServers).map(([name, server]) => [
    name, { url: server.url, token: server.headers.authorization.slice("Bearer ".length) },
  ])),
})

/**
 * An order, as a request to a launcher. The two halves differ in more than their
 * fields: a turn is named by its identity's kind and is armed with the door, and
 * a command is named by its own words, carries no prompt, and is armed with
 * nothing — there is no identity behind it to have been issued a credential.
 */
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
