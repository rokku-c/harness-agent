import type { GatewayRule } from "./contract.ts"

type Message = { role?: unknown; content?: unknown; [key: string]: unknown }
type ChatBody = { messages?: unknown; [key: string]: unknown }

const injected = (content: string): Message => ({ role: "system", content })

export const injectOpenAi = (body: ChatBody, rules: ReadonlyArray<GatewayRule>): ChatBody => {
  if (!Array.isArray(body.messages) || rules.length === 0) return body
  const messages = [...body.messages] as Message[]
  for (const rule of rules) {
    if ((rule.inject.position ?? "system-prefix") === "system-prefix") messages.unshift(injected(rule.inject.content))
    else {
      const lastSystem = messages.findLastIndex((message) => message.role === "system")
      messages.splice(lastSystem + 1, 0, injected(rule.inject.content))
    }
  }
  return { ...body, messages }
}
