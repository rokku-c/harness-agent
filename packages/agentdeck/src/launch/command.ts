import { cliInvocation, cliPresets, type CliPreset } from "../adapters/cli-preset.ts"
import { quote } from "../remote/ssh.ts"
import type { AgentKind } from "../kinds.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import type { LaunchCommand, LaunchRequest } from "./types.ts"

export type PresetMap = Readonly<Record<string, CliPreset>>

/**
 * A kind with no preset and no explicit command is refused rather than run. The
 * CLI dialect table falls back to `custom` (the bare `agent` binary) for
 * anything it does not know, which is a sensible default for a caller who asked
 * for "custom" and a silent wrong answer for one who asked for an agent this
 * machine has never heard of.
 */
export const assertRunnable = (request: LaunchRequest, presets: PresetMap): void => {
  if (request.config?.command !== undefined) return
  if (Object.prototype.hasOwnProperty.call(presets, request.kind)) return
  const known = Object.keys(presets).join(", ")
  throw new Error(`This machine cannot run agent kind "${request.kind}"; known kinds are ${known}, or name a command`)
}

/** A launch request is a unified config whose `cwd` is the request's workdir. */
export const configFor = (request: LaunchRequest, presets: PresetMap = cliPresets): UnifiedAgentConfig => {
  assertRunnable(request, presets)
  const extra = request.config
  return {
    // validated above: either a preset exists for it, or a command was named
    kind: request.kind as AgentKind,
    cwd: request.workdir,
    ...(extra?.model === undefined ? {} : { model: extra.model }),
    ...(extra?.command === undefined ? {} : { command: extra.command }),
    ...(extra?.args === undefined ? {} : { args: [...extra.args] }),
    ...(extra?.env === undefined ? {} : { env: new Map(Object.entries(extra.env)) }),
    ...(extra?.timeoutMs === undefined ? {} : { turnTimeoutMs: extra.timeoutMs }),
  }
}

export const launchCommand = (request: LaunchRequest, presets: PresetMap = cliPresets): LaunchCommand => {
  const { file, argv } = cliInvocation(configFor(request, presets), request.prompt, presets)
  return { file, argv, workdir: request.workdir }
}

/**
 * The same command as one shell line. A remote host is reached through a shell,
 * so every word is quoted on its own: a prompt containing a space, a quote, or a
 * `;` is an argument and must not become syntax.
 */
export const launchLine = (command: LaunchCommand): string =>
  [command.file, ...command.argv].map(quote).join(" ")
