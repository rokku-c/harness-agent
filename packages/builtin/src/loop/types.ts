/**
 * loop/types.ts - the SHAPES shared by the driver layers.
 * Pure interfaces/constants, no logic: imported by every other loop module.
 */
import type { AgentContext, Sensitivity } from "@effect-agent/core"
import type { Model, WireMessage } from "../wire.ts"

/** What the loop has seen so far - the input to the policy hooks below.
 *  Drivers stay generic; context economy and reflection are
 *  operator-supplied policies (mantis-style), off by default. */
export interface LoopState {
  readonly step: number
  /** op names whose execution succeeded so far */
  readonly usedTools: ReadonlyArray<string>
  /** detail of the previous tool error, when the last step failed a tool */
  readonly lastToolError?: string
}

/** the mutable ledger one run carries across steps and layers */
export interface RunBox {
  context: AgentContext
  thread: WireMessage[]
  usedTools: string[]
  lastToolError?: string
  /** structured-result retry budget spent so far */
  retries: number
}

export const DEFAULT_MAX_STEPS = 32
export const DEFAULT_MAX_REFLECTIONS = 1
export const DEFAULT_DECODE_RETRIES = 2

export interface EffectAgentOptions {
  readonly model: Model
  /** The system prompt: the driver's only model-facing prose, supplied by the operator. */
  readonly instructions?: string
  readonly maxSteps?: number
  /** Declared sensitivities, recorded into every checkpoint; resume injects the matching recovery notes. */
  readonly sensitivities?: ReadonlyArray<Sensitivity>
  /**
   * Context economy: re-plan the visible tool surface before EVERY model
   * call. Return the op names the model may see this step, or undefined to
   * keep the full granted surface (the default). Tools outside the visible
   * surface are guarded - calling one yields a recoverable tool error, so
   * the model learns to grow the surface instead of flooding step one.
   */
  readonly planTools?: (state: LoopState) => ReadonlyArray<string> | undefined
  /**
   * Reflection: called before a model call when the previous step failed a
   * tool. Returning a prompt injects it as a user message so the model
   * reflects before retrying; undefined (default) skips reflection.
   * Guarded by maxReflections (default 1 when reflect is set).
   */
  readonly reflect?: (state: LoopState) => string | undefined
  readonly maxReflections?: number
  /**
   * How many times a malformed structured-result tool call may be fed back
   * as a tool error before the run fails. Structured results travel as the
   * agent-declared protocol tool (until.schema asTool) whose input schema IS
   * the required output; any schema mismatch comes back as a readable tool
   * error the model can fix.
   */
  readonly decodeRetries?: number
}
