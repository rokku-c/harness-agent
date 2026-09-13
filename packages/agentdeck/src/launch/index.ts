import type { CliPreset } from "../adapters/cli-preset.ts"
import { makeSshTransport } from "../remote/ssh.ts"
import type { RemoteTarget } from "../remote/types.ts"
import { makeLocalLauncher } from "./local.ts"
import { makeRemoteLauncher } from "./remote.ts"
import type { Launcher } from "./types.ts"

export interface LauncherOptions {
  /**
   * Where to run. Absent means this host; a target means that host, reached the
   * same way its sessions are collected. The launcher's job does not change:
   * the workdir and the prompt mean the same thing on both sides.
   */
  readonly target?: RemoteTarget
  readonly presets?: Readonly<Record<string, CliPreset>>
  /** Transport to a target, injectable so a caller can drive a fake host. */
  readonly transport?: ReturnType<typeof makeSshTransport>
}

export const makeLauncher = (options: LauncherOptions = {}): Launcher => {
  // no table named means the built-in dialects, not none at all: passing an empty
  // one would refuse every kind for the crime of not being "custom"
  const presets = options.presets === undefined ? {} : { presets: options.presets }
  if (options.target === undefined) return makeLocalLauncher(presets)
  return makeRemoteLauncher(options.transport ?? makeSshTransport(options.target), presets)
}

export { launchCommand, launchLine, configFor, assertRunnable, type PresetMap } from "./command.ts"
export { makeLocalLauncher } from "./local.ts"
export { makeRemoteLauncher } from "./remote.ts"
export type { LaunchCommand, LaunchConfig, LaunchOutcome, LaunchRequest, Launcher } from "./types.ts"
