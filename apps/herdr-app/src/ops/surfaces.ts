import type { HerdrClient } from "../herdr-client.ts"

export interface HerdrSurfaces {
  readonly client: HerdrClient
  readonly socketPath: string
}

export interface HerdrWorkspace {
  readonly workspace_id: string
  readonly number: number
  readonly label: string
  readonly focused: boolean
  readonly pane_count: number
  readonly tab_count: number
  readonly active_tab_id: string
  readonly agent_status: string
}

export interface HerdrAgent {
  readonly agent: string
  readonly terminal_title_stripped: string
  readonly agent_status: string
  readonly workspace_id: string
  readonly tab_id: string
  readonly pane_id: string
  readonly focused: boolean
  readonly foreground_cwd: string
  readonly revision: number
}

export interface HerdrAgentTail {
  readonly text: string
  readonly truncated: boolean
}

export interface HerdrAgentWithTail extends HerdrAgent {
  readonly tail?: HerdrAgentTail
}

export interface HerdrPane {
  readonly pane_id: string
  readonly workspace_id: string
  readonly tab_id: string
  readonly agent: string | null
  readonly cwd: string
  readonly terminal_title_stripped: string
  readonly agent_status: string
}

export interface HerdrRead {
  readonly pane_id: string
  readonly text: string
  readonly format: string
  readonly revision: number
  readonly truncated: boolean
}

export const typed = <T>(value: unknown): T => value as T
