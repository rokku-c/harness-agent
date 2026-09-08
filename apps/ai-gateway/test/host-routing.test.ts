import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { makeAiGatewayEffectPlugin } from "../src/effect-plugin.ts"
import { paths, providers, request, stubFetch } from "./helpers.ts"

for (const configured of [providers, []]) {
  test(`gateway owns /v1 namespace before catch-all, with ${configured.length} providers`, async () => {
    const host = makePluginHost()
    const boardPaths: string[] = []
    const stub = stubFetch()
    let configReads = 0
    try {
      // Register catch-all first to exercise actual host priority, not insertion order.
      await host.register({ id: "board", priority: 100, load: async () => ({
        canHandle: () => true,
        handle: async (input) => {
          boardPaths.push(new URL(input.url).pathname)
          return Response.json({ plane: "board" })
        },
      }) })
      await host.register(makeAiGatewayEffectPlugin({
        getConfig: () => { configReads++; return { providers: configured } }, send: stub.send,
      }))
      const unknown = ["/v1", "/v1/", "/v1/models", "/v1/messages/count_tokens", "/v1/messages-extra",
        "/v1/responses/123", "/v1/chat/completions/", "/v1/unknown?debug=1"]
      for (const path of unknown) {
        for (const method of ["GET", "POST", "HEAD"]) {
          const response = await host.handle(new Request(`http://gateway.test${path}`, { method }))
          expect(response.status).toBe(404)
        }
      }
      expect(boardPaths).toEqual([])
      expect(stub.requests).toEqual([])
      expect(configReads).toBe(0)
      const outside = ["/", "/board", "/v10", "/v1-other", "/v1beta/models"]
      for (const path of outside) {
        const response = await host.handle(request(path))
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ plane: "board" })
      }
      for (const path of paths) {
        expect((await host.handle(request(path))).status).toBe(configured.length ? 200 : 503)
      }
      expect(boardPaths).toEqual(outside)
      expect(stub.requests.length).toBe(configured.length)
      expect(configReads).toBe(paths.length)
    } finally { await host.close() }
  })
}
