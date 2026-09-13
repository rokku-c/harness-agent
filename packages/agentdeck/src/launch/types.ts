/**
 * Running one agent once, in a named working directory, and waiting for it.
 *
 * A session gateway is for a conversation: open, many turns, close. A launch is
 * the other shape - a single request that ends - and it is what a machine needs
 * when a remote caller says "work in this directory on this task". The same
 * argv renderer and the same spawn semantics are reused underneath, so a local
 * launch and a local session cannot drift apart.
 */
/** Per-launch overrides. `cwd` is never one: it is the request's `workdir`. */
export interface LaunchConfig {
  readonly model?: string
  readonly command?: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  readonly timeoutMs?: number
}

export interface LaunchRequest {
  /**
   * An open string rather than an `AgentKind`: which agents a machine can run is
   * that machine's vocabulary, and a request naming one this machine has never
   * heard of is refused there, with the kinds it does know, instead of being
   * silently mapped onto some other agent.
   */
  readonly kind: string
  /** Where the agent runs: a local path, or a directory on the target host. */
  readonly workdir: string
  readonly prompt: string
  readonly config?: LaunchConfig
}

export interface LaunchCommand {
  readonly file: string
  readonly argv: ReadonlyArray<string>
  readonly workdir: string
}

export interface LaunchOutcome {
  readonly ok: boolean
  /** The agent's answer, when it produced text. */
  readonly output: string
  /**
   * Why it failed: a non-zero exit, a missing binary, a timeout, an unreachable
   * host. Absent on success, so `ok` never has to be checked against `output`.
   */
  readonly detail?: string
  readonly durationMs: number
}

export interface Launcher {
  /** The argv this launcher would run, so a caller can show the plan before running it. */
  readonly command: (request: LaunchRequest) => LaunchCommand
  readonly run: (request: LaunchRequest) => Promise<LaunchOutcome>
}
