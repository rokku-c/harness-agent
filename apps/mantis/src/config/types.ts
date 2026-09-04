/**
 * config/types.ts - the MANTIS CONFIG CONTRACT.
 *
 * Concept: the shape of the loaded config, maximally compatible with the
 * original clawyp config.toml (sibling repo) - channel (dingtalk robot or
 * DWS), access credentials, model settings (with reflect passes), approval
 * policy, plus warnings gathered while migrating legacy keys.
 */
export type ModelApi = "openai.chat" | "anthropic.messages"

export interface RobotAccess {
  readonly clientId: string
  readonly clientSecret: string
  /** accepted for compatibility; proactive/agent_id flows are not implemented yet */
  readonly agentId?: string
  readonly cardTemplateId?: string
}

export interface DwsAccess {
  readonly groupId?: string
  readonly userId?: string
  readonly meUserId?: string
}

export interface MantisConfig {
  readonly channel: "robot" | "dws"
  readonly robot?: RobotAccess
  readonly dws?: DwsAccess
  readonly model: {
    readonly api: ModelApi
    readonly model: string
    readonly apiKey: string
    readonly baseURL?: string
    readonly maxSteps: number
    /** original agent.reflection.max_passes -> our reflect passes */
    readonly maxReflections: number
  }
  readonly approvals: {
    readonly protectedTools: string[]
    readonly ownerId?: string
    readonly ownerGroup?: string
    readonly timeoutMs: number
  }
  /** human-readable notices about deprecated/ignored original keys */
  readonly warnings: string[]
}
