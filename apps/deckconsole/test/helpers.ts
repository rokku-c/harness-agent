import { Effect } from "effect"
import { createDeckApp, type DeckOptions } from "../src/app.ts"

export const fixture = (options: DeckOptions = {}) => {
  const app = createDeckApp({ configFile: ":memory:", ...options })
  const request = (path: string, body?: unknown, method = body === undefined ? "GET" : "POST") =>
    app.handle(new Request("http://deck" + path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }))
  const get = async (path: string): Promise<any> => (await request(path)).json()
  const post = async (path: string, body: unknown): Promise<any> => (await request(path, body)).json()
  return { ...app, request, get, post }
}
export const withDeck = async (run: (app: ReturnType<typeof fixture>) => Promise<void>, options: DeckOptions = {}) => {
  const app = fixture(options)
  try { await run(app) } finally { await app.close() }
}
export const opsModelFactory = (): import("@effect-agent/builtin").Model => ({
  generate: (_system: string, messages: ReadonlyArray<any>) => Effect.gen(function* () {
    const tool = [...messages].reverse().find(m => m.role === "tool")
    if (tool) return { text: "op-result:" + JSON.stringify(tool.content), toolCalls: [] }
    const user = [...messages].reverse().find(m => m.role === "user")
    const path = String(user?.content ?? "write /tmp/x").trim().split(/\s+/).pop()
    return { text: "", toolCalls: [{ id: "w1", name: "write_file", input: { path } }] }
  }),
})
