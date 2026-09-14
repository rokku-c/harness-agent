import { cliInvocation, cliPresets, type CliPreset } from "../adapters/cli-preset.ts"
import { quote } from "../remote/ssh.ts"
import type { AgentKind } from "../kinds.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import type { LaunchCommand, LaunchRequest } from "./types.ts"

export type PresetMap = Readonly<Record<string, CliPreset>>

export const assertRunnable = (request: LaunchRequest, presets: PresetMap): void => {
  if (request.config?.command !== undefined) return
  if (Object.prototype.hasOwnProperty.call(presets, request.kind)) return
  const known = Object.keys(presets).join(", ")
  throw new Error(`This machine cannot run agent kind "${request.kind}"; known kinds are ${known}, or name a command`)
}

export const configFor = (request: LaunchRequest, presets: PresetMap = cliPresets): UnifiedAgentConfig => {
  assertRunnable(request, presets)
  const extra = request.config
  return {
    kind: request.kind as AgentKind,
    cwd: request.workdir,
    ...(extra?.model === undefined ? {} : { model: extra.model }),
    ...(extra?.command === undefined ? {} : { command: extra.command }),
    ...(extra?.args === undefined ? {} : { args: [...extra.args] }),
    ...(extra?.env === undefined ? {} : { env: new Map(Object.entries(extra.env)) }),
    ...(extra?.mcp === undefined ? {} : { mcp: extra.mcp }),
    ...(extra?.timeoutMs === undefined ? {} : { turnTimeoutMs: extra.timeoutMs }),
  }
}

export const launchCommand = (request: LaunchRequest, presets: PresetMap = cliPresets): LaunchCommand => {
  const { file, argv, env } = cliInvocation(configFor(request, presets), request.prompt, presets)
  return { file, argv, env, workdir: request.workdir }
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*$/

export const launchLine = (command: LaunchCommand): string => {
  const assignments = Object.entries(command.env).map(([name, value]) => {
    if (!ASSIGNMENT.test(name)) throw new Error(`"${name}" is not a shell variable name, so this launch cannot carry it to a remote host`)
    return `${name}=${quote(value)}`
  })
  return [...assignments, ...[command.file, ...command.argv].map(quote)].join(" ")
}
