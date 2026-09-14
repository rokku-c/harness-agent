import type { IncomingMessage } from "../../messages.ts"

export type DwsSource =
  | { readonly kind: "group"; readonly id: string }
  | { readonly kind: "direct"; readonly userId: string }

export interface DwsChannelOptions {
  readonly source: DwsSource
  readonly runner?: import("./runner.ts").DwsRunner
  readonly pollIntervalMs?: number
  readonly meUserId: string
  readonly filter?: (message: IncomingMessage) => boolean
}

export const sourceConversationId = (source: DwsSource): string =>
  source.kind === "group" ? source.id : "direct:" + source.userId

export const listArgs = (source: DwsSource, cursor?: string): ReadonlyArray<string> =>
  source.kind === "group"
    ? ["chat", "message", "list", "--group", source.id, ...(cursor ? ["--time", cursor] : [])]
    : ["chat", "message", "list-direct", "--user", source.userId, ...(cursor ? ["--time", cursor] : [])]

export const sendArgs = (source: DwsSource, text: string): ReadonlyArray<string> =>
  source.kind === "group"
    ? ["chat", "message", "send", "--group", source.id, "--text", text]
    : ["chat", "message", "send", "--user", source.userId, "--text", text]
