import type { AgentContext, Sensitivity } from "@effect-agent/core"
import type { Model, WireMessage } from "@effect-agent/model"

export interface LoopState {
  readonly step: number
  readonly usedTools: ReadonlyArray<string>
  readonly lastToolError?: string
}

export interface RunBox {
  context: AgentContext
  thread: WireMessage[]
  usedTools: string[]
  lastToolError?: string
  retries: number
}

export const DEFAULT_MAX_STEPS = 32
export const DEFAULT_MAX_REFLECTIONS = 1
export const DEFAULT_DECODE_RETRIES = 2

export interface EffectAgentOptions {
  readonly model: Model
  readonly instructions?: string
  readonly maxSteps?: number
  readonly sensitivities?: ReadonlyArray<Sensitivity>
  readonly planTools?: (state: LoopState) => ReadonlyArray<string> | undefined
  readonly reflect?: (state: LoopState) => string | undefined
  readonly maxReflections?: number
  readonly decodeRetries?: number
}
