import { makeLauncher, type Launcher } from "@effect-agent/agentdeck"
import type { LaunchOrder, LaunchResult, LaunchRunner } from "./launch-cycle.ts"

/**
 * The launch runner this machine runs by default: agentdeck's launcher, which
 * knows the CLI dialects and how to spawn one turn in a working directory.
 *
 * It lives here, at the edge, on purpose — `launch-cycle.ts` declares what it
 * needs structurally and stays free of any dialect opinion, and this file is
 * the one place in the package that knows which library supplies them.
 */
export interface MachineLauncherOptions {
  /** Absent = this host, with agentdeck's built-in dialects. */
  readonly launcher?: Launcher
}

export const makeLaunchRunner = (options: MachineLauncherOptions = {}): LaunchRunner => {
  const launcher = options.launcher ?? makeLauncher()
  return {
    run: async (order: LaunchOrder): Promise<LaunchResult> => {
      const outcome = await launcher.run({
        kind: order.kind,
        workdir: order.workdir,
        prompt: order.prompt,
        ...(order.command === undefined
          ? {}
          : { config: { command: order.command, ...(order.args === undefined ? {} : { args: order.args }) } }),
      })
      return {
        ok: outcome.ok,
        output: outcome.output,
        durationMs: outcome.durationMs,
        ...(outcome.detail === undefined ? {} : { detail: outcome.detail }),
      }
    },
  }
}
