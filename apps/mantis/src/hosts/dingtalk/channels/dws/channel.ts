import type { IncomingMessage, MessageChannel, OutgoingTarget } from "../../messages.ts"
import { dwsBunRunner, type DwsRunner } from "./runner.ts"
import { listArgs, sendArgs, type DwsChannelOptions } from "./source.ts"
import { parseDwsList } from "./parse.ts"

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const makeDwsChannel = (options: DwsChannelOptions): MessageChannel => {
  if (options.meUserId === "") {
    throw new Error("dws channel needs the logged-in user's id (DWS_ME_USER_ID): without it it answers its own replies")
  }
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
