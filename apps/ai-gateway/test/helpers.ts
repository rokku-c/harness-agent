import type { HttpSend } from "../src/upstream.ts"
import type { GatewayProvider } from "../src/providers.ts"

export const providers: GatewayProvider[] = [
  { id: "chat", apiType: "openai.chat", baseURL: "https://chat.example.test/proxy", apiKey: "chat-key" },
  { id: "responses", apiType: "openai.responses", baseURL: "https://responses.example.test/prefix/v1", apiKey: "responses-key" },
  { id: "messages", apiType: "anthropic.message", baseURL: "https://messages.example.test/v1/", apiKey: "messages-key" },
]
export const paths = ["/v1/chat/completions", "/v1/responses", "/v1/messages"] as const
export const request = (path: string, body: unknown = { model: "same-model", stream: true }, headers?: RequestInit["headers"]) =>
  new Request(`http://gateway.test${path}`, { method: "POST", headers, body: JSON.stringify(body) })

export const stubFetch = (respond: (request: Request) => Response | Promise<Response> = () => Response.json({ ok: true })) => {
  const requests: Request[] = []
  const send: HttpSend = async (input, init) => {
    const outgoing = input instanceof Request ? new Request(input, init) : new Request(input.toString(), init)
    requests.push(outgoing)
    return respond(outgoing)
  }
  return { requests, send }
}
