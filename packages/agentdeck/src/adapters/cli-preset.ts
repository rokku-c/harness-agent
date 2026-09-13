/**
 * agentdeck/adapters/cli-preset - the declarative per-kind CLI dialect: how one
 * turn becomes a process argv (ask 3, lossless).
 *
 * Rendered here rather than inside the gateway because it has two callers: the
 * gateway that spawns the turn, and the launch layer and console that SHOW the
 * plan before anyone runs it.
 */
import type { UnifiedAgentConfig } from "../config-types.ts"

/** declarative per-kind CLI dialect: how one turn becomes a process argv */
export interface CliPreset {
  readonly file: string
  /** argv BEFORE the prompt text (the prompt is appended last) */
  readonly argv: (prompt: string) => ReadonlyArray<string>
}

export const cliPresets: Readonly<Record<string, CliPreset>> = {
  "claude-code": { file: "claude", argv: () => ["-p"] },
  codex: { file: "codex", argv: () => ["exec"] },
  gemini: { file: "gemini", argv: () => [] }, // gemini >=0.24: positional one-shot prompt
  pi: { file: "pi", argv: () => ["-p"] },
  custom: { file: "agent", argv: () => [] }
}

/** standalone render: unified config -> exact spawn {file, argv} for one turn
 * (shared by the gateway and by products that want to SHOW the plan before
 * running it). prompt is appended last. */
export const cliInvocation = (
  config: UnifiedAgentConfig,
  prompt: string,
  presetMap: Readonly<Record<string, CliPreset>> = cliPresets
): { file: string; argv: ReadonlyArray<string> } => {
  const preset = presetMap[config.kind] ?? presetMap.custom
  const prefix: ReadonlyArray<string> = config.command !== undefined ? (config.args ?? []) : preset.argv(prompt)
  // an empty prompt is not a turn: appending it would hand a command launch —
  // `npm install -g …`, say — a stray empty argument it never asked for
  const tail: ReadonlyArray<string> = prompt === "" ? [] : [prompt]
  return { file: config.command ?? preset.file, argv: [...prefix, ...tail] }
}
