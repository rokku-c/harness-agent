import type { LaunchMcpServer } from "../config-types.ts"

export interface LaunchConfig {
  readonly model?: string
  readonly command?: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  readonly mcp?: Readonly<Record<string, LaunchMcpServer>>
  readonly timeoutMs?: number
}

export interface LaunchRequest {
  readonly kind: string
  readonly workdir: string
  readonly prompt: string
  readonly config?: LaunchConfig
}

export interface LaunchCommand {
  readonly file: string
  readonly argv: ReadonlyArray<string>
  readonly env: Readonly<Record<string, string>>
  readonly workdir: string
}

export interface LaunchOutcome {
  readonly ok: boolean
  readonly output: string
  readonly detail?: string
  readonly durationMs: number
}

export interface Launcher {
  readonly command: (request: LaunchRequest) => LaunchCommand
  readonly run: (request: LaunchRequest) => Promise<LaunchOutcome>
}
