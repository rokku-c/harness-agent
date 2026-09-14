import type { CliPreset } from "../adapters/cli-preset.ts"
import { makeSshTransport } from "../remote/ssh.ts"
import type { RemoteTarget } from "../remote/types.ts"
import { makeLocalLauncher } from "./local.ts"
import { makeRemoteLauncher } from "./remote.ts"
import type { Launcher } from "./types.ts"

export interface LauncherOptions {
  readonly target?: RemoteTarget
  readonly presets?: Readonly<Record<string, CliPreset>>
  readonly transport?: ReturnType<typeof makeSshTransport>
}

export const makeLauncher = (options: LauncherOptions = {}): Launcher => {
  const presets = options.presets === undefined ? {} : { presets: options.presets }
  if (options.target === undefined) return makeLocalLauncher(presets)
  return makeRemoteLauncher(options.transport ?? makeSshTransport(options.target), presets)
}

export { launchCommand, launchLine, configFor, assertRunnable, type PresetMap } from "./command.ts"
export { makeLocalLauncher } from "./local.ts"
export { makeRemoteLauncher } from "./remote.ts"
export type { LaunchCommand, LaunchConfig, LaunchOutcome, LaunchRequest, Launcher } from "./types.ts"
