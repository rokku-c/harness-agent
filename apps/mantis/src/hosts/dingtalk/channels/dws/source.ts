/**
 * channels/dws/source.ts - the SOURCE ADDRESSING contract.
 *
 * Concept: one DwsChannel watches one source (a group or a direct user) and
 * polls it after a cursor. Conversation identity and the CLI arg shapes for
 * list/send are derived from the source kind here - the poll loop never
 * branches on group vs direct.
 */
import type { IncomingMessage } from "../../messages.ts"

export type DwsSource =
  | { readonly kind: "group"; readonly id: string }
  | { readonly kind: "direct"; readonly userId: string }

export interface DwsChannelOptions {
  readonly source: DwsSource
  readonly runner?: import("./runner.ts").DwsRunner
  readonly pollIntervalMs?: number
  /** the user's own userId: their own messages are never re-answered */
  readonly meUserId?: string
  /** optional filter on inbound messages (e.g. only certain senders) */
  readonly filter?: (message: IncomingMessage) => boolean
}

/** the openConversationId a message from this source belongs to */
export const sourceConversationId = (source: DwsSource): string =>
  source.kind === "group" ? source.id : "direct:" + source.userId

/** pull arguments for one list call after the cursor */
export const listArgs = (source: DwsSource, cursor?: string): ReadonlyArray<string> =>
  source.kind === "group"
    ? ["chat", "message", "list", "--group", source.id, ...(cursor ? ["--time", cursor] : [])]
    : ["chat", "message", "list-direct", "--user", source.userId, ...(cursor ? ["--time", cursor] : [])]

/** send arguments for one reply */
export const sendArgs = (source: DwsSource, text: string): ReadonlyArray<string> =>
  source.kind === "group"
    ? ["chat", "message", "send", "--group", source.id, "--text", text]
    : ["chat", "message", "send", "--user", source.userId, "--text", text]
