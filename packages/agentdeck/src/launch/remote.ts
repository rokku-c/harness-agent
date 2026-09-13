import type { CliPreset } from "../adapters/cli-preset.ts"
import type { RemoteTransport } from "../remote/types.ts"
import { launchCommand, launchLine } from "./command.ts"
import type { LaunchOutcome, LaunchRequest, Launcher } from "./types.ts"

export interface RemoteLauncherOptions {
  readonly presets?: Readonly<Record<string, CliPreset>>
}

/**
 * A launch on another host, over the transport that host is reachable through.
 * The transport runs the command by `cd`-ing into the workdir first, so the
 * working directory is the same statement locally and remotely; what differs is
 * only who executes it.
 */
export const makeRemoteLauncher = (transport: RemoteTransport, options: RemoteLauncherOptions = {}): Launcher => ({
  command: (request: LaunchRequest) => launchCommand(request, options.presets),
  run: async (request: LaunchRequest): Promise<LaunchOutcome> => {
    const startedAt = Date.now()
    const timeoutMs = request.config?.timeoutMs
    try {
      const result = await transport.run(launchLine(launchCommand(request, options.presets)), {
        cwd: request.workdir,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      })
      const output = result.stdout.trim(), durationMs = Date.now() - startedAt
      if (result.timedOut) {
        return { ok: false, output, detail: `no exit within ${timeoutMs ?? "the transport's"} ms; the remote process was killed`, durationMs }
      }
      if (result.code === 0) {
        return output.length > 0 ? { ok: true, output, durationMs } : { ok: false, output, detail: "the agent produced no answer", durationMs }
      }
      return { ok: false, output, detail: (result.stderr.trim() || output || `exit code ${result.code}`).slice(0, 400), durationMs }
    } catch (error) {
      // an unreachable host is not a failed agent, and must not read as one
      return { ok: false, output: "", detail: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startedAt }
    }
  },
})
