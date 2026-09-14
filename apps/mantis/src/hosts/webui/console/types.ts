import type { Bus } from "../bus.ts"
import type { Logger } from "@effect-agent/logger"
import type { Model } from "@effect-agent/model"

export type ConsoleTimelineEntry =
  | { readonly seq: number; readonly ts: number; readonly kind: "msg"; readonly role: "user" | "assistant"; readonly text: string }
  | { readonly seq: number; readonly ts: number; readonly kind: "tool"; readonly tool: string; readonly state: "call" | "ok" | "fail"; readonly detail?: string }
  | { readonly seq: number; readonly ts: number; readonly kind: "note"; readonly text: string }

export interface WebConsoleOptions {
  readonly bus?: Bus
  readonly model: Model
  readonly maxSteps?: number
  readonly maxReflections?: number
  readonly instructions?: (conversationId: string) => string
  readonly protectedTools?: ReadonlyArray<string>
  readonly approveTimeoutMs?: number
  readonly workspaceFile?: string
  readonly memoryDir?: string
  readonly logger: Logger
}

export const MAX_CHAT_TEXT = 100_000

export const WORKSPACE_CONVERSATION = "workspace"
