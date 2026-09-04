/**
 * channels/dws/channel.ts - the DwsChannel poll loop.
 *
 * Concept: every pollIntervalMs the channel lists messages after the cursor,
 * normalizes them, drops already-seen ids and advances the cursor to the
 * newest fresh message, then delivers each (concurrently - an approval
 * reply must never queue behind a running turn). Replies and proactive
 * sends go through the same runner as the logged-in user.
 */
import type { IncomingMessage, MessageChannel, OutgoingTarget } from "../../messages.ts"
import { dwsBunRunner, type DwsRunner } from "./runner.ts"
import { listArgs, sendArgs, type DwsChannelOptions } from "./source.ts"
import { parseDwsList } from "./parse.ts"

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const makeDwsChannel = (options: DwsChannelOptions): MessageChannel => {
  const runner: DwsRunner = options.runner ?? dwsBunRunner
  const pollIntervalMs = options.pollIntervalMs ?? 2_000
  const seen = new Set<string>()
  let cursor: string | undefined

  const pull = async (): Promise<ReadonlyArray<IncomingMessage>> => {
    const json = await runner.run(listArgs(options.source, cursor))
    const messages = parseDwsList(json, options.source, options.meUserId)
    const fresh = messages.filter((message) => !seen.has(message.id))
    for (const message of messages) seen.add(message.id)
    if (fresh.length > 0) {
      const newest = [...fresh].reduce((a, b) => (a.ts >= b.ts ? a : b))
      cursor = new Date(newest.ts).toISOString().slice(0, 19).replace("T", " ")
    }
    return options.filter === undefined ? fresh : fresh.filter(options.filter)
  }

  /** proactive outbound (approval cards): dws sends as the logged-in user */
  const send = async (target: OutgoingTarget, text: string): Promise<void> => {
    const args =
      target.kind === "direct"
        ? ["chat", "message", "send", "--user", target.userId, "--text", text]
        : ["chat", "message", "send", "--group", target.conversationId, "--text", text]
    await runner.run(args)
  }

  return {
    name: "dws:" + (options.source.kind === "group" ? options.source.id : "direct-" + options.source.userId),
    send,
    listen: async (deliver): Promise<never> => {
      while (true) {
        const messages = await pull()
        // concurrent: an approval reply must never queue behind a running turn
        for (const message of messages) {
          void deliver(message).then((reply) => {
            if (reply !== undefined) return runner.run(sendArgs(options.source, reply.text))
          })
        }
        await sleep(pollIntervalMs)
      }
    }
  }
}
