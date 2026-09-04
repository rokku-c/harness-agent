/**
 * console/types.ts - the WEB CONSOLE CONTRACT.
 *
 * Concept: state-first - every conversation turn (message.in -> tool steps
 * -> reply) is recorded into a per-conversation timeline, and UI state is
 * served as snapshots over MCP. This file owns the immutable timeline entry
 * shape, the console options, and the wire limits.
 */
import type { Bus } from "../bus.ts"
import type { Logger } from "@effect-agent/logger"
import type { Model } from "@effect-agent/builtin"

/** one immutable entry of a conversation's timeline (state, not events) */
export type ConsoleTimelineEntry =
  | { readonly seq: number; readonly ts: number; readonly kind: "msg"; readonly role: "user" | "assistant"; readonly text: string }
  | { readonly seq: number; readonly ts: number; readonly kind: "tool"; readonly tool: string; readonly state: "call" | "ok" | "fail"; readonly detail?: string }
  | { readonly seq: number; readonly ts: number; readonly kind: "note"; readonly text: string }

export interface WebConsoleOptions {
  /** event/log bus (the entry can pre-wire logger sinks into it) */
  readonly bus?: Bus
  readonly model: Model
  readonly maxSteps?: number
  readonly maxReflections?: number
  /** persona override per conversation (like the dingtalk host) */
  readonly instructions?: (conversationId: string) => string
  /** tool names that wait for the operator on this console (e.g. note_write) */
  readonly protectedTools?: ReadonlyArray<string>
  readonly approveTimeoutMs?: number
  /** where agent A2UI versions are persisted (git-tracked) */
  readonly uiDir: string
  /**
   * Append-only JSONL workspace file: when set the console owns ONE durable
   * workspace store shared by every conversation (human UI + agents) and it
   * reloads on start. Omit to keep per-session in-memory stores.
   */
  readonly workspaceFile?: string
  /** durable conversation-memory directory (see MantisHostOptions.memoryDir) */
  readonly memoryDir?: string
  /** logger for host/session events (console/file composite from the entry) */
  readonly logger: Logger
}

/** maximum inbound chat message length - over the limit is a graceful
 *  {ok/ accepted:false, detail} (never a silent cut or transport error) */
export const MAX_CHAT_TEXT = 100_000

/** conversation hosting the human workspace store (records shared with any agent session on it) */
export const WORKSPACE_CONVERSATION = "workspace"
