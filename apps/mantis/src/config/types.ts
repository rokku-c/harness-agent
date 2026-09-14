export type ModelApi = "openai.chat" | "anthropic.messages"

export interface RobotAccess {
  readonly clientId: string
  readonly clientSecret: string
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
    readonly maxReflections: number
  }
  readonly approvals: {
    readonly protectedTools: string[]
    readonly ownerId?: string
    readonly ownerGroup?: string
    readonly timeoutMs: number
  }
  readonly warnings: string[]
}
